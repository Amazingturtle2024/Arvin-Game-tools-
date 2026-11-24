import { jsonError, ownerKey, requireViewer } from "@/lib/auth";
import { getProject, latestDrawingReport } from "@/lib/projects";
import { drawingReportWorkbook } from "@/modules/drawing-planning";

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
  const report = await latestDrawingReport(id);
  if (!report) return jsonError(404, "no_report", "Run the drawing take-off before exporting.");
  const bytes = drawingReportWorkbook(report);
  const filename = `${project.name.replace(/[^\w]+/g, "-").toLowerCase()}-drawing-takeoff.xlsx`;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
