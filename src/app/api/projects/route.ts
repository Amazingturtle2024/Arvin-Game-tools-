import { jsonOk, ownerKey, requireViewer } from "@/lib/auth";
import { createProject, listProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const projects = await listProjects(ownerKey(viewer));
  return jsonOk({ projects });
}

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  let name = "Untitled review";
  try {
    const body = await request.json() as { name?: string };
    if (typeof body.name === "string") name = body.name;
  } catch {
    // empty body is fine
  }
  const project = await createProject(ownerKey(viewer), name);
  return jsonOk({ project }, 201);
}
