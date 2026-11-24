import type { SourceRef } from "@/modules/document-analysis/types";

/** Shape Module 02 hands to Module 03 (programme / MS Project XML). */
export type ProgrammeHandoff = {
  module: "drawing-planning";
  generatedAt: string;
  projectId: string;
  calendar: {
    hoursPerDay: number;
    daysPerWeek: number;
  };
  activities: ProgrammeActivity[];
};

export type ProgrammeActivity = {
  id: string;
  name: string;
  wbs: string;
  quantity: number;
  unit: string;
  durationWorkingDays: number;
  teams: number;
  plant: string;
  predecessors: Array<{ id: string; type: "FS" | "SS"; lagDays: number }>;
  canRunWith: string[];
  quantityAudit: SourceRef[];
  rateAudit: {
    rateId: string;
    label: string;
    ratePerDay: number;
    unit: string;
  };
  formula: string;
};
