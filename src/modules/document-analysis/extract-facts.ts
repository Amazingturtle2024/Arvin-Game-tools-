import { layerFor } from "./classify";
import { locationLabel } from "./parse";
import type { ExtractedFact, FactCategory, ParsedDocument, SourceRef, TextUnit } from "./types";

let factSeq = 0;

export function resetFactIds(): void {
  factSeq = 0;
}

type Pattern = {
  field: string;
  label: string;
  category: FactCategory;
  re: RegExp;
  value?: (match: RegExpMatchArray, unit: TextUnit) => string;
  clause?: (match: RegExpMatchArray, unit: TextUnit) => string | null;
};

const CONTRACT_FAMILY_PATTERNS: Array<{ family: string; re: RegExp }> = [
  { family: "NEC4", re: /\bNEC\s*4\b|\bNEC4\b/i },
  { family: "NEC3", re: /\bNEC\s*3\b|\bNEC3\b/i },
  { family: "NEC", re: /\bNew Engineering Contract\b|\bNEC Engineering and Construction Contract\b/i },
  { family: "JCT", re: /\bJCT\b|\bJoint Contracts Tribunal\b/i },
  { family: "FIDIC", re: /\bFIDIC\b/i },
  { family: "JBCC", re: /\bJBCC\b/i },
  { family: "GCC", re: /\bGCC\s*(20\d{2})?\b|\bGeneral Conditions of Contract for Construction Works\b/i },
  { family: "AS 4000", re: /\bAS\s*4000\b/i },
  { family: "AS 2124", re: /\bAS\s*2124\b/i },
  { family: "AIA", re: /\bAIA\s+(A\d{3}|Document)\b/i },
  { family: "ICE", re: /\bICE Conditions of Contract\b/i },
];

