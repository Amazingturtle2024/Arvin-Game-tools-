import { describe, expect, it } from "vitest";
import { analyzeDocuments } from "./index";
import { contractFinding } from "./report";
import { extractFacts, locateQuote, resetFactIds } from "./extract-facts";
import { classifyDocument } from "./classify";
import { findConflicts } from "./conflicts";
import { findMissing } from "./missing";
import { buildSampleTenderPack } from "./sample-pack";
import type { ParsedDocument } from "./types";

function doc(partial: Partial<ParsedDocument> & { fullText: string; filename: string }): ParsedDocument {
  const units = partial.units ?? [{ text: partial.fullText, page: 1, sheet: null, row: null, heading: null }];
  return {
    documentId: partial.documentId ?? "d1",
    filename: partial.filename,
    mime: partial.mime ?? "application/pdf",
    kind: partial.kind ?? "pdf",
    role: partial.role ?? "other",
    roleReason: partial.roleReason ?? "test",
    units,
    fullText: partial.fullText,
    warnings: [],
    pageCount: 1,
    sheetNames: partial.sheetNames ?? [],
  };
}

describe("contract identification", () => {
  it("does not assume a contract type when none is named", () => {
    resetFactIds();
    const facts = extractFacts([
      doc({
        filename: "notes.pdf",
        fullText: "The starting date is 6 April 2026. The Client is Harbour Trust.",
      }),
    ]);
    const finding = contractFinding(facts);
    expect(finding.status).toBe("not_stated");
    expect(finding.family).toBeNull();
    expect(facts.some((f) => f.field === "contract_family")).toBe(false);
  });

  it("reports NEC4 only when those words appear, with a quote", () => {
    resetFactIds();
    const facts = extractFacts([
      doc({
        filename: "contract-data.pdf",
        role: "contract_data",
        fullText: "The conditions of contract are the NEC4 Engineering and Construction Contract June 2017, Main Option A (Priced contract with activity schedule).",
      }),
    ]);
    const finding = contractFinding(facts);
    expect(finding.status).toBe("identified");
    expect(finding.family).toBe("NEC4");
    expect(finding.facts[0].source.quote).toMatch(/NEC4/i);
    expect(facts.some((f) => /FIDIC|JCT/.test(f.value))).toBe(false);
  });

  it("flags two named families as conflicting and picks neither", () => {
    resetFactIds();
    const facts = extractFacts([
      doc({ filename: "a.pdf", fullText: "This tender is under NEC4 ECC." }),
      doc({ documentId: "d2", filename: "b.pdf", fullText: "The FIDIC Red Book 2017 shall apply." }),
    ]);
    const finding = contractFinding(facts);
    expect(finding.status).toBe("conflicting");
    expect(finding.family).toBeNull();
  });
});

describe("source citations", () => {
  it("extracts a short retention percentage", () => {
    resetFactIds();
    const facts = extractFacts([
      doc({
        filename: "cd.pdf",
        role: "contract_data",
        fullText: "The retention is 5%.",
      }),
    ]);
    expect(facts.find((f) => f.field === "retention")?.value).toMatch(/5%/);
  });

  it("does not treat a bill item named site establishment as the project site", () => {
    resetFactIds();
    const facts = extractFacts([
      doc({
        filename: "boq.xlsx",
        role: "boq",
        kind: "xlsx",
        fullText: "A.1 | Site establishment | sum | 1 | 42000 | 42000",
        units: [{ text: "A.1 | Site establishment | sum | 1 | 42000 | 42000", page: null, sheet: "Preliminaries", row: 3, heading: "Preliminaries" }],
      }),
    ]);
    expect(facts.some((f) => f.field === "site")).toBe(false);
  });

  it("keeps page numbers from PDF units", () => {
    resetFactIds();
    const facts = extractFacts([
      doc({
        filename: "data.pdf",
        fullText: "The delay damages are £8,500 per day.",
        units: [{ text: "The delay damages are £8,500 per day.", page: 2, sheet: null, row: null, heading: null }],
      }),
    ]);
    const damages = facts.find((f) => f.field === "delay_damages");
    expect(damages?.source.page).toBe(2);
    expect(damages?.source.locationLabel).toMatch(/p\.2/);
    expect(damages?.source.quote).toMatch(/8,500/);
    expect(damages?.source.clause).toBeNull();
  });
});

