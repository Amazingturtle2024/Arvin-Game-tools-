export type DocumentKind = "pdf" | "docx" | "xlsx" | "txt" | "image" | "unsupported";

export type DocumentRole =
  | "contract_conditions"
  | "contract_data"
  | "particular_conditions"
  | "invitation_to_tender"
  | "specification"
  | "boq"
  | "drawings"
  | "other";

export type FactCategory =
  | "contract_identity"
  | "project_details"
  | "scope"
  | "specifications"
  | "boq"
  | "time"
  | "money"
  | "obligations"
  | "clauses"
  | "amendments"
  | "eot"
  | "penalties";

export type FactLayer = "general_conditions" | "project_specific" | "unclear";

export type SourceRef = {
  documentId: string;
  documentName: string;
  page: number | null;
  sheet: string | null;
  row: number | null;
  heading: string | null;
  clause: string | null;
  quote: string;
  locationLabel: string;
};

export type ExtractedFact = {
  id: string;
  field: string;
  label: string;
  category: FactCategory;
  value: string;
  source: SourceRef;
  layer: FactLayer;
  verification: "extracted" | "unverified";
  origin: "document" | "model_assisted";
};

export type TextUnit = {
  text: string;
  page: number | null;
  sheet: string | null;
  row: number | null;
  heading: string | null;
};

export type ParsedDocument = {
  documentId: string;
  filename: string;
  mime: string;
  kind: DocumentKind;
  role: DocumentRole;
  roleReason: string;
  units: TextUnit[];
  fullText: string;
  warnings: string[];
  pageCount: number | null;
  sheetNames: string[];
};

export type MissingItem = {
  field: string;
  label: string;
  whyItMatters: string;
  status: "missing" | "incomplete";
};

export type ConflictItem = {
  field: string;
  label: string;
  values: string[];
  facts: ExtractedFact[];
  note: string;
};

export type RiskItem = {
  id: string;
  title: string;
  category: "time" | "cost" | "scope" | "contract" | "interface" | "records";
  evidence: ExtractedFact[];
  note: string;
};

export type BoqSummary = {
  found: boolean;
  sheetCount: number;
  itemCount: number | null;
  sections: string[];
  totals: { label: string; value: string; source: SourceRef }[];
  notes: string[];
};

export type ContractFinding = {
  status: "identified" | "not_stated" | "conflicting";
  family: string | null;
  edition: string | null;
  option: string | null;
  facts: ExtractedFact[];
  note: string;
};

export type TenderReviewReport = {
  module: "document-analysis";
  generatedAt: string;
  projectId: string;
  projectName: string;
  methodology: string[];
  documents: {
    documentId: string;
    filename: string;
    kind: DocumentKind;
    role: DocumentRole;
    roleReason: string;
    pageCount: number | null;
    warnings: string[];
  }[];
  contract: ContractFinding;
  projectDetails: ExtractedFact[];
  scopeOfWorks: ExtractedFact[];
  specifications: ExtractedFact[];
  boq: BoqSummary;
  timeProvisions: ExtractedFact[];
  money: ExtractedFact[];
  penalties: ExtractedFact[];
  eot: ExtractedFact[];
  obligations: ExtractedFact[];
  clauses: ExtractedFact[];
  amendments: ExtractedFact[];
  missingInformation: MissingItem[];
  conflicts: ConflictItem[];
  risks: RiskItem[];
  unverified: ExtractedFact[];
  discardedUncitedModelClaims: number;
};