const PATTERNS: Pattern[] = [
  {
    field: "contract_edition",
    label: "Contract edition / year",
    category: "contract_identity",
    re: /\b(June 2017|January 2023|April 2013|2011|2016|2017|2023|2024)\b(?:\s+amendments?)?/i,
    value: (m, unit) => {
      if (!/\b(NEC|JCT|FIDIC|JBCC|GCC|conditions of contract|edition)\b/i.test(unit.text)) return "";
      return m[0];
    },
  },
  {
    field: "main_option",
    label: "Main option / contract form variant",
    category: "contract_identity",
    re: /\b(?:Main\s+Option|Option)\s+([A-F])\b(?:\s*\(([^)]+)\))?/i,
    value: (m) => m[2] ? `Option ${m[1].toUpperCase()} (${m[2].trim()})` : `Option ${m[1].toUpperCase()}`,
  },
  {
    field: "secondary_options",
    label: "Secondary options",
    category: "contract_identity",
    re: /\bSecondary Options?\s+([X]\d+(?:\s*,\s*[X]\d+)*)/i,
  },
  {
    field: "jct_form",
    label: "JCT form",
    category: "contract_identity",
    re: /\bJCT\s+(Standard Building Contract|Design and Build|Intermediate Building Contract|Minor Works)[^\n.]{0,60}/i,
  },
  {
    field: "fidic_book",
    label: "FIDIC book",
    category: "contract_identity",
    re: /\bFIDIC\b[^\n.]{0,80}\b(Red|Yellow|Silver|Pink|Green)\s+Book\b[^\n.]{0,40}/i,
  },
  {
    field: "project_name",
    label: "Project / works title",
    category: "project_details",
    re: /\b(?:project(?: name)?|title of the works|the works are|name of the works)\s*(?:is|:)\s*([^\n.]{3,200})/i,
  },
  {
    field: "client",
    label: "Client / Employer",
    category: "project_details",
    re: /\b(?:the\s+)?(?:client|employer|purchaser)\s+is\s+([^\n.]{3,200})/i,
  },
  {
    field: "contractor",
    label: "Contractor",
    category: "project_details",
    re: /\b(?:the\s+)?contractor\s+is\s+([^\n.]{3,200})/i,
  },
  {
    field: "project_manager",
    label: "Project Manager / Architect / Engineer",
    category: "project_details",
    re: /\b(?:the\s+)?(?:project manager|architect|engineer|principal agent)\s+is\s+([^\n.]{3,200})/i,
  },
  {
    field: "site",
    label: "Site / location",
    category: "project_details",
    re: /\b(?:the site is(?: at)?|site address is|the site address is)\s*([^\n.]{3,200})/i,
  },
  {
    field: "starting_date",
    label: "Starting / commencement date",
    category: "time",
    re: /\b(?:starting date|commencement date|date of commencement)\s*(?:is|:)\s*([^\n.]{3,80})/i,
  },
  {
    field: "access_date",
    label: "Access / possession date",
    category: "time",
    re: /\b(?:access date|possession date|date of possession)\s*(?:is|:)\s*([^\n.]{3,80})/i,
  },
  {
    field: "completion_date",
    label: "Completion date",
    category: "time",
    re: /\b(?:completion date(?: for the whole of the works)?|date for completion|practical completion date)\s*(?:is|:)\s*([^\n.]{3,80})/i,
  },
  {
    field: "duration",
    label: "Stated construction period",
    category: "time",
    re: /\b(?:construction period|contract period|time for completion|period for completion)\s*(?:shall be|is|:)\s*([^\n.]{3,80})/i,
  },
  {
    field: "sectional_completion",
    label: "Sectional completion",
    category: "time",
    re: /\b(section(?:al)? completion[^\n.]{0,160})/i,
  },
  {
    field: "working_hours",
    label: "Working hours / calendar",
    category: "time",
    re: /\b(working hours[^\n.]{0,120}|working days[^\n.]{0,80}|calendar[^\n.]{0,80})/i,
  },
  {
    field: "delay_damages",
    label: "Delay / liquidated damages",
    category: "penalties",
    re: /\b(?:delay damages|liquidated damages|liquidated and ascertained damages)\s*(?:are|is|:)\s*([£$€]\s*[\d,]+(?:\.\d+)?(?:\s*per\s+\w+)?|\d[\d,]*(?:\.\d+)?\s*(?:%|per\s+\w+)?)/i,
    clause: (m, unit) => clauseIn(clipQuote(unit.text, m[0])) || (/x7/i.test(unit.text) ? "X7" : null),
  },
  {
    field: "penalty",
    label: "Penalty",
    category: "penalties",
    re: /\bpenalt(?:y|ies)\s*(?:of|at|:)\s*([^\n.]{3,80})/i,
  },
  {
    field: "retention",
    label: "Retention",
    category: "money",
    re: /\bretention\s*(?:is|:)\s*([^\n.]{1,40})/i,
  },
  {
    field: "defects_date",
    label: "Defects date / defects period",
    category: "time",
    re: /\b(?:defects date|defects liability period|rectification period)\s*(?:is|:)\s*([^\n.]{3,80})/i,
  },
  {
    field: "payment_period",
    label: "Payment period",
    category: "money",
    re: /\b(?:assessment interval|payment (?:due )?period|final date for payment)\s*(?:is|:)\s*([^\n.]{3,80})/i,
  },
  {
    field: "eot_mechanism",
    label: "Extension of time / compensation event mechanism",
    category: "eot",
    re: /\b(compensation events?|relevant events?|extension of time|EoT)([^\n.]{0,200})/i,
    clause: (m, unit) => clauseIn(clipQuote(unit.text, m[0])),
  },
  {
    field: "weather_risk",
    label: "Weather risk allocation",
    category: "eot",
    re: /\b(weather[^\n.]{0,200})/i,
  },
  {
    field: "design_responsibility",
    label: "Design responsibility",
    category: "obligations",
    re: /\b(design responsibility[^\n.]{0,200}|contractor.?s design[^\n.]{0,160}|employer.?s design[^\n.]{0,160})/i,
  },
  {
    field: "programme_obligation",
    label: "Programme submission obligation",
    category: "obligations",
    re: /\b(programme[^\n.]{0,200}|clause 31[^\n.]{0,160}|accepted programme[^\n.]{0,160})/i,
  },
  {
    field: "insurance",
    label: "Insurance",
    category: "obligations",
    re: /\b(insurance[^\n.]{0,180})/i,
  },
  {
    field: "dispute",
    label: "Dispute resolution",
    category: "obligations",
    re: /\b(adjudication|arbitration|dispute[^\n.]{0,140})/i,
  },
  {
    field: "scope_statement",
    label: "Scope of works",
    category: "scope",
    re: /\b(?:scope of (?:the )?works|the works comprise|brief description of the works|Works Information)\s*(?:is|:)\s*([^\n.]{3,240})/i,
  },
  {
    field: "spec_section",
    label: "Specification section",
    category: "specifications",
    re: /^(section\s+[A-Z0-9]+[^\n]{0,80}|works information [A-Z0-9.]+[^\n]{0,80})/i,
  },
  {
    field: "z_clause",
    label: "Z clause / amendment",
    category: "amendments",
    re: /\b(Z\d+[A-Za-z]?[:.\s][^\n]{10,240})/,
    clause: (m) => {
      const found = m[1].match(/^Z\d+[A-Za-z]?/i);
      return found ? found[0].toUpperCase() : null;
    },
  },
  {
    field: "amended_clause",
    label: "Amended or deleted clause",
    category: "amendments",
    re: /\b(clause\s+[\d.]+[^\n]{0,40}(?:is deleted|is amended|deleted and replaced|shall not apply)[^\n.]{0,160})/i,
    clause: (m) => {
      const found = m[1].match(/clause\s+([\d.]+)/i);
      return found ? found[1] : null;
    },
  },
  {
    field: "clause_ref",
    label: "Identified contract clause",
    category: "clauses",
    re: /\b(clause\s+\d+(?:\.\d+){0,4}[^\n.]{0,180})/i,
    clause: (m) => {
      const found = m[1].match(/clause\s+(\d+(?:\.\d+){0,4})/i);
      return found ? found[1] : null;
    },
  },
];

