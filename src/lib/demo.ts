import { buildSampleTenderPack } from "@/modules/document-analysis";
import { buildSampleDrawingPack } from "@/modules/drawing-planning";
import type { DrawingPlanningReport } from "@/modules/drawing-planning/types";
import type { TenderReviewReport } from "@/modules/document-analysis/types";
import type { ConstructionProgramme } from "@/modules/programme/types";
import { generateAndSaveProgramme } from "./programmes";
import { addDocuments, createProject, runAnalysis, runDrawingAnalysis } from "./projects";

export const DEMO_PROJECT_NAME = "Riverside Primary School Extension";

export async function runRiversideDemo(ownerId: string): Promise<{
  projectId: string;
  report: TenderReviewReport;
  drawingReport: DrawingPlanningReport;
  programme: ConstructionProgramme;
}> {
  const project = await createProject(ownerId, DEMO_PROJECT_NAME);
  const [tender, drawings] = await Promise.all([buildSampleTenderPack(), buildSampleDrawingPack()]);
  await addDocuments(project.id, [...tender, ...drawings]);
  const report = await runAnalysis(ownerId, project.id);
  const drawingReport = await runDrawingAnalysis(ownerId, project.id);
  const programme = await generateAndSaveProgramme(ownerId, project.id);
  return { projectId: project.id, report, drawingReport, programme };
}
