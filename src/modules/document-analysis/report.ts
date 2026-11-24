import { findConflicts } from "./conflicts";
import { extractFacts } from "./extract-facts";
import { findMissing } from "./missing";
import { findRisks } from "./risks";
import type {
  BoqSummary,
  ContractFinding,
  ExtractedFact,
  ParsedDocument,
  TenderReviewReport,
} from "./types";

export function buildReport(input: {
  projectId: string;
  projectName: string;
  docs: ParsedDocument[];
  extraFacts?: ExtractedFact[];
  discardedUncitedModelClaims?: number;
}): TenderReviewReport {
  const extracted = extractFacts(input.docs);
  const facts = [...extracted, ...(input.extraFacts ?? [])];
  const contract = contractFinding(facts);
  const boq = boqSummary(input.docs, facts);
  return {
    module: "document-analysis",
    generatedAt: new Date().toISOString(),
    projectId: input.projectId,
    projectName: input.projectName,
    methodology: [
      "No contract type is assumed. A family is reported only when those words appear in an uploaded file.",
      "No clause is invented. Every finding keeps the source file plus page, sheet/row or paragraph, and a short quote.",
      "General conditions are separated from project-specific contract data, particular conditions and Z clauses where the file or wording makes that distinction.",
      "Where two files disagree, both wordings are kept and marked as a conflict. The module does not pick a winner.",
      "Information that is not in the files is listed as missing. It is not filled in from industry practice.",
      "Optional model-assisted reading, if enabled, is accepted only when the returned quote is found in the source text.",
    ],
    documents: input.docs.map((d) => ({
      documentId: d.documentId,
      filename: d.filename,
      kind: d.kind,
      role: d.role,
      roleReason: d.roleReason,
      pageCount: d.pageCount,
      warnings: d.warnings,
    })),
    contract,
    projectDetails: byCategory(facts, "project_details"),
    scopeOfWorks: byCategory(facts, "scope"),
    specifications: byCategory(facts, "specifications"),
    boq,
    timeProvisions: byCategory(facts, "time"),
    money: byCategory(facts, "money"),
    penalties: byCategory(facts, "penalties"),
    eot: byCategory(facts, "eot"),
    obligations: byCategory(facts, "obligations"),
    clauses: byCategory(facts, "clauses"),
    amendments: byCategory(facts, "amendments"),
    missingInformation: findMissing(input.docs, facts),
    conflicts: findConflicts(facts),
    risks: findRisks(facts),
    unverified: facts.filter((f) => f.verification === "unverified"),
    discardedUncitedModelClaims: input.discardedUncitedModelClaims ?? 0,
  };
}

function byCategory(facts: ExtractedFact[], category: ExtractedFact["category"]): ExtractedFact[] {
  return facts.filter((f) => f.category === category);
}

export function contractFinding(facts: ExtractedFact[]): ContractFinding {
  const named = facts.filter((f) => f.field === "contract_family");
  const families = [...new Set(named.map((f) => f.value))];
  const edition = facts.find((f) => f.field === "contract_edition")?.value ?? null;
  const option = facts.find((f) => f.field === "main_option")?.value ?? null;
  if (families.length === 0) {
    return {
      status: "not_stated",
      family: null,
      edition: null,
      option: null,
      facts: named,
      note: "No uploaded document names a contract family (for example NEC4, JCT, FIDIC, JBCC, GCC). The type is therefore not stated. It has not been assumed.",
    };
  }
  if (families.length > 1) {
    return {
      status: "conflicting",
      family: null,
      edition,
      option,
      facts: named,
      note: `More than one contract family is named in the files (${families.join(", ")}). Both are shown. Neither has been selected.`,
    };
  }
  return {
    status: "identified",
    family: families[0],
    edition,
    option,
    facts: named,
    note: `“${families[0]}” appears in the cited source. Edition and options are shown only if those words also appear.`,
  };
}

function boqSummary(docs: ParsedDocument[], facts: ExtractedFact[]): BoqSummary {
  const boqDocs = docs.filter((d) => d.role === "boq" || d.kind === "xlsx");
  const sections = facts.filter((f) => f.field === "boq_section").map((f) => f.value);
  const totals = facts.filter((f) => f.field === "boq_total").map((f) => ({
    label: f.label,
    value: f.value,
    source: f.source,
  }));
  const countFact = facts.find((f) => f.field === "boq_item_count");
  return {
    found: boqDocs.length > 0 || Boolean(countFact),
    sheetCount: boqDocs.reduce((n, d) => n + d.sheetNames.length, 0),
    itemCount: countFact ? Number(countFact.value) : null,
    sections: [...new Set(sections)],
    totals,
    notes: boqDocs.length === 0 && !countFact
      ? ["No bill of quantities or activity schedule was identified in the upload."]
      : [],
  };
}
