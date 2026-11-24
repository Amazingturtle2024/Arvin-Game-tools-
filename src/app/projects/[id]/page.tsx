import { AppShell } from "@/components/AppShell";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <ProjectWorkspace projectId={id} />
    </AppShell>
  );
}
