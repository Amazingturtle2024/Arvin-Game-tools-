import { jsonError, jsonOk, ownerKey, requireViewer } from "@/lib/auth";
import {
  approveProgramme,
  generateAndSaveProgramme,
  latestProgramme,
  listProgrammeRevisions,
  programmeAudit,
  saveProgramme,
} from "@/lib/programmes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await params;
  const programme = await latestProgramme(id);
  const revisions = await listProgrammeRevisions(id);
  const audit = await programmeAudit(id);
  return jsonOk({ programme, revisions, audit });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { action?: string; baseline?: boolean };
  try {
    if (body.action === "approve") {
      const programme = await approveProgramme(ownerKey(viewer), id, Boolean(body.baseline));
      return jsonOk({ programme });
    }
    const programme = await generateAndSaveProgramme(ownerKey(viewer), id);
    return jsonOk({ programme });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Programme failed.";
    return jsonError(400, "programme_failed", detail);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { programme?: unknown } | null;
  if (!body?.programme || typeof body.programme !== "object") {
    return jsonError(400, "invalid", "Send the programme to recalculate.");
  }
  try {
    const programme = await saveProgramme(ownerKey(viewer), id, body.programme as never);
    return jsonOk({ programme });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Save failed.";
    return jsonError(400, "save_failed", detail);
  }
}
