import { jsonError, jsonOk, ownerKey, requireViewer } from "@/lib/auth";
import { deleteProject, getProject, latestDrawingReport, latestReport, listDocuments } from "@/lib/projects";
import { listRates } from "@/lib/rates";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await params;
  const project = await getProject(ownerKey(viewer), id);
  if (!project) return jsonError(404, "not_found");
  const documents = await listDocuments(id);
  const report = await latestReport(id);
  const drawingReport = await latestDrawingReport(id);
  const rates = await listRates(ownerKey(viewer));
  return jsonOk({
    project,
    rates,
    drawingReport,
    documents: documents.map((d) => ({
      id: d.id,
      filename: d.filename,
      mime: d.mime,
      byte_size: d.byte_size,
      created_at: d.created_at,
      parsed: d.parsed
        ? {
            kind: d.parsed.kind,
            role: d.parsed.role,
            roleReason: d.parsed.roleReason,
            pageCount: d.parsed.pageCount,
            warnings: d.parsed.warnings,
            sheetNames: d.parsed.sheetNames,
          }
        : null,
    })),
    report,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await params;
  const ok = await deleteProject(ownerKey(viewer), id);
  if (!ok) return jsonError(404, "not_found");
  return jsonOk({ ok: true });
}
