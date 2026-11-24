import { describe, expect, it } from "vitest";
import { extractFacts, locateQuote, resetFactIds } from "../document-analysis/extract-facts";
import { buildReport } from "../document-analysis/report";
import { buildSampleTenderPack } from "../document-analysis/sample-pack";
import { analyzeDocuments } from "../document-analysis";
import type { ParsedDocument } from "../document-analysis/types";
import { analyzeDrawings } from "./index";
import { calculateQuantities } from "./quantities";
import { STARTER_RATES } from "./starter-rates";
import { buildSampleDrawingPack } from "./sample";
import type { ProductionRate } from "./types";

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

function rates(): ProductionRate[] {
  return STARTER_RATES.map((row, i) => ({
    id: `r${i}`,
    owner_id: "test",
    activity_key: row.activity_key,
    label: row.label,
    unit: row.unit,
    rate_per_day: row.rate_per_day,
    workers: 1,
    teams: 1,
    plant: row.plant,
    hours_per_day: 8,
    days_per_week: 5,
    site_conditions: "",
    accessibility: "",
    weather_allowance_pct: 0,
    notes: row.notes,
  }));
}

describe("module 1 bugbot regressions", () => {
  it("does not treat a random spreadsheet as a bill", () => {
    resetFactIds();
    const docs = [doc({
      filename: "resource-histogram.xlsx",
      kind: "xlsx",
      role: "other",
      fullText: "Week | Gang | Hours\n1 | 4 | 40",
      units: [{ text: "Week | Gang | Hours", page: null, sheet: "Plan", row: 1, heading: "Plan" }],
      sheetNames: ["Plan"],
    })];
    const report = buildReport({ projectId: "p", projectName: "n", docs, extraFacts: extractFacts(docs) });
    expect(report.boq.found).toBe(false);
  });

  it("locates a model quote on the file that actually contains it", () => {
    const docs = [
      doc({ documentId: "a", filename: "wrong.pdf", fullText: "Unrelated notes about brickwork." }),
      doc({ documentId: "b", filename: "right.pdf", fullText: "The delay damages are £8,500 per day on this page." }),
    ];
    const found = locateQuote("delay damages are £8,500 per day", docs);
    expect(found?.doc.filename).toBe("right.pdf");
  });
});

describe("module 2 drawing take-off", () => {
  it("calculates pad volumes from stated sizes and does not invent a wall-footing depth", async () => {
    const drawings = await buildSampleDrawingPack();
    const tender = await buildSampleTenderPack();
    const files = [...tender, ...drawings].map((file, i) => ({
      documentId: `f${i}`,
      filename: file.filename,
      mime: file.mime,
      bytes: file.bytes,
    }));
    const report = await analyzeDrawings({
      projectId: "p1",
      projectName: "Riverside",
      files,
      rates: rates(),
    });
    const excavation = report.takeoff.find((t) => t.label.includes("Excavation — foundation pads") && t.complete);
    expect(excavation?.quantity).toBe(147);
    expect(excavation?.formula).toMatch(/12/);
    const concrete = report.takeoff.find((t) => t.label.includes("Concrete — foundation pads") && t.complete);
    expect(concrete?.quantity).toBe(60);
    const wall = report.takeoff.find((t) => /wall footing/i.test(t.label) || t.assumptions.some((a) => /depth/i.test(a)));
    expect(report.takeoff.some((t) => t.complete === false && /depth/i.test(t.assumptions.join(" ")))).toBe(true);
    expect(wall === undefined || wall.complete === false).toBe(true);
    const pipe = report.takeoff.find((t) => t.label.includes("150 mm pipe") && t.complete);
    expect(pipe?.quantity).toBe(210);
    const excDuration = report.durations.find((d) => d.activityKey === "excavation");
    expect(excDuration?.quantity).toBeGreaterThan(147);
    expect(excDuration?.durationWorkingDays).toBeCloseTo((excDuration?.quantity ?? 0) / 150, 1);
    expect(report.boqComparison.some((r) => r.status === "difference" || r.status === "match")).toBe(true);
    expect(report.handoff.activities.length).toBeGreaterThan(0);
    expect(report.drawings.some((d) => d.drawingNumber === "S-FDN-101")).toBe(true);
    expect(report.drawings.find((d) => d.drawingNumber === "A-GA-001")?.drawingKind).toBe("general_arrangement");
    const roadDurations = report.durations.filter((d) => d.activityKey === "roadworks");
    expect(roadDurations.some((d) => d.unit === "m3" && d.quantity === 18.7)).toBe(true);
    expect(roadDurations.every((d) => d.unit !== "m3" || d.quantity < 100)).toBe(true);
  });

  it("does not take wall-footing depth from a different drawing", () => {
    const takeoff = calculateQuantities([
      doc({
        documentId: "wall",
        filename: "S-DET-401 Wall Footing Detail.pdf",
        role: "drawings",
        fullText: "Wall footing length 18 m width 0.9 m. Depth not stated on this detail.",
      }),
      doc({
        documentId: "other",
        filename: "S-FDN-999 Other.pdf",
        role: "drawings",
        fullText: "Wall footing depth 0.6 m on a different sheet.",
      }),
    ]);
    const wall = takeoff.find((t) => /wall footing/i.test(t.label));
    expect(wall?.complete).toBe(false);
    expect(wall?.assumptions.join(" ")).toMatch(/depth/i);
  });

  it("does not add a stated excavation total on top of a calculated pad volume", () => {
    const takeoff = calculateQuantities([
      doc({
        filename: "S-FDN-101 Foundation Plan.pdf",
        role: "drawings",
        fullText: "Foundation pads: 12 nr 2.5 m x 2.5 m x 0.8 m deep. Working space 0.5 m. Excavate to 1.0 m below NGL. Total excavation: 999 m3.",
      }),
    ]);
    const excavation = takeoff.filter((t) => t.activityKey === "excavation" && t.complete);
    expect(excavation).toHaveLength(1);
    expect(excavation[0].quantity).toBe(147);
  });

  it("blocks duration when the production rate is blank", async () => {
    const drawings = await buildSampleDrawingPack();
    const files = drawings.map((file, i) => ({
      documentId: `d${i}`,
      filename: file.filename,
      mime: file.mime,
      bytes: file.bytes,
    }));
    const blank = rates().map((r) => ({ ...r, rate_per_day: null }));
    const report = await analyzeDrawings({
      projectId: "p1",
      projectName: "Riverside",
      files,
      rates: blank,
    });
    expect(report.durations.every((d) => d.durationWorkingDays == null)).toBe(true);
    expect(report.durations.some((d) => d.blockedReason?.includes("No production rate"))).toBe(true);
  });
});

describe("sample tender still extracts spec sections", () => {
  it("finds Section A in the works information PDF", async () => {
    const files = await buildSampleTenderPack();
    const { report } = await analyzeDocuments({
      projectId: "p",
      projectName: "s",
      files: files.map((file, i) => ({
        documentId: `s${i}`,
        filename: file.filename,
        mime: file.mime,
        bytes: file.bytes,
      })),
    });
    expect(report.specifications.length).toBeGreaterThan(0);
  });
});
