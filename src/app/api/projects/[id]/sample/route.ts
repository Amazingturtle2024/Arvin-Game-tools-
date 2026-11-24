import { jsonError, jsonOk, ownerKey, requireViewer } from "@/lib/auth";
import { addDocument, getProject } from "@/lib/projects";
import { buildSampleTenderPack } from "@/modules/document-analysis";

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
  const pack = await buildSampleTenderPack();
  const documents = [];
  for (const file of pack) {
    const row = await addDocument({
      projectId: id,
      filename: file.filename,
      mime: file.mime,
      bytes: file.bytes,
    });
    documents.push({ id: row.id, filename: row.filename, byte_size: row.byte_size });
  }
  return jsonOk({ documents }, 201);
}
