import { jsonError, jsonOk, ownerKey, requireViewer } from "@/lib/auth";
import { addDocuments, getProject } from "@/lib/projects";
import { buildSampleDrawingPack } from "@/modules/drawing-planning";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await params;
  const project = await getProject(ownerKey(viewer), id);
  if (!project) return jsonError(404, "not_found");
  const pack = await buildSampleDrawingPack();
  const documents = await addDocuments(id, pack);
  return jsonOk({ documents: documents.map((d) => ({ id: d.id, filename: d.filename })) }, 201);
}
