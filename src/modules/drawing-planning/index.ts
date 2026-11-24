import { parseDocument } from "@/modules/document-analysis";
import type { ParsedDocument } from "@/modules/document-analysis/types";
import { buildDrawingReport } from "./report";
import type { DrawingPlanningReport, ProductionRate } from "./types";

export { buildDrawingReport } from "./report";
export { buildSampleDrawingPack } from "./sample";
export { drawingReportWorkbook } from "./excel";
export { STARTER_RATES } from "./starter-rates";
export type { DrawingPlanningReport, ProductionRate } from "./types";

export async function analyzeDrawings(input: {
  projectId: string;
  projectName: string;
  files: Array<{ documentId: string; filename: string; mime: string; bytes: Buffer }>;
  parsed?: ParsedDocument[];
  rates: ProductionRate[];
}): Promise<DrawingPlanningReport> {
  const parsed: ParsedDocument[] = input.parsed ? [...input.parsed] : [];
  if (parsed.length === 0) {
    for (const file of input.files) {
      parsed.push(await parseDocument(file));
    }
  }
  return buildDrawingReport({
    projectId: input.projectId,
    projectName: input.projectName,
    docs: parsed,
    rates: input.rates,
  });
}
