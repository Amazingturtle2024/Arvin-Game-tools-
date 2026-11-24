import type { ProgrammeHandoff } from "@/kernel/handoff";
import type { ParsedDocument, SourceRef } from "@/modules/document-analysis/types";

export type DrawingKind =
  | "general_arrangement"
  | "civil"
  | "structural"
  | "architectural"
  | "reinforcement"
  | "foundation"
  | "drainage"
  | "roadworks"
  | "section_elevation"
  | "detail"
  | "other_drawing";

export type Measurement = {
  id: string;
  kind: "length" | "width" | "depth" | "height" | "diameter" | "thickness" | "level" | "count" | "area" | "volume" | "other";
  label: string;
  value: number;
  unit: string;
  raw: string;
  source: SourceRef;
};

export type DrawingIdentity = {
  documentId: string;
  documentName: string;
  drawingKind: DrawingKind;
  drawingNumber: string | null;
  revision: string | null;
  scale: string | null;
  title: string | null;
  source: SourceRef;
  warnings: string[];
};

export type QuantityTakeoff = {
  id: string;
  activityKey: string;
  label: string;
  unit: string;
  quantity: number;
  formula: string;
  inputs: { label: string; value: string; source: SourceRef }[];
  assumptions: string[];
  sourceDrawings: string[];
  complete: boolean;
};

export type DurationResult = {
  activityKey: string;
  label: string;
  quantity: number;
  unit: string;
  ratePerDay: number | null;
  teams: number;
  hoursPerDay: number;
  daysPerWeek: number;
  weatherAllowancePct: number;
  effectiveDaily: number | null;
  durationWorkingDays: number | null;
  calendarWeeks: number | null;
  formula: string;
  blockedReason: string | null;
  plant: string;
  workers: number;
  siteConditions: string;
  accessibility: string;
};

export type SequenceItem = {
  activityKey: string;
  name: string;
  predecessors: string[];
  concurrentWith: string[];
  why: string;
};

export type BoqVariance = {
  status: "match" | "difference" | "boq_only" | "drawing_only";
  boqItem: string | null;
  drawingItem: string | null;
  unit: string;
  boqQty: number | null;
  drawingQty: number | null;
  note: string;
  sources: SourceRef[];
};

export type PlanningRisk = {
  id: string;
  title: string;
  category: "time" | "quantity" | "information" | "sequence" | "procurement";
  note: string;
  sources: SourceRef[];
};

export type ProductionRate = {
  id: string;
  owner_id: string;
  activity_key: string;
  label: string;
  unit: string;
  rate_per_day: number | null;
  workers: number;
  teams: number;
  plant: string;
  hours_per_day: number;
  days_per_week: number;
  site_conditions: string;
  accessibility: string;
  weather_allowance_pct: number;
  notes: string;
};

export type DrawingPlanningReport = {
  module: "drawing-planning";
  generatedAt: string;
  projectId: string;
  projectName: string;
  methodology: string[];
  drawings: DrawingIdentity[];
  measurements: Measurement[];
  discrepancies: { title: string; note: string; sources: SourceRef[] }[];
  takeoff: QuantityTakeoff[];
  durations: DurationResult[];
  sequence: SequenceItem[];
  methodologyNarrative: string[];
  boqComparison: BoqVariance[];
  risks: PlanningRisk[];
  missingForProgramme: string[];
  handoff: ProgrammeHandoff;
  parsed: Pick<ParsedDocument, "documentId" | "filename" | "role" | "kind" | "warnings">[];
};
