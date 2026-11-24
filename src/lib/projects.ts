import { randomUUID } from "node:crypto";
import { sql } from "./db";
import { analyzeDocuments, MAX_FILE_BYTES, parseDocument } from "@/modules/document-analysis";
import type { ParsedDocument, TenderReviewReport } from "@/modules/document-analysis/types";

export type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  status: string;
};

export type DocumentRow = {
  id: string;
  project_id: string;
  filename: string;
  mime: string;
  byte_size: number;
  created_at: string;
  parsed: ParsedDocument | null;
};

export async function listProjects(ownerId: string): Promise<ProjectRow[]> {
  return sql<ProjectRow>(
    "select id, owner_id, name, created_at::text, updated_at::text, status from projects where owner_id = $1 order by updated_at desc",
    [ownerId],
  );
}

export async function getProject(ownerId: string, id: string): Promise<ProjectRow | null> {
  const rows = await sql<ProjectRow>(
    "select id, owner_id, name, created_at::text, updated_at::text, status from projects where id = $1 and owner_id = $2",
    [id, ownerId],
  );
  return rows[0] ?? null;
}

export async function createProject(ownerId: string, name: string): Promise<ProjectRow> {
  const id = randomUUID();
  const rows = await sql<ProjectRow>(
    "insert into projects (id, owner_id, name) values ($1, $2, $3) returning id, owner_id, name, created_at::text, updated_at::text, status",
    [id, ownerId, name.trim().slice(0, 160) || "Untitled review"],
  );
  return rows[0];
}

export async function deleteProject(ownerId: string, id: string): Promise<boolean> {
  const rows = await sql<{ id: string }>("delete from projects where id = $1 and owner_id = $2 returning id", [id, ownerId]);
  return rows.length > 0;
}

export async function listDocuments(projectId: string): Promise<DocumentRow[]> {
  return sql<DocumentRow>(
    "select id, project_id, filename, mime, byte_size, created_at::text, parsed from documents where project_id = $1 order by created_at asc",
    [projectId],
  );
}

export async function addDocument(input: {
  projectId: string;
  filename: string;
  mime: string;
  bytes: Buffer;
}): Promise<DocumentRow> {
  if (input.bytes.length > MAX_FILE_BYTES) {
    throw new Error(`File exceeds the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB limit.`);
  }
  const id = randomUUID();
  const parsed = await parseDocument({
    documentId: id,
    filename: input.filename,
    mime: input.mime,
    bytes: input.bytes,
  });
  const rows = await sql<DocumentRow>(
    "insert into documents (id, project_id, filename, mime, byte_size, bytes, parsed) values ($1, $2, $3, $4, $5, $6, $7::jsonb) returning id, project_id, filename, mime, byte_size, created_at::text, parsed",
    [id, input.projectId, input.filename.slice(0, 200), input.mime.slice(0, 120), input.bytes.length, input.bytes, JSON.stringify(parsed)],
  );
  await sql("update projects set updated_at = now(), status = 'documents' where id = $1", [input.projectId]);
  return rows[0];
}

export async function deleteDocument(ownerId: string, projectId: string, docId: string): Promise<boolean> {
  const project = await getProject(ownerId, projectId);
  if (!project) return false;
  const rows = await sql<{ id: string }>(
    "delete from documents where id = $1 and project_id = $2 returning id",
    [docId, projectId],
  );
  return rows.length > 0;
}

export async function latestReport(projectId: string): Promise<TenderReviewReport | null> {
  const rows = await sql<{ report: TenderReviewReport }>(
    "select report from analysis_runs where project_id = $1 order by created_at desc limit 1",
    [projectId],
  );
  return rows[0]?.report ?? null;
}

export async function runAnalysis(ownerId: string, projectId: string): Promise<TenderReviewReport> {
  const project = await getProject(ownerId, projectId);
  if (!project) throw new Error("Project not found");
  const files = await sql<{ id: string; filename: string; mime: string; bytes: Buffer | Uint8Array }>(
    "select id, filename, mime, bytes from documents where project_id = $1",
    [projectId],
  );
  if (files.length === 0) throw new Error("Upload at least one document before running the review.");
  const { report } = await analyzeDocuments({
    projectId,
    projectName: project.name,
    files: files.map((file) => ({
      documentId: file.id,
      filename: file.filename,
      mime: file.mime,
      bytes: Buffer.from(file.bytes),
    })),
  });
  await sql(
    "insert into analysis_runs (id, project_id, report) values ($1, $2, $3::jsonb)",
    [randomUUID(), projectId, JSON.stringify(report)],
  );
  await sql("update projects set updated_at = now(), status = 'reviewed' where id = $1", [projectId]);
  return report;
}
