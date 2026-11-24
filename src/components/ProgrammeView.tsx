"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { GanttChart } from "./GanttChart";
import { LinksEditor } from "./LinksEditor";
import type { ConstructionProgramme, FieldOrigin, ProgrammeActivity, ProgrammeRevisionSummary, ProgrammeSetup } from "@/modules/programme/types";

const TABS = ["Setup", "Schedule", "Gantt", "CPM", "Checks", "Revisions"] as const;
type Tab = (typeof TABS)[number];

export function ProgrammeView({ projectId }: { projectId: string }) {
  const [programme, setProgramme] = useState<ConstructionProgramme | null>(null);
  const [revisions, setRevisions] = useState<ProgrammeRevisionSummary[]>([]);
  const [audit, setAudit] = useState<Array<{ at: string; action: string; revision: number }>>([]);
  const [tab, setTab] = useState<Tab>("Gantt");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/programme`);
    const data = await response.json();
    setProgramme(data.programme);
    setRevisions(data.revisions ?? []);
    setAudit(data.audit ?? []);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setBusy("Building programme");
    setError("");
    const response = await fetch(`/api/projects/${projectId}/programme`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const data = await response.json();
    setBusy("");
    if (!response.ok) {
      setError(data.detail || "Could not build the programme.");
      return;
    }
    setProgramme(data.programme);
    setTab("Gantt");
    await load();
  }

  async function save(next: ConstructionProgramme) {
    setBusy("Recalculating");
    setError("");
    const response = await fetch(`/api/projects/${projectId}/programme`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ programme: next }),
    });
    const data = await response.json();
    setBusy("");
    if (!response.ok) {
      setError(data.detail || "Could not save.");
      return;
    }
    setProgramme(data.programme);
  }

  async function approve(baseline: boolean) {
    setBusy(baseline ? "Saving baseline" : "Approving");
    const response = await fetch(`/api/projects/${projectId}/programme`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "approve", baseline }),
    });
    const data = await response.json();
    setBusy("");
    if (!response.ok) {
      setError(data.detail || "Could not approve.");
      return;
    }
    setProgramme(data.programme);
    await load();
  }

  if (!programme) {
    return (
      <section className="border border-rule bg-sheet p-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-brass">Module 03 · Construction programme</p>
        <h2 className="mt-1 font-serif text-3xl">Gantt chart from the measured works</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/75">
          Uses the contract data from Module 01 and the measured quantities and rates from Module 02. Missing dates, rates and curing periods stay blank. Recommended logic is labelled until you edit or approve it.
        </p>
        {error ? <p className="mt-3 text-sm text-stamp">{error}</p> : null}
        <button type="button" onClick={() => void generate()} className="mt-4 bg-moss px-5 py-2 text-sm text-paper" disabled={Boolean(busy)}>
          {busy || "Build programme"}
        </button>
      </section>
    );
  }

  return (
    <div className="print-sheet max-w-full space-y-4 overflow-hidden border border-rule bg-sheet p-5 shadow-[8px_8px_0_rgba(28,42,36,0.08)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule pb-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-brass">
            Module 03 · Revision {programme.revision} · {programme.status}
          </p>
          <h2 className="font-serif text-3xl">{programme.setup.projectName.value || "Construction programme"}</h2>
          <p className="mt-1 text-sm text-ink/70">
            Planned completion {programme.plannedCompletion || "—"}
            {programme.contractCompletion ? ` · Contract ${programme.contractCompletion}` : ""}
            {` · ${programme.criticalPath.length} critical activities`}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2 text-sm">
          <button type="button" onClick={() => void generate()} className="border border-ink/30 px-3 py-1" disabled={Boolean(busy)}>Rebuild from 01–02</button>
          <button type="button" onClick={() => void save(programme)} className="border border-ink/30 px-3 py-1" disabled={Boolean(busy)}>Recalculate & save</button>
          <button type="button" onClick={() => void approve(false)} className="border border-ink/30 px-3 py-1">Approve</button>
          <button type="button" onClick={() => void approve(true)} className="border border-ink/30 px-3 py-1">Save baseline</button>
          <a className="border border-ink/30 px-3 py-1" href={`/api/projects/${projectId}/programme/export?format=xlsx`}>Excel</a>
          <a className="border border-ink/30 px-3 py-1" href={`/api/projects/${projectId}/programme/export?format=xml`}>MSP XML</a>
          <a className="border border-ink/30 px-3 py-1" href={`/api/projects/${projectId}/programme/export?format=pdf`}>PDF Gantt</a>
        </div>
      </header>
      {error ? <p className="text-sm text-stamp">{error}</p> : null}
      {busy ? <p className="text-sm text-moss">{busy}…</p> : null}
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink/75">
        {programme.methodology.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <div className="no-print sticky top-0 z-10 flex flex-wrap gap-1 border-b border-rule bg-sheet">
        {TABS.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`px-3 py-2 text-sm ${tab === item ? "border-b-2 border-moss font-medium" : "text-ink/55"}`}>
            {item}
            {item === "Checks" && programme.warnings.length ? ` (${programme.warnings.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "Setup" ? (
        <SetupForm
          setup={programme.setup}
          onChange={(setup) => setProgramme({ ...programme, setup })}
          onApply={() => void save({ ...programme })}
        />
      ) : null}
      {tab === "Schedule" ? (
        <ScheduleTable
          programme={programme}
          onChange={(activities) => setProgramme({ ...programme, activities })}
          onCommit={(activities) => void save({ ...programme, activities })}
        />
      ) : null}
      {tab === "Gantt" ? (
        <GanttChart
          programme={programme}
          onChange={(activities) => setProgramme({ ...programme, activities })}
          onCommit={(activities) => void save({ ...programme, activities })}
        />
      ) : null}
      {tab === "CPM" ? <CpmTable activities={programme.activities} /> : null}
      {tab === "Checks" ? (
        <div className="space-y-3">
          {programme.warnings.length === 0 ? <p className="text-sm text-ink/60">No warnings. Review the Gantt before you approve.</p> : null}
          {programme.warnings.map((w) => (
            <article key={w.id} className="border-b border-rule pb-3">
              <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">{w.severity}</p>
              <p className="font-medium">{w.title}</p>
              <p className="text-sm text-ink/70">{w.detail}</p>
            </article>
          ))}
        </div>
      ) : null}
      {tab === "Revisions" ? (
        <div className="space-y-4">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-ink/60">
              <tr><th className="py-1">Rev</th><th>Status</th><th>Activities</th><th>Finish</th><th>When</th></tr>
            </thead>
            <tbody>
              {revisions.map((r) => (
                <tr key={r.id} className="border-t border-rule">
                  <td className="py-1">{r.revision}</td>
                  <td>{r.status}</td>
                  <td>{r.activityCount}</td>
                  <td>{r.plannedCompletion || "—"}</td>
                  <td className="citation">{r.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="font-mono text-[11px] uppercase tracking-widest text-brass">Audit trail</p>
          <ul className="text-sm">
            {audit.map((row, i) => (
              <li key={`${row.at}-${i}`} className="border-t border-rule py-1">{row.action} · r{row.revision} · {row.at}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SetupForm({ setup, onChange, onApply }: { setup: ProgrammeSetup; onChange: (setup: ProgrammeSetup) => void; onApply: () => void }) {
  function set<K extends keyof ProgrammeSetup>(key: K, value: ProgrammeSetup[K]["value"]) {
    onChange({ ...setup, [key]: { ...setup[key], value, origin: "user" as FieldOrigin } });
  }
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
    >
      <fieldset className="space-y-3 sm:col-span-2">
        <legend className="font-mono text-[11px] uppercase tracking-widest text-brass">A. Project information</legend>
        <Field label="Project name" origin={setup.projectName}><input value={setup.projectName.value} onChange={(e) => set("projectName", e.target.value)} className="field" /></Field>
        <Field label="Client" origin={setup.client}><input value={setup.client.value} onChange={(e) => set("client", e.target.value)} className="field" /></Field>
        <Field label="Consultant / Engineer" origin={setup.consultant}><input value={setup.consultant.value} onChange={(e) => set("consultant", e.target.value)} className="field" /></Field>
        <Field label="Main contractor" origin={setup.mainContractor}><input value={setup.mainContractor.value} onChange={(e) => set("mainContractor", e.target.value)} className="field" /></Field>
        <Field label="Location" origin={setup.location}><input value={setup.location.value} onChange={(e) => set("location", e.target.value)} className="field" /></Field>
        <Field label="Contract number" origin={setup.contractNumber}><input value={setup.contractNumber.value} onChange={(e) => set("contractNumber", e.target.value)} className="field" /></Field>
        <Field label="Contract type" origin={setup.contractType}><input value={setup.contractType.value} onChange={(e) => set("contractType", e.target.value)} className="field" /></Field>
        <Field label="Contract duration" origin={setup.contractDuration}><input value={setup.contractDuration.value} onChange={(e) => set("contractDuration", e.target.value)} className="field" /></Field>
        <Field label="Commencement date" origin={setup.commencementDate}><input type="date" value={setup.commencementDate.value} onChange={(e) => set("commencementDate", e.target.value)} className="field" /></Field>
        <Field label="Contract completion date" origin={setup.completionDate}><input type="date" value={setup.completionDate.value} onChange={(e) => set("completionDate", e.target.value)} className="field" /></Field>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="font-mono text-[11px] uppercase tracking-widest text-brass">B. Working calendar</legend>
        <Field label="Working days" origin={setup.workingPattern}>
          <select value={setup.workingPattern.value} onChange={(e) => set("workingPattern", e.target.value as ProgrammeSetup["workingPattern"]["value"])} className="field">
            <option value="monday_friday">Monday – Friday</option>
            <option value="monday_saturday">Monday – Saturday</option>
            <option value="custom">Custom</option>
          </select>
        </Field>
        <Field label="Hours per day" origin={setup.hoursPerDay}><input type="number" step="0.5" value={setup.hoursPerDay.value} onChange={(e) => set("hoursPerDay", Number(e.target.value))} className="field" /></Field>
        <Field label="Working hours" origin={setup.workingHours}><input value={setup.workingHours.value} onChange={(e) => set("workingHours", e.target.value)} className="field" placeholder="07:00 – 16:00" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={setup.saturdays.value} onChange={(e) => set("saturdays", e.target.checked)} /> Saturdays</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={setup.sundays.value} onChange={(e) => set("sundays", e.target.checked)} /> Sundays</label>
        <Field label="Public holidays" origin={setup.publicHolidays}>
          <select value={setup.publicHolidays.value} onChange={(e) => set("publicHolidays", e.target.value as "exclude" | "include")} className="field">
            <option value="exclude">Exclude</option>
            <option value="include">Include</option>
          </select>
        </Field>
        <Field label="Holiday dates (one ISO date per line)" origin={setup.holidayDates}>
          <textarea value={setup.holidayDates.value.join("\n")} onChange={(e) => set("holidayDates", e.target.value.split(/\n/).map((s) => s.trim()).filter(Boolean))} className="field min-h-16" />
        </Field>
        <Field label="Annual shutdown" origin={setup.annualShutdown}><input value={setup.annualShutdown.value} onChange={(e) => set("annualShutdown", e.target.value)} className="field" placeholder="2026-12-24 to 2027-01-04" /></Field>
        <Field label="Weather allowance %" origin={setup.weatherAllowancePct}>
          <input type="number" value={setup.weatherAllowancePct.value ?? ""} onChange={(e) => set("weatherAllowancePct", e.target.value === "" ? null : Number(e.target.value))} className="field" />
        </Field>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="font-mono text-[11px] uppercase tracking-widest text-brass">C. Construction resources</legend>
        <Field label="General workers" origin={setup.generalWorkers}><input type="number" value={setup.generalWorkers.value ?? ""} onChange={(e) => set("generalWorkers", e.target.value === "" ? null : Number(e.target.value))} className="field" /></Field>
        <Field label="Skilled workers" origin={setup.skilledWorkers}><input type="number" value={setup.skilledWorkers.value ?? ""} onChange={(e) => set("skilledWorkers", e.target.value === "" ? null : Number(e.target.value))} className="field" /></Field>
        <Field label="Supervisors" origin={setup.supervisors}><input type="number" value={setup.supervisors.value ?? ""} onChange={(e) => set("supervisors", e.target.value === "" ? null : Number(e.target.value))} className="field" /></Field>
        <Field label="Construction teams" origin={setup.teams}><input type="number" value={setup.teams.value ?? ""} onChange={(e) => set("teams", e.target.value === "" ? null : Number(e.target.value))} className="field" /></Field>
        <Field label="Plant and equipment" origin={setup.plant}><textarea value={setup.plant.value} onChange={(e) => set("plant", e.target.value)} className="field min-h-20" /></Field>
      </fieldset>
      <div className="sm:col-span-2">
        <button type="submit" className="bg-moss px-4 py-2 text-sm text-paper">Apply calendar &amp; recalculate</button>
      </div>
    </form>
  );
}

function Field({ label, origin, children }: { label: string; origin: { origin: FieldOrigin; sourceLabel: string | null }; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="flex items-baseline justify-between gap-2">
        <span>{label}</span>
        <OriginBadge origin={origin.origin} source={origin.sourceLabel} />
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function OriginBadge({ origin, source }: { origin: FieldOrigin; source: string | null }) {
  const label = origin === "recommendation" ? "Recommended" : origin === "user" ? "Planner" : origin === "module-01" ? "From tender" : "From take-off";
  return <span className="font-mono text-[10px] uppercase tracking-wider text-brass" title={source ?? ""}>{label}</span>;
}

function ScheduleTable({
  programme,
  onChange,
  onCommit,
}: {
  programme: ConstructionProgramme;
  onChange: (activities: ProgrammeActivity[]) => void;
  onCommit: (activities: ProgrammeActivity[]) => void;
}) {
  function patch(id: string, next: Partial<ProgrammeActivity>) {
    onChange(programme.activities.map((a) => (
      a.id === id
        ? { ...a, ...next, origin: "user", approval: a.approval === "approved" ? "edited" : a.approval === "recommended" ? "edited" : a.approval }
        : a
    )));
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/70">Every cell is editable. Change predecessor, relationship (FS/SS/FF/SF) and lag at any time — the sequence recalculates as soon as you edit a link. Recalculate after quantity, rate or team changes. Approved rows are not rewritten by a rebuild.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1500px] text-left text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-ink/60">
            <tr>
              {["WBS", "ID", "Activity", "BOQ", "Drawing", "Qty", "Unit", "Rate/d", "Teams", "Days", "Override", "Sequence (pred / type / lag)", "Start", "Finish", "Owner", "Status", "%", "Tag"].map((h) => (
                <th key={h} className="py-1 pr-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {programme.activities.map((a) => (
              <tr key={a.id} className={`border-t border-rule/70 ${a.critical ? "bg-stamp/5" : ""} ${a.kind === "summary" ? "bg-paper/70 font-medium" : ""}`}>
                <td className="py-1 pr-2 font-mono">{a.wbs}</td>
                <td className="py-1 pr-2 font-mono">{a.activityId}</td>
                <td className="py-1 pr-2"><input className="field min-w-40" value={a.name} onChange={(e) => patch(a.id, { name: e.target.value })} disabled={a.kind === "summary"} /></td>
                <td className="py-1 pr-2"><input className="field min-w-24" value={a.boqRef ?? ""} onChange={(e) => patch(a.id, { boqRef: e.target.value || null })} /></td>
                <td className="py-1 pr-2"><input className="field min-w-24" value={a.drawingRef ?? ""} onChange={(e) => patch(a.id, { drawingRef: e.target.value || null })} /></td>
                <td className="py-1 pr-2"><input className="field w-16" type="number" value={a.quantity ?? ""} onChange={(e) => patch(a.id, { quantity: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                <td className="py-1 pr-2"><input className="field w-12" value={a.unit} onChange={(e) => patch(a.id, { unit: e.target.value })} /></td>
                <td className="py-1 pr-2"><input className="field w-16" type="number" value={a.ratePerDay ?? ""} onChange={(e) => patch(a.id, { ratePerDay: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                <td className="py-1 pr-2"><input className="field w-12" type="number" value={a.teams} onChange={(e) => patch(a.id, { teams: Number(e.target.value) })} /></td>
                <td className="py-1 pr-2 font-mono">{a.durationWorkingDays ?? "—"}</td>
                <td className="py-1 pr-2">
                  <input
                    className="field w-14"
                    type="number"
                    value={a.durationManual ? (a.durationWorkingDays ?? "") : ""}
                    placeholder="auto"
                    onChange={(e) => patch(a.id, { durationManual: e.target.value !== "", durationWorkingDays: e.target.value === "" ? a.durationWorkingDays : Number(e.target.value) })}
                  />
                </td>
                <td className="py-1 pr-2 min-w-[280px]">
                  {a.kind === "summary" ? <span className="text-ink/40">—</span> : (
                    <LinksEditor
                      compact
                      activity={a}
                      activities={programme.activities}
                      onChange={(next) => {
                        onChange(next);
                        onCommit(next);
                      }}
                    />
                  )}
                </td>
                <td className="py-1 pr-2 font-mono">{a.plannedStart ?? "—"}</td>
                <td className="py-1 pr-2 font-mono">{a.plannedFinish ?? "—"}</td>
                <td className="py-1 pr-2"><input className="field w-24" value={a.responsible} onChange={(e) => patch(a.id, { responsible: e.target.value })} /></td>
                <td className="py-1 pr-2">
                  <select className="field" value={a.status} onChange={(e) => patch(a.id, { status: e.target.value as ProgrammeActivity["status"] })}>
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </td>
                <td className="py-1 pr-2"><input className="field w-12" type="number" value={a.progressPct} onChange={(e) => patch(a.id, { progressPct: Number(e.target.value) })} /></td>
                <td className="py-1 pr-2"><OriginBadge origin={a.origin} source={a.approval} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => onCommit(programme.activities)} className="bg-moss px-4 py-2 text-sm text-paper">Recalculate dates</button>
    </div>
  );
}

function CpmTable({ activities }: { activities: ProgrammeActivity[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-ink/60">
          <tr>
            {["ID", "Activity", "Dur", "ES", "EF", "LS", "LF", "Total float", "Free float", "Critical"].map((h) => (
              <th key={h} className="py-1 pr-3 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activities.filter((a) => a.kind !== "summary").map((a) => (
            <tr key={a.id} className={`border-t border-rule ${a.critical ? "text-stamp" : ""}`}>
              <td className="py-1 pr-3 font-mono">{a.activityId}</td>
              <td className="py-1 pr-3">{a.name}</td>
              <td className="py-1 pr-3">{a.durationWorkingDays ?? "—"}</td>
              <td className="py-1 pr-3">{fmt(a.es)}</td>
              <td className="py-1 pr-3">{fmt(a.ef)}</td>
              <td className="py-1 pr-3">{fmt(a.ls)}</td>
              <td className="py-1 pr-3">{fmt(a.lf)}</td>
              <td className="py-1 pr-3">{fmt(a.totalFloat)}</td>
              <td className="py-1 pr-3">{fmt(a.freeFloat)}</td>
              <td className="py-1 pr-3">{a.critical ? "Yes" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmt(n: number | null) {
  return n == null ? "—" : String(n);
}
