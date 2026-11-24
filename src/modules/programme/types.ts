import type { SourceRef } from "@/modules/document-analysis/types";

export type FieldOrigin = "module-01" | "module-02" | "recommendation" | "user";
export type LinkType = "FS" | "SS" | "FF" | "SF";
export type ActivityKind = "task" | "summary" | "milestone";
export type ActivityStatus = "not_started" | "in_progress" | "completed";
export type ActivityApproval = "recommended" | "edited" | "approved";
export type ProgrammeStatus = "draft" | "approved" | "baseline";
export type WorkingPattern = "monday_friday" | "monday_saturday" | "custom";

export type FilledField<T> = {
  value: T;
  origin: FieldOrigin;
  sourceLabel: string | null;
};

export type ProgrammeSetup = {
  projectName: FilledField<string>;
  client: FilledField<string>;
  consultant: FilledField<string>;
  mainContractor: FilledField<string>;
  location: FilledField<string>;
  contractNumber: FilledField<string>;
  contractType: FilledField<string>;
  contractDuration: FilledField<string>;
  commencementDate: FilledField<string>;
  completionDate: FilledField<string>;
  workingPattern: FilledField<WorkingPattern>;
  hoursPerDay: FilledField<number>;
  workingHours: FilledField<string>;
  saturdays: FilledField<boolean>;
  sundays: FilledField<boolean>;
  publicHolidays: FilledField<"exclude" | "include">;
  holidayDates: FilledField<string[]>;
  annualShutdown: FilledField<string>;
  weatherAllowancePct: FilledField<number | null>;
  generalWorkers: FilledField<number | null>;
  skilledWorkers: FilledField<number | null>;
  supervisors: FilledField<number | null>;
  teams: FilledField<number | null>;
  plant: FilledField<string>;
};

export type ActivityLink = {
  predecessorId: string;
  type: LinkType;
  lagWorkingDays: number;
  origin: FieldOrigin;
  why: string;
};

export type ProgrammeActivity = {
  id: string;
  wbs: string;
  activityId: string;
  name: string;
  kind: ActivityKind;
  parentId: string | null;
  section: string;
  boqRef: string | null;
  drawingRef: string | null;
  quantity: number | null;
  unit: string;
  ratePerDay: number | null;
  teams: number;
  durationWorkingDays: number | null;
  durationManual: boolean;
  durationFormula: string;
  blockedReason: string | null;
  predecessors: ActivityLink[];
  plannedStart: string | null;
  plannedFinish: string | null;
  startConstraint: string | null;
  responsible: string;
  status: ActivityStatus;
  progressPct: number;
  approval: ActivityApproval;
  origin: FieldOrigin;
  activityKey: string | null;
  elementKey: string | null;
  es: number | null;
  ef: number | null;
  ls: number | null;
  lf: number | null;
  totalFloat: number | null;
  freeFloat: number | null;
  critical: boolean;
  sources: SourceRef[];
};

export type ProgrammeWarning = {
  id: string;
  severity: "warning" | "note";
  title: string;
  detail: string;
  activityId: string | null;
};

export type AuditChange = {
  activityId: string | null;
  field: string;
  from: string;
  to: string;
};

export type ConstructionProgramme = {
  module: "programme";
  generatedAt: string;
  projectId: string;
  revision: number;
  status: ProgrammeStatus;
  setup: ProgrammeSetup;
  activities: ProgrammeActivity[];
  warnings: ProgrammeWarning[];
  criticalPath: string[];
  plannedCompletion: string | null;
  contractCompletion: string | null;
  methodology: string[];
  baselineOf: number | null;
};

export type ProgrammeRevisionSummary = {
  id: string;
  revision: number;
  status: ProgrammeStatus;
  createdAt: string;
  activityCount: number;
  plannedCompletion: string | null;
};
