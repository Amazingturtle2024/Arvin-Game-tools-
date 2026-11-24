"use client";

import { useState } from "react";
import type { DrawingPlanningReport } from "@/modules/drawing-planning/types";

const TABS = ["Drawings", "Take-off", "Durations", "BOQ", "Sequence", "Risks", "Handoff"] as const;
type Tab = (typeof TABS)[number];

export function DrawingReportView({ report, projectId }: { report: DrawingPlanningReport; projectId: string }) {
  const [tab, setTab] = useState<Tab>("Drawings");
  return (
    <div className="print-sheet space-y-5 border border-rule bg-sheet p-6 shadow-[8px_8px_0_rgba(28,42,36,0.08)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule pb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">Drawings, quantities and durations</p>
          <h2 className="font-serif text-3xl">{report.projectName}</h2>
        </div>
        <a
          className="no-print border border-ink/30 px-3 py-1 text-sm"
          href={`/api/projects/${projectId}/drawings/export`}
        >
          Export Excel
        </a>
      </header>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {report.methodology.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <div className="no-print sticky top-0 z-10 flex flex-wrap gap-1 border-b border-rule bg-sheet">
        {TABS.map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`px-3 py-2 text-sm ${tab === item ? "border-b-2 border-moss font-medium" : "text-ink/55"}`}>
            {item}
          </button>
        ))}
      </div>
      {tab === "Drawings" ? (
        <div className="space-y-4">
          {report.drawings.length === 0 ? <p className="text-sm italic text-ink/55">No drawings with extractable text were identified.</p> : report.drawings.map((d) => (
            <article key={d.documentId} className="border-b border-rule pb-3">
              <p className="font-medium">{d.documentName}</p>
              <p className="citation">{d.drawingKind.replace(/_/g, " ")} · {d.drawingNumber || "no drawing number"} · rev {d.revision || "—"} · scale {d.scale || "not stated"}</p>
              <p className="text-sm">{d.title}</p>
              {d.warnings.map((w) => <p key={w} className="text-xs text-stamp">{w}</p>)}
            </article>
          ))}
          <h3 className="font-serif text-xl">Dimensions and notes</h3>
          {report.measurements.slice(0, 40).map((m) => (
            <p key={m.id} className="text-sm">
              <span className="font-medium">{m.kind}</span> {m.value} {m.unit}
              <span className="citation ml-2">{m.source.documentName} · {m.source.locationLabel}</span>
              <span className="block italic text-ink/70">“{m.raw}”</span>
            </p>
          ))}
          {report.discrepancies.map((d, i) => (
            <div key={`${d.title}-${d.sources[0]?.documentId ?? i}`} className="border border-stamp/40 p-3">
              <p className="font-medium">{d.title}</p>
              <p className="text-sm">{d.note}</p>
            </div>
          ))}
        </div>
      ) : null}
      {tab === "Take-off" ? (
        <div className="space-y-4">
          {report.takeoff.map((t) => (
            <article key={t.id} className="border-b border-rule pb-3">
              <p className="font-medium">{t.label}{t.complete ? "" : " — not calculated"}</p>
              <p className="font-mono text-sm">{t.complete ? `${t.quantity} ${t.unit}` : t.unit} · {t.formula}</p>
              {t.assumptions.map((a) => <p key={a} className="text-sm text-flag">{a}</p>)}
              {t.inputs.map((i) => (
                <p key={i.label} className="citation">{i.label}: {i.value} · {i.source.documentName} · {i.source.locationLabel}</p>
              ))}
            </article>
          ))}
        </div>
      ) : null}
      {tab === "Durations" ? (
        <div className="space-y-4">
          {report.durations.map((d) => (
            <article key={`${d.activityKey}-${d.unit}`} className="border-b border-rule pb-3">
              <p className="font-medium">{d.label}</p>
              <p className="text-sm">{d.quantity} {d.unit}{d.durationWorkingDays != null ? ` → ${d.durationWorkingDays} working days` : ""}</p>
              <p className="font-mono text-xs">{d.formula}</p>
              {d.blockedReason ? <p className="text-sm text-stamp">{d.blockedReason}</p> : null}
              <p className="citation">Teams {d.teams} · {d.hoursPerDay} h/day · {d.daysPerWeek} d/wk · weather {d.weatherAllowancePct}%</p>
            </article>
          ))}
        </div>
      ) : null}
      {tab === "BOQ" ? (
        <div className="space-y-3">
          {report.boqComparison.length === 0 ? <p className="text-sm italic text-ink/55">No BOQ lines and no drawing quantities to compare.</p> : report.boqComparison.map((row, i) => (
            <article key={i} className="border-b border-rule pb-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-stamp">{row.status.replace("_", " ")}</p>
              <p className="text-sm">{row.boqItem || "—"} vs {row.drawingItem || "—"}</p>
              <p className="font-mono text-sm">BOQ {row.boqQty ?? "—"} · drawing {row.drawingQty ?? "—"} {row.unit}</p>
              <p className="text-sm text-ink/70">{row.note}</p>
            </article>
          ))}
        </div>
      ) : null}
      {tab === "Sequence" ? (
        <div className="space-y-3">
          {report.methodologyNarrative.map((line) => <p key={line} className="text-sm leading-relaxed">{line}</p>)}
        </div>
      ) : null}
      {tab === "Risks" ? (
        <div className="space-y-3">
          {report.risks.map((r) => (
            <article key={r.id} className="border border-ink/10 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-stamp">{r.category}</p>
              <p className="font-medium">{r.title}</p>
              <p className="text-sm">{r.note}</p>
            </article>
          ))}
        </div>
      ) : null}
      {tab === "Handoff" ? (
        <div className="space-y-3">
          <p className="text-sm">These activities are ready for Module 03 (programme) and a later Microsoft Project 2013 export. Nothing has been written to MSP yet.</p>
          {report.handoff.activities.map((a) => (
            <p key={a.id} className="text-sm">
              <span className="font-medium">{a.name}</span> {a.durationWorkingDays} d · {a.quantity} {a.unit}
              {a.predecessors.length ? ` · after ${a.predecessors.map((p) => p.id).join(", ")}` : ""}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
