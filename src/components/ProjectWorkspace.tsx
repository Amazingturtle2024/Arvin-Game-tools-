"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ReportView } from "./ReportView";
import type { TenderReviewReport } from "@/modules/document-analysis/types";

type Doc = {
  id: string;
  filename: string;
  mime: string;
  byte_size: number;
  parsed: {
    kind: string;
    role: string;
    roleReason: string;
    pageCount: number | null;
    warnings: string[];
  } | null;
};

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const [name, setName] = useState("Review");
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [report, setReport] = useState<TenderReviewReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [drag, setDrag] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.detail || data.error || "Could not load this review.");
      return;
    }
    setName(data.project.name);
    setDocuments(data.documents);
    setReport(data.report);
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function upload(files: FileList | File[]) {
    const list = [...files];
    if (list.length === 0) return;
    setBusy("Uploading");
    setError("");
    const form = new FormData();
    for (const file of list) form.append("files", file);
    const response = await fetch(`/api/projects/${projectId}/documents`, { method: "POST", body: form });
    const data = await response.json();
    setBusy("");
    if (!response.ok) {
      setError(data.detail || data.error || "Upload failed.");
      return;
    }
    await refresh();
  }

  async function loadSample() {
    setBusy("Building sample pack");
    setError("");
    const response = await fetch(`/api/projects/${projectId}/sample`, { method: "POST" });
    const data = await response.json();
    setBusy("");
    if (!response.ok) {
      setError(data.detail || "Could not load the sample pack.");
      return;
    }
    await refresh();
  }

  async function analyze() {
    setBusy("Reading documents");
    setError("");
    const response = await fetch(`/api/projects/${projectId}/analyze`, { method: "POST" });
    const data = await response.json();
    setBusy("");
    if (!response.ok) {
      setError(data.detail || "Review failed.");
      return;
    }
    setReport(data.report);
  }

  async function removeDoc(id: string) {
    await fetch(`/api/projects/${projectId}/documents/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link href="/" className="text-xs uppercase tracking-widest text-moss">All reviews</Link>
          <h1 className="font-serif text-4xl">{name}</h1>
        </div>
        <button
          onClick={analyze}
          disabled={Boolean(busy) || documents.length === 0}
          className="bg-moss px-5 py-2 text-sm text-paper disabled:opacity-50"
        >
          {busy === "Reading documents" ? "Reading…" : "Run tender review"}
        </button>
      </div>

      <section
        className={`no-print border-2 border-dashed p-5 ${drag ? "border-moss bg-sheet" : "border-rule bg-sheet/70"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void upload(e.dataTransfer.files);
        }}
      >
        <p className="font-medium">Drop PDF, Word and Excel files here</p>
        <p className="mt-1 text-sm text-ink/65">
          Conditions, contract data, particular conditions, specifications, bills and invitations. Drawings are accepted if they contain text; scanned images without OCR will be flagged.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="cursor-pointer border border-ink/30 px-3 py-1 text-sm">
            Choose files
            <input
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.xlsx,.xls,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                if (e.target.files) void upload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <button type="button" onClick={loadSample} className="border border-ink/30 px-3 py-1 text-sm" disabled={Boolean(busy)}>
            Load sample tender pack
          </button>
        </div>
      </section>

      {error ? <p className="text-sm text-stamp">{error}</p> : null}
      {busy ? <p className="text-sm text-moss">{busy}…</p> : null}

      <section className="no-print border border-rule bg-sheet">
        <div className="border-b border-rule px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-brass">
          {documents.length} file{documents.length === 1 ? "" : "s"}
        </div>
        {documents.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink/55">Nothing uploaded yet.</p>
        ) : (
          <ul>
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-start justify-between gap-4 border-t border-rule px-4 py-3">
                <div>
                  <p className="font-medium">{doc.filename}</p>
                  <p className="citation">
                    {doc.parsed?.role.replace(/_/g, " ") || "unread"}
                    {doc.parsed?.pageCount ? ` · ${doc.parsed.pageCount} pp` : ""}
                    {` · ${(doc.byte_size / 1024).toFixed(0)} KB`}
                  </p>
                  {doc.parsed?.warnings.map((w) => <p key={w} className="text-xs text-stamp">{w}</p>)}
                </div>
                <button className="text-xs uppercase tracking-wider text-stamp" onClick={() => void removeDoc(doc.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {report ? <ReportView report={report} /> : (
        <p className="text-sm text-ink/55">
          The structured report appears here after you run the review. Findings stay blank unless a quote exists in a file.
        </p>
      )}
    </div>
  );
}
