import { jsonError, jsonOk, ownerKey, requireViewer } from "@/lib/auth";
import { listRates, saveRates } from "@/lib/rates";
import type { ProductionRate } from "@/modules/drawing-planning/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const rates = await listRates(ownerKey(viewer));
  return jsonOk({ rates });
}

export async function PUT(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  let rates: Partial<ProductionRate>[] = [];
  try {
    const body = await request.json() as { rates?: Partial<ProductionRate>[] };
    rates = Array.isArray(body.rates) ? body.rates.slice(0, 2000) : [];
  } catch {
    return jsonError(400, "invalid_json");
  }
  const saved = await saveRates(ownerKey(viewer), rates);
  return jsonOk({ rates: saved });
}
