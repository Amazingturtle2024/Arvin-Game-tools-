import { jsonError, jsonOk, ownerKey, requireViewer } from "@/lib/auth";
import { runDrawingAnalysis } from "@/lib/projects";

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
    const report = await runDrawingAnalysis(ownerKey(viewer), id);
    return jsonOk({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Take-off failed";
    return jsonError(message === "Project not found" ? 404 : 400, "drawing_failed", message);
  }
}
