import { jsonError, jsonOk, ownerKey, requireViewer } from "@/lib/auth";
import { addDocuments, getProject } from "@/lib/projects";
import { validateUploadList } from "@/lib/uploads";

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

  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const invalid = validateUploadList(files);
  if (invalid) return jsonError(400, "invalid_upload", invalid);

  const prepared = [];
  for (const file of files) {
    prepared.push({
      filename: file.name,
      mime: file.type || "application/octet-stream",
      bytes: Buffer.from(await file.arrayBuffer()),
    });
  }
  const saved = await addDocuments(id, prepared);
  return jsonOk({
    documents: saved.map((row) => ({
      id: row.id,
      filename: row.filename,
      mime: row.mime,
      byte_size: row.byte_size,
    })),
  }, 201);
}
