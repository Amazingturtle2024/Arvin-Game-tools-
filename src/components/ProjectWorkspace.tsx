"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DrawingReportView } from "./DrawingReportView";
import { RatesEditor } from "./RatesEditor";
import { ReportView } from "./ReportView";
import type { TenderReviewReport } from "@/modules/document-analysis/types";
import type { DrawingPlanningReport, ProductionRate } from "@/modules/drawing-planning/types";

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
  const [drawingReport, setDrawingReport] = useState<DrawingPlanningReport | null>(null);
  const [rates, setRates] = useState<ProductionRate[]>([]);
  const [moduleId, setModuleId] = useState<"document-analysis" | "drawing-planning">("document-analysis");
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
    setDrawingReport(data.drawingReport);
    setRates(data.rates ?? []);
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
    await refresh();
    if (!response.ok) {
      setError(data.detail || data.error || "Upload failed.");
    }
  }

  async function loadSample(kind: "tender" | "drawings") {
    setBusy("Building sample pack");
    setError("");
    const path = kind === "tender" ? "sample" : "drawings/sample";
    const response = await fetch(`/api/projects/${projectId}/${path}`, { method: "POST" });
    const data = await response.json();
    setBusy("");
    await refresh();
    if (!response.ok) setError(data.detail || "Could not load the sample pack.");
  }

  async function analyzeTender() {
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

  async function analyzeDrawings() {
    setBusy("Taking off drawings");
    setError("");
    const response = await fetch(`/api/projects/${projectId}/drawings/analyze`, { method: "POST" });
    const data = await response.json();
    setBusy("");
    if (!response.ok) {
      setError(data.detail || "Take-off failed.");
      return;
    }
    setDrawingReport(data.report);
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
        {moduleId === "document-analysis" ? (
          <button onClick={analyzeTender} disabled={Boolean(busy) || documents.length === 0} className="bg-moss px-5 py-2 text-sm text-paper disabled:opacity-50">
            {busy === "Reading documents" ? "Reading…" : "Run tender review"}
          </button>
        ) : (
          <button onClick={analyzeDrawings} disabled={Boolean(busy) || documents.length === 0} className="bg-moss px-5 py-2 text-sm text-paper disabled:opacity-50">
            {busy === "Taking off drawings" ? "Measuring…" : "Run drawing take-off"}
          </button>
        )}
      </div>

      <div className="no-print flex gap-2 border-b border-rule">
        <button className={`px-3 py-2 text-sm ${moduleId === "document-analysis" ? "border-b-2 border-moss" : "text-ink/55"}`} onClick={() => setModuleId("document-analysis")}>
          01 Tender review
        </button>
        <button className={`px-3 py-2 text-sm ${moduleId === "drawing-planning" ? "border-b-2 border-moss" : "text-ink/55"}`} onClick={() => setModuleId("drawing-planning")}>
          02 Drawings & durations
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
        <p className="font-medium">Drop PDF, Word, Excel or drawing images</p>
        <p className="mt-1 text-sm text-ink/65">
          Module 01 reads contracts, specs and bills. Module 02 reads drawings and your production rates. Keep both packs on the same project so quantities can be compared with the BOQ.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="cursor-pointer border border-ink/30 px-3 py-1 text-sm">
            Choose files
            <input
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.xlsx,.xls,.txt,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg"
              onChange={(e) => {
                if (e.target.files) void upload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <button type="button" onClick={() => void loadSample("tender")} className="border border-ink/30 px-3 py-1 text-sm" disabled={Boolean(busy)}>
            Load sample tender pack
          </button>
          <button type="button" onClick={() => void loadSample("drawings")} className="border border-ink/30 px-3 py-1 text-sm" disabled={Boolean(busy)}>
            Load sample drawings
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

      {moduleId === "drawing-planning" ? (
        <>
          <RatesEditor rates={rates} onChange={setRates} />
          {drawingReport ? <DrawingReportView report={drawingReport} projectId={projectId} /> : (
            <p className="text-sm text-ink/55">Run the drawing take-off after drawings (and the BOQ, if you have it) are on this project. Durations stay blank until a rate exists.</p>
          )}
        </>
      ) : report ? (
        <ReportView report={report} />
      ) : (
        <p className="text-sm text-ink/55">
          The structured tender report appears here after you run Module 01. Findings stay blank unless a quote exists in a file.
        </p>
      )}
    </div>
  );
}