export function extractFacts(docs: ParsedDocument[]): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  for (const doc of docs) {
    facts.push(...extractContractFamily(doc));
    for (const unit of doc.units) {
      for (const pattern of PATTERNS) {
        const matches = matchAll(unit.text, pattern.re);
        for (const match of matches) {
          const rawValue = pattern.value ? pattern.value(match, unit) : (match[1] || match[0]);
          const value = tidyValue(rawValue);
          if (!value) continue;
          if (value.length < 2) continue;
          if (value.length < 3 && !/\d/.test(value)) continue;
          if (pattern.field === "weather_risk" && !/\b(weather|climatic)\b/i.test(value)) continue;
          if (pattern.field === "programme_obligation" && !/\b(programme|program|clause 31)\b/i.test(value)) continue;
          if (pattern.field === "insurance" && value.length < 24) continue;
          const quote = clipQuote(unit.text, match[0]);
          const clause = pattern.clause ? pattern.clause(match, unit) : clauseIn(quote);
          facts.push(makeFact({
            field: pattern.field,
            label: pattern.label,
            category: pattern.category,
            value,
            doc,
            unit,
            quote,
            clause,
          }));
        }
      }
    }
    facts.push(...extractBoqRows(doc));
  }
  return dedupeFacts(facts);
}

export function extractContractFamily(doc: ParsedDocument): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  for (const unit of doc.units) {
    for (const family of CONTRACT_FAMILY_PATTERNS) {
      const match = unit.text.match(family.re);
      if (!match) continue;
      const quote = clipQuote(unit.text, match[0]);
      facts.push(makeFact({
        field: "contract_family",
        label: "Named contract family",
        category: "contract_identity",
        value: family.family,
        doc,
        unit,
        quote,
        clause: clauseIn(quote),
      }));
    }
  }
  return facts;
}

