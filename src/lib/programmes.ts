import { randomUUID } from "node:crypto";
import { applySchedule, diffProgrammes, generateProgramme } from "@/modules/programme";
import type { ConstructionProgramme, ProgrammeRevisionSummary } from "@/modules/programme/types";
import { sql } from "./db";
import { getProject, latestDrawingReport, latestReport } from "./projects";
import { listRates } from "./rates";

type ProgrammeRow = {
  id: string;
  project_id: string;
  revision: number;
  status: ConstructionProgramme["status"];
  programme: ConstructionProgramme;
  created_at: string;
};

export async function latestProgramme(projectId: string): Promise<ConstructionProgramme | null> {
  const rows = await sql<ProgrammeRow>(
    "select id, project_id, revision, status, programme, created_at::text from programmes where project_id = $1 order by revision desc limit 1",
    [projectId],
  );
  return rows[0]?.programme ?? null;
}

export async function listProgrammeRevisions(projectId: string): Promise<ProgrammeRevisionSummary[]> {
  const rows = await sql<ProgrammeRow>(
    "select id, project_id, revision, status, programme, created_at::text from programmes where project_id = $1 order by revision desc",
    [projectId],
  );
  return rows.map((row) => ({
    id: row.id,
    revision: row.revision,
    status: row.status,
    createdAt: row.created_at,
    activityCount: row.programme.activities.filter((a) => a.kind !== "summary").length,
    plannedCompletion: row.programme.plannedCompletion,
  }));
}

export async function generateAndSaveProgramme(ownerId: string, projectId: string): Promise<ConstructionProgramme> {
  const project = await getProject(ownerId, projectId);
  if (!project) throw new Error("Project not found");
  const tender = await latestReport(projectId);
  const drawings = await latestDrawingReport(projectId);
  if (!tender && !drawings) {
    throw new Error("Run the tender review or drawing take-off before building a programme.");
  }
  const previous = await latestProgramme(projectId);
  const rates = await listRates(ownerId);
  const revision = (previous?.revision ?? 0) + 1;
  const programme = generateProgramme({
    projectId,
    projectName: project.name,
    tender,
    drawings,
    rates,
    previous,
    revision,
  });
  await persist(ownerId, projectId, programme, previous, "generate");
  await sql("update projects set updated_at = now(), status = 'programmed' where id = $1", [projectId]);
  return programme;
}

export async function saveProgramme(
  ownerId: string,
  projectId: string,
  incoming: ConstructionProgramme,
): Promise<ConstructionProgramme> {
  const project = await getProject(ownerId, projectId);
  if (!project) throw new Error("Project not found");
  const previous = await latestProgramme(projectId);
  const programme = applySchedule({
    ...incoming,
    projectId,
    revision: previous?.revision ?? incoming.revision ?? 1,
    status: previous?.status === "baseline" ? "draft" : incoming.status === "baseline" ? previous?.status ?? "draft" : incoming.status,
  });
  await persist(ownerId, projectId, programme, previous, "save");
  return programme;
}

export async function approveProgramme(
  ownerId: string,
  projectId: string,
  asBaseline: boolean,
): Promise<ConstructionProgramme> {
  const previous = await latestProgramme(projectId);
  if (!previous) throw new Error("Build a programme before approving it.");
  const approved = applySchedule({
    ...previous,
    status: asBaseline ? "baseline" : "approved",
    activities: previous.activities.map((a) => (a.kind === "summary" ? a : { ...a, approval: "approved" })),
    baselineOf: asBaseline ? previous.revision : previous.baselineOf,
  });
  await persist(ownerId, projectId, approved, previous, asBaseline ? "baseline" : "approve");
  return approved;
}

async function persist(
  ownerId: string,
  projectId: string,
  programme: ConstructionProgramme,
  previous: ConstructionProgramme | null,
  action: string,
): Promise<void> {
  const id = randomUUID();
  const revision = programme.revision;
  const existing = await sql<{ id: string }>(
    "select id from programmes where project_id = $1 and revision = $2",
    [projectId, revision],
  );
  if (existing[0]) {
    await sql(
      "update programmes set status = $1, programme = $2::jsonb where id = $3",
      [programme.status, JSON.stringify(programme), existing[0].id],
    );
    await sql(
      "insert into programme_audit (id, project_id, programme_id, revision, actor, action, changes) values ($1, $2, $3, $4, $5, $6, $7::jsonb)",
      [randomUUID(), projectId, existing[0].id, revision, ownerId, action, JSON.stringify(diffProgrammes(previous, programme))],
    );
    return;
  }
  await sql(
    "insert into programmes (id, project_id, revision, status, programme) values ($1, $2, $3, $4, $5::jsonb)",
    [id, projectId, revision, programme.status, JSON.stringify(programme)],
  );
  await sql(
    "insert into programme_audit (id, project_id, programme_id, revision, actor, action, changes) values ($1, $2, $3, $4, $5, $6, $7::jsonb)",
    [randomUUID(), projectId, id, revision, ownerId, action, JSON.stringify(diffProgrammes(previous, programme))],
  );
}

export async function programmeAudit(projectId: string): Promise<Array<{ at: string; action: string; revision: number; changes: unknown }>> {
  return sql(
    "select at::text, action, revision, changes from programme_audit where project_id = $1 order by at desc limit 50",
    [projectId],
  );
}
