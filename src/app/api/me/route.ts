import { jsonOk, optionalViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await optionalViewer(request);
  if (!viewer) {
    return jsonOk({ signedIn: false });
  }
  return jsonOk({
    signedIn: true,
    name: viewer.name,
    email: viewer.email,
    simulated: Boolean(viewer.simulated),
    kind: viewer.kind,
  });
}
