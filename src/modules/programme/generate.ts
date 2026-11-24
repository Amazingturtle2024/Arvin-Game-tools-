import type { TenderReviewReport } from "@/modules/document-analysis/types";
import type { DrawingPlanningReport, ProductionRate } from "@/modules/drawing-planning/types";
import { applySchedule } from "./apply";
import { buildActivities } from "./build";
import { seedSetup } from "./seed";
import type { ConstructionProgramme, ProgrammeActivity, ProgrammeSetup } from "./types";

export function generateProgramme(input: {
  projectId: string;
  projectName: string;
  tender: TenderReviewReport | null;
  drawings: DrawingPlanningReport | null;
  rates: ProductionRate[];
  previous?: ConstructionProgramme | null;
  setup?: ProgrammeSetup | null;
  revision: number;
}): ConstructionProgramme {
  const setup = input.setup ?? input.previous?.setup ?? seedSetup({
    projectName: input.projectName,
    tender: input.tender,
    drawings: input.drawings,
    rates: input.rates,
  });
  const generated = buildActivities({
    tender: input.tender,
    drawings: input.drawings,
    rates: input.rates,
    setup,
  });
  const activities = mergeApproved(input.previous?.activities ?? [], generated);
  return applySchedule({
    module: "programme",
    generatedAt: new Date().toISOString(),
    projectId: input.projectId,
    revision: input.revision,
    status: "draft",
    setup,
    activities,
    warnings: [],
    criticalPath: [],
    plannedCompletion: null,
    contractCompletion: setup.completionDate.value || null,
    baselineOf: null,
    methodology: [
      "The programme is built from Module 01 contract data and Module 02 measured quantities. Missing information is left blank.",
      "Duration = quantity ÷ (rate per day × teams × hours/8 when hours are not 8) × (1 + weather %). Working days follow the selected calendar.",
      "Relationships are planner recommendations (FS / SS / FF / SF). They are not used until you keep or edit them.",
      "Approved activities are not rewritten when the programme is regenerated.",
      "Nothing is written to Microsoft Project until you export MSP XML.",
    ],
  });
}

function mergeApproved(previous: ProgrammeActivity[], generated: ProgrammeActivity[]): ProgrammeActivity[] {
  const approved = previous.filter((a) => a.approval === "approved");
  if (!approved.length) return generated;
  const idMap = mapPreviousIds(previous, generated);
  const liveIds = new Set(generated.map((row) => row.id));
  const used = new Set<string>();
  return generated.map((row) => {
    if (row.kind === "summary") return row;
    const match = approved.find((a) => !used.has(a.id) && sameWork(a, row));
    if (!match) return row;
    used.add(match.id);
    return {
      ...match,
      id: row.id,
      wbs: row.wbs,
      activityId: row.activityId,
      parentId: row.parentId,
      section: row.section,
      predecessors: match.predecessors
        .map((link) => ({ ...link, predecessorId: idMap.get(link.predecessorId) ?? link.predecessorId }))
        .filter((link) => liveIds.has(link.predecessorId) && link.predecessorId !== row.id),
    };
  });
}

function mapPreviousIds(previous: ProgrammeActivity[], generated: ProgrammeActivity[]): Map<string, string> {
  const used = new Set<string>();
  const map = new Map<string, string>();
  for (const row of generated) {
    if (row.kind === "summary") continue;
    const match = previous.find((a) => !used.has(a.id) && sameWork(a, row));
    if (!match) continue;
    used.add(match.id);
    map.set(match.id, row.id);
  }
  return map;
}

function sameWork(a: ProgrammeActivity, b: ProgrammeActivity): boolean {
  return a.kind === b.kind
    && a.activityKey === b.activityKey
    && a.elementKey === b.elementKey
    && a.name === b.name;
}