function extractBoqRows(doc: ParsedDocument): ExtractedFact[] {
  if (doc.kind !== "xlsx" && doc.role !== "boq") return [];
  const facts: ExtractedFact[] = [];
  const itemLike = doc.units.filter((u) => looksLikeBoqItem(u.text));
  if (itemLike.length > 0) {
    const first = itemLike[0];
    facts.push(makeFact({
      field: "boq_item_count",
      label: "Bill items counted from the file",
      category: "boq",
      value: String(itemLike.length),
      doc,
      unit: first,
      quote: clipQuote(first.text, first.text),
      clause: null,
    }));
  }
  const totalRow = doc.units.find((u) => /\b(grand total|tender total|bill total|total amount)\b/i.test(u.text));
  if (totalRow) {
    facts.push(makeFact({
      field: "boq_total",
      label: "Total stated in the bill",
      category: "boq",
      value: tidyValue(totalRow.text),
      doc,
      unit: totalRow,
      quote: clipQuote(totalRow.text, totalRow.text),
      clause: null,
    }));
  }
  const sections = [...new Set(doc.units
    .filter((u) => /^(bill|section|preliminaries|measured works)\b/i.test(u.text) && u.text.length < 80)
    .map((u) => u.text))];
  for (const section of sections.slice(0, 30)) {
    const unit = doc.units.find((u) => u.text === section);
    if (!unit) continue;
    facts.push(makeFact({
      field: "boq_section",
      label: "Bill section",
      category: "boq",
      value: section,
      doc,
      unit,
      quote: section,
      clause: null,
    }));
  }
  return facts;
}

export function looksLikeBoqItem(text: string): boolean {
  const parts = text.split("|").map((p) => p.trim());
  if (parts.length >= 3 && /^[A-Z0-9]+(\.\d+)*$/i.test(parts[0]) && /\b(m3|m2|m|nr|item|sum|kg|t|lin\.?m)\b/i.test(text)) {
    return true;
  }
  return /\b(m3|m2|nr|item)\b/i.test(text) && /\d/.test(text) && parts.length >= 4;
}

function makeFact(input: {
  field: string;
  label: string;
  category: FactCategory;
  value: string;
  doc: ParsedDocument;
  unit: TextUnit;
  quote: string;
  clause: string | null;
}): ExtractedFact {
  factSeq += 1;
  const source: SourceRef = {
    documentId: input.doc.documentId,
    documentName: input.doc.filename,
    page: input.unit.page,
    sheet: input.unit.sheet,
    row: input.unit.row,
    heading: input.unit.heading,
    clause: input.clause,
    quote: input.quote,
    locationLabel: locationLabel(input.unit, input.clause),
  };
  return {
    id: `F${String(factSeq).padStart(4, "0")}`,
    field: input.field,
    label: input.label,
    category: input.category,
    value: input.value,
    source,
    layer: layerFor(input.doc, input.quote),
    verification: "extracted",
    origin: "document",
  };
}

function matchAll(text: string, re: RegExp): RegExpMatchArray[] {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const global = new RegExp(re.source, flags);
  return [...text.matchAll(global)];
}

function tidyValue(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[:\-–]+\s*/, "").replace(/[.;\s]+$/, "").trim();
}

function clipQuote(text: string, needle: string): string {
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return text.slice(0, 280);
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + needle.length + 80);
  const slice = text.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

function clauseIn(text: string): string | null {
  const match = text.match(/\b(?:clause|cl\.?)\s*(\d+(?:\.\d+){0,4}|[X]\d+|Z\d+)/i);
  return match ? match[1] : null;
}

function dedupeFacts(facts: ExtractedFact[]): ExtractedFact[] {
  const seen = new Set<string>();
  const out: ExtractedFact[] = [];
  for (const fact of facts) {
    const key = [
      fact.field,
      fact.value.toLowerCase(),
      fact.source.documentId,
      fact.source.locationLabel,
      fact.source.quote.slice(0, 80),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fact);
  }
  return out;
}

export function quoteExistsInDocuments(quote: string, docs: ParsedDocument[]): boolean {
  const needle = collapse(quote);
  if (needle.length < 12) return false;
  return docs.some((doc) => collapse(doc.fullText).includes(needle));
}

function collapse(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}
