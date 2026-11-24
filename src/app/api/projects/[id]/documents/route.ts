import { jsonError, jsonOk, ownerKey, requireViewer } from "@/lib/auth";
import { addDocument, getProject } from "@/lib/projects";
import { MAX_FILE_BYTES } from "@/modules/document-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_EXT = /\.(pdf|docx|xlsx|xls|txt)$/i;

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
  if (files.length === 0) return jsonError(400, "no_files", "Attach one or more PDF, Word or Excel files.");

  const saved = [];
  for (const file of files) {
    if (!ALLOWED_EXT.test(file.name)) {
      return jsonError(400, "unsupported_type", `${file.name} is not a PDF, Word or Excel file.`);
    }
    if (file.size > MAX_FILE_BYTES) {
      return jsonError(400, "too_large", `${file.name} is larger than 15 MB.`);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const row = await addDocument({
      projectId: id,
      filename: file.name,
      mime: file.type || "application/octet-stream",
      bytes,
    });
    saved.push({
      id: row.id,
      filename: row.filename,
      mime: row.mime,
      byte_size: row.byte_size,
    });
  }
  return jsonOk({ documents: saved }, 201);
}