describe("conflicts and gaps", () => {
  it("flags mismatched duration statements", () => {
    resetFactIds();
    const facts = extractFacts([
      doc({ filename: "itt.pdf", role: "invitation_to_tender", fullText: "The construction period shall be 78 weeks from the starting date." }),
      doc({
        documentId: "d2",
        filename: "cd.pdf",
        role: "contract_data",
        fullText: "The construction period shall be 80 weeks from the starting date.",
      }),
    ]);
    const conflicts = findConflicts(facts);
    expect(conflicts.some((c) => c.field === "duration")).toBe(true);
  });

  it("lists missing contract type instead of filling it in", () => {
    resetFactIds();
    const docs = [doc({ filename: "scope.pdf", fullText: "Scope of the works is a classroom wing." })];
    const facts = extractFacts(docs);
    const missing = findMissing(docs, facts);
    expect(missing.some((m) => m.field === "contract_family")).toBe(true);
  });
});

describe("citations and classification", () => {
  it("locates a quote that spans two PDF lines", () => {
    const found = locateQuote("delay damages are £8,500 per day", [
      doc({
        filename: "cd.pdf",
        fullText: "The delay damages are £8,500 per day of delay.",
        units: [
          { text: "The delay damages are", page: 1, sheet: null, row: null, heading: null },
          { text: "£8,500 per day of delay.", page: 1, sheet: null, row: null, heading: null },
        ],
      }),
    ]);
    expect(found?.doc.filename).toBe("cd.pdf");
  });

  it("does not treat a specification section file as a drawing", () => {
    const role = classifyDocument("Specification Section A.pdf", [
      { text: "Section A — Preliminaries. Testing of concrete to BS 8500.", page: 1, sheet: null, row: null, heading: null },
    ]);
    expect(role.role).toBe("specification");
  });

  it("prefers the file the model named when the quote exists in two files", () => {
    const docs = [
      doc({ documentId: "a", filename: "Amended Contract Data.pdf", fullText: "The delay damages are £8,500 per day of delay." }),
      doc({ documentId: "b", filename: "Contract Data.pdf", fullText: "The delay damages are £8,500 per day of delay." }),
    ];
    const found = locateQuote("delay damages are £8,500 per day", docs, "Contract Data.pdf");
    expect(found?.doc.filename).toBe("Contract Data.pdf");
  });

  it("classifies a drawing number with a revision suffix as a drawing", () => {
    const role = classifyDocument("ABC-DRG-001_Rev2.pdf", [
      { text: "Notes.", page: 1, sheet: null, row: null, heading: null },
    ]);
    expect(role.role).toBe("drawings");
  });
});

describe("sample tender pack", () => {
  it("extracts NEC4, Z-clause weather transfer, BOQ items and a duration conflict", async () => {
    const files = await buildSampleTenderPack();
    const { report } = await analyzeDocuments({
      projectId: "p1",
      projectName: "Sample",
      files: files.map((file, i) => ({
        documentId: `s${i}`,
        filename: file.filename,
        mime: file.mime,
        bytes: file.bytes,
      })),
    });
    expect(report.contract.status).toBe("identified");
    expect(report.contract.family).toBe("NEC4");
    expect(report.money.some((f) => f.field === "retention" && /5%/.test(f.value))).toBe(true);
    expect(report.projectDetails.filter((f) => f.field === "site").every((f) => /Mill Lane/i.test(f.value))).toBe(true);
    expect(report.specifications.some((f) => /section/i.test(f.value))).toBe(true);
    expect(report.amendments.some((f) => /Z1/i.test(f.value) && /weather/i.test(f.value))).toBe(true);
    expect(report.boq.found).toBe(true);
    expect((report.boq.itemCount ?? 0) >= 4).toBe(true);
    expect(report.conflicts.length).toBeGreaterThan(0);
    expect(report.missingInformation.some((m) => m.field === "drawings")).toBe(true);
    expect(report.risks.some((r) => r.id === "R-weather")).toBe(true);
    for (const fact of [...report.timeProvisions, ...report.penalties, ...report.contract.facts]) {
      expect(fact.source.quote.length).toBeGreaterThan(8);
      expect(fact.source.documentName.length).toBeGreaterThan(0);
    }
  });
});
