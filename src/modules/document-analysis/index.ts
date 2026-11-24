import { enrichWithModel } from "./llm";
import { parseDocument } from "./parse";
import { buildReport } from "./report";
import { resetFactIds } from "./extract-facts";
import type { ParsedDocument, TenderReviewReport } from "./types";

export { parseDocument } from "./parse";
export { buildReport } from "./report";
export { buildSampleTenderPack } from "./sample-pack";
export { MAX_FILE_BYTES } from "./parse";
export type { ParsedDocument, TenderReviewReport } from "./types";

export async function analyzeDocuments(input: {
  projectId: string;
  projectName: string;
  files: Array<{ documentId: string; filename: string; mime: string; bytes: Buffer }>;
}): Promise<{ report: TenderReviewReport; parsed: ParsedDocument[] }> {
  resetFactIds();
  const parsed: ParsedDocument[] = [];
  for (const file of input.files) {
    parsed.push(await parseDocument(file));
  }
  const model = await enrichWithModel(parsed);
  const report = buildReport({
    projectId: input.projectId,
    projectName: input.projectName,
    docs: parsed,
    extraFacts: model.facts,
    discardedUncitedModelClaims: model.discarded,
  });
  return { report, parsed };
}
