import { jsonError, ownerKey, requireViewer } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { latestProgramme } from "@/lib/programmes";
import { programmeMspXml, programmePdf, programmeWorkbook } from "@/modules/programme";

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
  const programme = await latestProgramme(id);
  if (!programme) return jsonError(404, "no_programme", "Build a programme before exporting.");
  const format = new URL(request.url).searchParams.get("format") || "xlsx";
  const base = `${project.name.replace(/[^\w]+/g, "-").toLowerCase()}-programme-r${programme.revision}`;
  if (format === "xml" || format === "msp") {
    const xml = programmeMspXml(programme);
    return new Response(xml, {
      headers: {
        "content-type": "application/vnd.ms-project",
        "content-disposition": `attachment; filename="${base}.xml"`,
        "cache-control": "private, no-store",
      },
    });
  }
  if (format === "pdf") {
    const bytes = await programmePdf(programme);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${base}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  }
  const bytes = programmeWorkbook(programme);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${base}.xlsx"`,
      "cache-control": "private, no-store",
    },
  });
}
