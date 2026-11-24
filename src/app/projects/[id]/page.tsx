import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <Suspense fallback={<p className="text-sm text-ink/55">Opening review…</p>}>
        <ProjectWorkspace projectId={id} />
      </Suspense>
    </AppShell>
  );
}
