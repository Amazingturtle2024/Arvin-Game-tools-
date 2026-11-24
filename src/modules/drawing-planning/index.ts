import { parseDocument } from "@/modules/document-analysis";
import type { ParsedDocument } from "@/modules/document-analysis/types";
import { PROJECTCONTROLS_RATES } from "./projectcontrols-rates";
import { buildDrawingReport } from "./report";
import { MASTER_RATES, STARTER_RATES } from "./starter-rates";
import type { DrawingPlanningReport, ProductionRate } from "./types";

export { buildDrawingReport } from "./report";
export { buildSampleDrawingPack } from "./sample";
export { drawingReportWorkbook } from "./excel";
export { PROJECTCONTROLS_RATES, MASTER_RATES, STARTER_RATES };
export const CATALOGUE_RATES = [...MASTER_RATES, ...PROJECTCONTROLS_RATES];
export { selectRate } from "./select-rate";
export type { DrawingPlanningReport, MeasuredElement, ProductionRate } from "./types";

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
