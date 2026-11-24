import { jsonError, jsonOk, ownerKey, requireViewer } from "@/lib/auth";
import { runRiversideDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  try {
    const demo = await runRiversideDemo(ownerKey(viewer));
    return jsonOk({
      projectId: demo.projectId,
      programmeRevision: demo.programme.revision,
      plannedCompletion: demo.programme.plannedCompletion,
    }, 201);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Could not build the Riverside demo.";
    return jsonError(400, "demo_failed", detail);
  }
}
