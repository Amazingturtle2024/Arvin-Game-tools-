import { getIdentity, requireIdentity } from "../../cursor/identity.js";

export type Viewer = {
  verified: true;
  sub: string;
  email: string;
  name: string;
  kind: "person" | "key";
  stage?: "production" | "preview";
  simulated?: boolean;
};

export async function requireViewer(request: Request): Promise<Viewer | Response> {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  return identity as Viewer;
}

export async function optionalViewer(request: Request): Promise<Viewer | null> {
  const identity = await getIdentity(request);
  if (!identity?.verified) return null;
  return identity as Viewer;
}

export function ownerKey(viewer: Viewer): string {
  const stage = viewer.stage === "preview" ? "preview" : "production";
  return `${stage}:${viewer.sub}`;
}

export function jsonError(status: number, error: string, detail?: string): Response {
  return Response.json(
    { error, detail },
    { status, headers: { "cache-control": "private, no-store" } },
  );
}

export function jsonOk(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}
