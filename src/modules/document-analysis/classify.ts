import type { DocumentRole, ParsedDocument, TextUnit } from "./types";

type RoleHit = { role: DocumentRole; reason: string; score: number };

export function classifyDocument(filename: string, units: TextUnit[]): {
  role: DocumentRole;
  roleReason: string;
} {
  const name = filename.toLowerCase();
  const text = units.map((u) => u.text).join("\n").slice(0, 20000);
  const hits: RoleHit[] = [];

  const nameRules: Array<[RegExp, DocumentRole, string, number]> = [
    [/\b(boq|bill of quantities|bills of quantities|activity schedule)\b/i, "boq", "Filename refers to a bill or activity schedule", 8],
    [/\b(drawing|dwg|ga[-_ ]?plan)\b/i, "drawings", "Filename refers to drawings", 7],
    [/\b(itt|invitation to tender|tender enquiry|instruction to tenderers)\b/i, "invitation_to_tender", "Filename refers to an invitation to tender", 8],
    [/\b(particular conditions|special conditions|z[- ]?clause|employer's amendments)\b/i, "particular_conditions", "Filename refers to particular conditions", 9],
    [/\b(contract data|contract particulars|appendix to conditions)\b/i, "contract_data", "Filename refers to contract data / particulars", 9],
    [/\b(specification|works information|employer'?s requirements|preliminaries)\b/i, "specification", "Filename refers to specifications or works information", 7],
    [/\b(contract|conditions of contract|gcc|nec|jct|fidic|jbcc)\b/i, "contract_conditions", "Filename refers to contract conditions", 6],
  ];
  for (const [re, role, reason, score] of nameRules) {
    if (re.test(name)) hits.push({ role, reason, score });
  }

  const contentRules: Array<[RegExp, DocumentRole, string, number]> = [
    [/\bbill of quantities\b|\bactivity schedule\b|\bitem no\.?\b.{0,40}\bqty\b/i, "boq", "Text contains bill/activity schedule structure", 6],
    [/\bdrawing no\.?\b|\brevision\b.{0,12}\bscale\b/i, "drawings", "Text looks like a drawing register", 4],
    [/\binvitation to tender\b|\btenderers are invited\b|\breturn of tenders\b/i, "invitation_to_tender", "Text is an invitation to tender", 7],
    [/\bparticular conditions\b|\bz clauses?\b|\bspecial conditions of contract\b/i, "particular_conditions", "Text contains particular/Z conditions", 7],
    [/\bcontract data\b|\bthe starting date is\b|\bcompletion date for the whole of the works\b/i, "contract_data", "Text matches Contract Data phrasing", 7],
    [/\bworks information\b|\btechnical specification\b|\bpreliminaries\b/i, "specification", "Text contains specification language", 5],
    [/\bconditions of contract\b|\bcore clauses\b|\bgeneral conditions of contract\b/i, "contract_conditions", "Text contains general contract conditions", 5],
  ];
  for (const [re, role, reason, score] of contentRules) {
    if (re.test(text)) hits.push({ role, reason, score });
  }

  if (hits.length === 0) {
    return { role: "other", roleReason: "No filename or text marker was strong enough to classify this file. Classification is descriptive only and is not a contract type." };
  }
  hits.sort((a, b) => b.score - a.score);
  const top = hits[0];
  return { role: top.role, roleReason: top.reason };
}

export function layerFor(doc: Pick<ParsedDocument, "role">, quote: string): "general_conditions" | "project_specific" | "unclear" {
  if (doc.role === "particular_conditions" || doc.role === "contract_data" || doc.role === "invitation_to_tender") {
    return "project_specific";
  }
  if (/\b(z\s*\d+|particular conditions|special conditions|amendment to clause|deleted and replaced|the following clause is deleted)\b/i.test(quote)) {
    return "project_specific";
  }
  if (doc.role === "contract_conditions" || /\b(core clause|general conditions|fidic general conditions|main option|secondary option)\b/i.test(quote)) {
    return "general_conditions";
  }
  return "unclear";
}
