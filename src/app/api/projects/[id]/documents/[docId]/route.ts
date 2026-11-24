import { jsonError, jsonOk, ownerKey, requireViewer } from "@/lib/auth";
import { deleteDocument } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id, docId } = await params;
  const ok = await deleteDocument(ownerKey(viewer), id, docId);
  if (!ok) return jsonError(404, "not_found");
  return jsonOk({ ok: true });
}
