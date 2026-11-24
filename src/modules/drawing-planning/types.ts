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
  elementKey: string;
  elementName: string;
};

/** Current measured slots. More kinds can be added without changing the report shape. */
export const ELEMENT_MEASURE_SLOTS = [
  { kind: "concrete_m3", unit: "m3", label: "Concrete", activityKey: "concrete" },
  { kind: "rebar_t", unit: "t", label: "Reinforcement", activityKey: "reinforcement" },
  { kind: "area_m2", unit: "m2", label: "Area", activityKey: "formwork" },
] as const;

export type ElementMeasureKind = (typeof ELEMENT_MEASURE_SLOTS)[number]["kind"] | (string & {});

export type ElementMeasure = {
  kind: ElementMeasureKind;
  label: string;
  unit: string;
  quantity: number | null;
  complete: boolean;
  formula: string;
  note: string | null;
};

export type MeasuredElement = {
  id: string;
  name: string;
  concreteWork: boolean;
  sourceDrawings: string[];
  measures: ElementMeasure[];
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
  varianceQty: number | null;
  variancePct: number | null;
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
  variant_key: string;
  trade: string;
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
  is_default: boolean;
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
  elements: MeasuredElement[];
  durations: DurationResult[];
  sequence: SequenceItem[];
  methodologyNarrative: string[];
  boqComparison: BoqVariance[];
  risks: PlanningRisk[];
  missingForProgramme: string[];
  handoff: ProgrammeHandoff;
  parsed: Pick<ParsedDocument, "documentId" | "filename" | "role" | "kind" | "warnings">[];
};
