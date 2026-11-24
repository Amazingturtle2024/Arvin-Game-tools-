import { jsonError, jsonOk, ownerKey, requireViewer } from "@/lib/auth";
import { runAnalysis } from "@/lib/projects";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await params;
  try {
    const report = await runAnalysis(ownerKey(viewer), id);
    return jsonOk({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    const status = message === "Project not found" ? 404 : 400;
    return jsonError(status, "analyze_failed", message);
  }
}
