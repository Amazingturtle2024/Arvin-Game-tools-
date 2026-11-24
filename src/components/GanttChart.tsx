"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { LinksEditor } from "./LinksEditor";
import { addLink, linkTypeFromAnchors } from "@/modules/programme/links";
import type { ConstructionProgramme, LinkType, ProgrammeActivity } from "@/modules/programme/types";
import { ancestorCollapsed, depthOf } from "@/modules/programme/wbs";

type Scale = "day" | "week" | "month";
type Anchor = "start" | "finish";

const PX: Record<Scale, number> = { day: 22, week: 10, month: 4 };
const ROW = 28;
const HEAD = 40;
const TABLE_W = 620;
const CRITICAL = "#c0504d";
const TASK = "#4f81bd";
const SUMMARY = "#1f1f1f";
const LINK = "#6b7280";

export function GanttChart({
  programme,
  onChange,
  onCommit,
}: {
  programme: ConstructionProgramme;
  onChange: (activities: ProgrammeActivity[]) => void;
  onCommit?: (activities: ProgrammeActivity[]) => void;
}) {
  const [scale, setScale] = useState<Scale>("week");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<{ successorId: string; predecessorId: string } | null>(null);
  const [wire, setWire] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [hint, setHint] = useState("");
  const drag = useRef<{ id: string; mode: "move" | "resize"; startX: number; start: string; duration: number } | null>(null);
  const linking = useRef<{ fromId: string; from: Anchor; x: number; y: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const programmeRef = useRef(programme);
  programmeRef.current = programme;
  const px = PX[scale];
  const rows = programme.activities.filter((a) => !ancestorCollapsed(a, collapsed, programme.activities));
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const outline = new Map(rows.map((a, i) => [a.id, i + 1]));
  const range = dateRange(programme);
  const width = Math.max(range.days * px, 400);
  const height = HEAD + rows.length * ROW;
  const selected = programme.activities.find((a) => a.id === selectedId) ?? null;
  const months = monthBands(range.start, range.days);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function commit(next: ProgrammeActivity[]) {
    onChange(next);
    onCommit?.(next);
  }

  function bindWindow() {
    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
  }

  function unbindWindow() {
    window.removeEventListener("pointermove", onWindowMove);
    window.removeEventListener("pointerup", onWindowUp);
  }

  function onWindowMove(event: PointerEvent) {
    if (linking.current) {
      const point = localPoint(event, chartRef.current);
      setWire({ x1: linking.current.x, y1: linking.current.y, x2: point.x, y2: point.y });
      return;
    }
    const current = drag.current;
    if (!current) return;
    const deltaDays = Math.round((event.clientX - current.startX) / px);
    onChange(programmeRef.current.activities.map((a) => {
      if (a.id !== current.id) return a;
      if (current.mode === "resize") {
        const days = Math.max(a.kind === "milestone" ? 0 : 0.5, current.duration + deltaDays);
        return { ...a, durationWorkingDays: days, durationManual: true, origin: "user", approval: a.approval === "approved" ? "edited" : a.approval };
      }
      return { ...a, startConstraint: shiftIso(current.start, deltaDays), origin: "user", approval: a.approval === "approved" ? "edited" : a.approval };
    }));
  }

  function onWindowUp(event: PointerEvent) {
    unbindWindow();
    if (linking.current) {
      const from = linking.current;
      const target = hitActivity(event, rowsRef.current, range.start, px, chartRef.current);
      linking.current = null;
      setWire(null);
      if (target && target.id !== from.fromId) {
        const type = linkTypeFromAnchors(from.from, target.anchor);
        const next = addLink(programmeRef.current.activities, target.id, from.fromId, type, 0);
        if (next === programmeRef.current.activities) {
          setHint("That link would loop the sequence, so it was not added. Change or remove an existing link first.");
        } else {
          setHint(`Linked ${labelOf(programmeRef.current.activities, from.fromId)} → ${labelOf(programmeRef.current.activities, target.id)} as ${type}. Dates will follow this sequence.`);
          commit(next);
          setSelectedId(target.id);
          setSelectedLink({ successorId: target.id, predecessorId: from.fromId });
        }
      }
      return;
    }
    if (drag.current) {
      drag.current = null;
      onCommit?.(programmeRef.current.activities);
    }
  }

  function onBarDown(activity: ProgrammeActivity, mode: "move" | "resize", event: ReactPointerEvent<Element>) {
    if (!activity.plannedStart || activity.kind === "summary") return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(activity.id);
    setSelectedLink(null);
    setHint("");
    drag.current = {
      id: activity.id,
      mode,
      startX: event.clientX,
      start: activity.plannedStart,
      duration: activity.durationWorkingDays ?? 1,
    };
    bindWindow();
  }

  function onHandleDown(activity: ProgrammeActivity, anchor: Anchor, event: ReactPointerEvent<Element>) {
    if (activity.kind === "summary") return;
    event.preventDefault();
    event.stopPropagation();
    const point = localPoint(event.nativeEvent, chartRef.current);
    linking.current = { fromId: activity.id, from: anchor, x: point.x, y: point.y };
    setWire({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    setSelectedId(activity.id);
    bindWindow();
  }

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap gap-2 text-sm">
        {(["day", "week", "month"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setScale(item)} className={`border px-3 py-1 ${scale === item ? "border-moss bg-moss text-paper" : "border-ink/30"}`}>
            {item}
          </button>
        ))}
        <p className="self-center text-xs text-ink/60">
          Drag a handle onto another bar to link them. Click a link or a bar to change type, lag or remove it.
        </p>
      </div>
      <p className="min-h-5 text-sm text-moss">{hint || "\u00a0"}</p>
      <div className="max-h-56 min-h-56 overflow-auto border border-rule bg-paper/70 p-4">
        {selected && selected.kind !== "summary" ? (
          <>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{outline.get(selected.id) ?? selected.activityId} {selected.name}</p>
              <p className="citation">{selected.plannedStart || "—"} → {selected.plannedFinish || "—"} · {formatDuration(selected)}</p>
            </div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-brass">Sequence — predecessors (FS / SS / FF / SF)</p>
            <LinksEditor
              activity={selected}
              activities={programme.activities}
              onChange={commit}
              highlightPredecessorId={selectedLink?.successorId === selected.id ? selectedLink.predecessorId : null}
            />
            {selected.startConstraint ? (
              <button
                type="button"
                className="mt-3 text-xs uppercase tracking-wider text-moss"
                onClick={() => commit(programme.activities.map((a) => a.id === selected.id ? { ...a, startConstraint: null, origin: "user" } : a))}
              >
                Follow predecessors (clear imposed start)
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-ink/60">Select a task to change its predecessors, relationship type and lag at any time.</p>
        )}
      </div>
      <div className="border border-rule bg-white text-ink">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule bg-sheet px-3 py-2 text-[11px]">
          <p className="font-serif text-sm">{programme.setup.projectName.value || "Construction programme"}</p>
          <p className="font-mono uppercase tracking-wider text-ink/60">
            Duration {workingSpan(programme)} days · Start {programme.setup.commencementDate.value || "—"} · Finish {programme.plannedCompletion || "—"}
          </p>
        </div>
        <div className="max-w-full overflow-auto">
          <div className="flex min-w-full">
            <div className="sticky left-0 z-20 shrink-0 border-r border-neutral-400 bg-white" style={{ width: TABLE_W }}>
              <table className="w-full table-fixed border-collapse text-left text-[11px]">
                <colgroup>
                  <col style={{ width: 36 }} />
                  <col />
                  <col style={{ width: 52 }} />
                  <col style={{ width: 72 }} />
                  <col style={{ width: 72 }} />
                  <col style={{ width: 78 }} />
                </colgroup>
                <thead>
                  <tr className="bg-neutral-100 font-mono text-[10px] uppercase tracking-wider text-ink/70" style={{ height: HEAD }}>
                    {["ID", "Task Name", "Dur", "Start", "Finish", "Preds"].map((h) => (
                      <th key={h} className="border-b border-r border-neutral-300 px-1.5 align-bottom font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const depth = depthOf(a, programme.activities);
                    return (
                      <tr
                        key={a.id}
                        className={`cursor-pointer border-b border-neutral-200 ${
                          selectedId === a.id ? "bg-sky-50" : a.kind === "summary" ? "bg-neutral-50" : "bg-white"
                        }`}
                        style={{ height: ROW }}
                        onClick={() => {
                          setSelectedId(a.id);
                          setSelectedLink(null);
                        }}
                      >
                        <td className="overflow-hidden border-r border-neutral-200 px-1.5 font-mono text-ink/55 whitespace-nowrap">{outline.get(a.id)}</td>
                        <td className="overflow-hidden border-r border-neutral-200 whitespace-nowrap" style={{ paddingLeft: 4 + depth * 12 }}>
                          {a.kind === "summary" ? (
                            <button
                              type="button"
                              className="mr-1 inline-block w-3 font-mono text-[10px] text-ink/70"
                              onClick={(e) => { e.stopPropagation(); toggle(a.id); }}
                            >
                              {collapsed.has(a.id) ? "+" : "–"}
                            </button>
                          ) : <span className="mr-1 inline-block w-3" />}
                          <span className={`inline-block max-w-[calc(100%-16px)] truncate align-middle ${a.kind === "summary" ? "font-semibold" : ""} ${a.critical && a.kind !== "summary" ? "text-[#9c2a2a]" : ""}`}>
                            {a.name}
                          </span>
                        </td>
                        <td className="overflow-hidden border-r border-neutral-200 px-1 font-mono whitespace-nowrap">{formatDuration(a)}</td>
                        <td className="overflow-hidden border-r border-neutral-200 px-1 font-mono whitespace-nowrap">{shortDate(a.plannedStart)}</td>
                        <td className="overflow-hidden border-r border-neutral-200 px-1 font-mono whitespace-nowrap">{shortDate(a.plannedFinish)}</td>
                        <td className="overflow-hidden px-1 font-mono text-[10px] text-ink/70 whitespace-nowrap">
                          {a.kind === "summary" ? "" : predLabel(a, outline, programme.activities)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="relative select-none bg-[repeating-linear-gradient(90deg,#f7f7f7_0,#f7f7f7_1px,transparent_1px,transparent)]" ref={chartRef} style={{ width, height, backgroundSize: `${px}px 100%` }}>
              <svg className="pointer-events-none absolute left-0 top-0 z-0" width={width} height={height}>
                {Array.from({ length: range.days }, (_, i) => {
                  const d = addDays(range.start, i);
                  const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                  if (!weekend) return null;
                  return <rect key={`we-${i}`} x={i * px} y={HEAD} width={px} height={height - HEAD} fill="#f3f0ea" />;
                })}
                {linkGeometry(rows, programme.activities, range.start, px).map((geom) => {
                  const active = selectedLink?.successorId === geom.successorId && selectedLink?.predecessorId === geom.predecessorId;
                  const color = geom.critical ? CRITICAL : active ? SUMMARY : LINK;
                  return (
                    <g key={`${geom.successorId}-${geom.predecessorId}`} className="pointer-events-auto">
                      <path d={geom.d} stroke="transparent" strokeWidth="16" fill="none" className="cursor-pointer" onClick={() => {
                        setSelectedLink({ successorId: geom.successorId, predecessorId: geom.predecessorId });
                        setSelectedId(geom.successorId);
                        setHint(`Edit ${geom.type} link${geom.lag ? ` with ${geom.lag} working days lag` : ""} in the sequence panel, or remove it.`);
                      }} />
                      <path d={geom.d} stroke={color} strokeWidth={active ? 2 : 1.15} fill="none" markerEnd={geom.critical ? "url(#gantt-arrow-crit)" : "url(#gantt-arrow)"} />
                    </g>
                  );
                })}
                <defs>
                  <marker id="gantt-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill={LINK} />
                  </marker>
                  <marker id="gantt-arrow-crit" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill={CRITICAL} />
                  </marker>
                </defs>
              </svg>
              <svg className="pointer-events-none absolute left-0 top-0 z-20" width={width} height={height}>
                {wire ? <path d={`M ${wire.x1} ${wire.y1} L ${wire.x2} ${wire.y2}`} stroke="#2f4f3e" strokeDasharray="4 3" fill="none" /> : null}
              </svg>
              <div className="pointer-events-none relative z-10 border-b border-neutral-400 bg-neutral-100" style={{ height: HEAD }}>
                <div className="flex h-5 border-b border-neutral-300">
                  {months.map((band) => (
                    <div key={band.key} className="truncate border-r border-neutral-400 text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-ink/70" style={{ width: band.days * px }}>
                      {band.label}
                    </div>
                  ))}
                </div>
                <div className="flex h-5">
                  {Array.from({ length: range.days }, (_, i) => {
                    const d = addDays(range.start, i);
                    const label = scale === "day" ? String(d.getUTCDate()) : scale === "week" ? (d.getUTCDay() === 1 ? `W${weekNum(d)}` : "") : (d.getUTCDate() === 1 ? String(d.getUTCDate()) : "");
                    return (
                      <div key={i} className="border-r border-neutral-200 text-center font-mono text-[9px] text-ink/45" style={{ width: px }}>
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
              {rows.map((a) => {
                const bar = barBox(a, range.start, px);
                return (
                  <div key={a.id} className={`pointer-events-none relative z-10 border-b border-neutral-200 ${selectedId === a.id ? "bg-sky-50/80" : ""}`} style={{ height: ROW }}>
                    {bar ? (
                      <Bar
                        activity={a}
                        bar={bar}
                        onBarDown={onBarDown}
                        onHandleDown={onHandleDown}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <ul className="flex flex-wrap gap-4 border-t border-rule bg-sheet px-3 py-2 text-[10px] uppercase tracking-wider text-ink/60">
          <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-6" style={{ background: TASK }} /> Task</li>
          <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-6" style={{ background: CRITICAL }} /> Critical</li>
          <li className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-8 bg-neutral-900" /> Summary</li>
          <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rotate-45 bg-neutral-900" /> Milestone</li>
        </ul>
      </div>
    </div>
  );
}

function Bar({
  activity,
  bar,
  onBarDown,
  onHandleDown,
}: {
  activity: ProgrammeActivity;
  bar: { left: number; width: number };
  onBarDown: (activity: ProgrammeActivity, mode: "move" | "resize", event: ReactPointerEvent<Element>) => void;
  onHandleDown: (activity: ProgrammeActivity, anchor: Anchor, event: ReactPointerEvent<Element>) => void;
}) {
  if (activity.kind === "milestone") {
    return (
      <div
        className="pointer-events-auto absolute top-[7px] h-3 w-3 rotate-45 cursor-grab bg-neutral-900"
        style={{ left: bar.left }}
        onPointerDown={(e) => onBarDown(activity, "move", e)}
        title={`${activity.name} ${activity.plannedStart ?? ""}`}
      >
        <span className="absolute -left-1 top-0.5 h-2 w-2 cursor-crosshair rounded-full border border-white bg-brass" onPointerDown={(e) => onHandleDown(activity, "start", e)} />
        <span className="absolute -right-1 top-0.5 h-2 w-2 cursor-crosshair rounded-full border border-white bg-brass" onPointerDown={(e) => onHandleDown(activity, "finish", e)} />
      </div>
    );
  }
  if (activity.kind === "summary") {
    return (
      <div className="pointer-events-none absolute top-[10px]" style={{ left: bar.left, width: Math.max(bar.width, 12) }}>
        <div className="h-[5px] bg-neutral-900" />
        <span className="absolute left-0 top-0 h-0 w-0 border-x-[5px] border-t-[8px] border-x-transparent border-t-neutral-900" />
        <span className="absolute right-0 top-0 h-0 w-0 border-x-[5px] border-t-[8px] border-x-transparent border-t-neutral-900" />
      </div>
    );
  }
  const color = activity.critical ? CRITICAL : TASK;
  const progress = Math.max(0, Math.min(100, activity.progressPct || 0));
  return (
    <div
      className="pointer-events-auto absolute top-[6px] h-[13px] cursor-grab shadow-sm"
      style={{ left: bar.left, width: bar.width, background: color }}
      onPointerDown={(e) => onBarDown(activity, "move", e)}
      title={`${activity.name} ${activity.plannedStart ?? ""} – ${activity.plannedFinish ?? ""}`}
    >
      {progress > 0 ? (
        <span className="absolute inset-y-0 left-0 bg-black/35" style={{ width: `${progress}%` }} />
      ) : null}
      <span
        className="absolute -left-1.5 top-[2px] z-20 h-2.5 w-2.5 cursor-crosshair rounded-full border border-white bg-brass"
        title="Drag from the start to link (SS or SF)"
        onPointerDown={(e) => onHandleDown(activity, "start", e)}
      />
      <span
        className="absolute -right-1.5 top-[2px] z-20 h-2.5 w-2.5 cursor-crosshair rounded-full border border-white bg-brass"
        title="Drag from the finish to link (FS or FF)"
        onPointerDown={(e) => onHandleDown(activity, "finish", e)}
      />
      <span
        className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-ew-resize bg-black/20"
        onPointerDown={(e) => {
          e.stopPropagation();
          onBarDown(activity, "resize", e);
        }}
      />
    </div>
  );
}

function linkGeometry(
  rows: ProgrammeActivity[],
  all: ProgrammeActivity[],
  origin: Date,
  px: number,
): Array<{ successorId: string; predecessorId: string; type: LinkType; lag: number; critical: boolean; d: string }> {
  const index = new Map(rows.map((a, i) => [a.id, i]));
  const out = [];
  for (const succ of rows) {
    if (succ.kind === "summary") continue;
    const toBox = barBox(succ, origin, px);
    const toRow = index.get(succ.id);
    if (!toBox || toRow == null) continue;
    for (const link of succ.predecessors) {
      const pred = all.find((a) => a.id === link.predecessorId);
      if (!pred) continue;
      const fromBox = barBox(pred, origin, px);
      const fromRow = index.get(pred.id);
      if (!fromBox || fromRow == null) continue;
      const y1 = HEAD + fromRow * ROW + ROW / 2;
      const y2 = HEAD + toRow * ROW + ROW / 2;
      const x1 = link.type === "SS" || link.type === "SF" ? fromBox.left : fromBox.left + fromBox.width;
      const x2 = link.type === "FF" || link.type === "SF" ? toBox.left + toBox.width : toBox.left;
      const elbow = x1 + (x2 >= x1 ? 10 : -10);
      const d = Math.abs(y1 - y2) < 2
        ? `M ${x1} ${y1} L ${x2} ${y2}`
        : `M ${x1} ${y1} H ${elbow} V ${y2} H ${x2}`;
      out.push({
        successorId: succ.id,
        predecessorId: pred.id,
        type: link.type,
        lag: link.lagWorkingDays,
        critical: Boolean(pred.critical && succ.critical),
        d,
      });
    }
  }
  return out;
}

function hitActivity(
  event: PointerEvent,
  rows: ProgrammeActivity[],
  origin: Date,
  px: number,
  chart: HTMLDivElement | null,
): { id: string; anchor: Anchor } | null {
  if (!chart) return null;
  const point = localPoint(event, chart);
  const row = Math.floor((point.y - HEAD) / ROW);
  const activity = rows[row];
  if (!activity || activity.kind === "summary") return null;
  const box = barBox(activity, origin, px);
  if (!box) return { id: activity.id, anchor: "start" };
  const mid = box.left + box.width / 2;
  return { id: activity.id, anchor: point.x < mid ? "start" : "finish" };
}

function localPoint(event: PointerEvent, chart: HTMLDivElement | null) {
  const rect = chart?.getBoundingClientRect();
  return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
}

function labelOf(activities: ProgrammeActivity[], id: string) {
  return activities.find((a) => a.id === id)?.activityId || id;
}

function predLabel(activity: ProgrammeActivity, outline: Map<string, number>, all: ProgrammeActivity[]) {
  return activity.predecessors.map((p) => {
    const id = outline.get(p.predecessorId) ?? all.find((a) => a.id === p.predecessorId)?.activityId ?? "?";
    const lag = p.lagWorkingDays ? `+${p.lagWorkingDays}d` : "";
    return `${id}${p.type}${lag}`;
  }).join(", ");
}

function formatDuration(activity: ProgrammeActivity) {
  if (activity.kind === "milestone") return "0d";
  if (activity.durationWorkingDays == null) return "—";
  const n = activity.durationWorkingDays;
  const label = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${label}d`;
}

function shortDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function workingSpan(programme: ConstructionProgramme) {
  const start = programme.activities.find((a) => a.activityKey === "milestone-start");
  const finish = programme.activities.find((a) => a.activityKey === "milestone-finish");
  if (start?.es != null && finish?.ef != null) return Math.max(0, Math.round(finish.ef - start.es));
  return programme.activities.find((a) => a.parentId == null && a.kind === "summary")?.durationWorkingDays ?? "—";
}

function dateRange(programme: ConstructionProgramme) {
  const dates = programme.activities.flatMap((a) => [a.plannedStart, a.plannedFinish, programme.setup.commencementDate.value]).filter(Boolean) as string[];
  dates.sort();
  const start = parse(dates[0] || "2026-01-01");
  const finish = dates.at(-1) || dates[0] || "2026-01-31";
  const end = parse(finish);
  const days = Math.min(420, Math.max(28, Math.round((end.getTime() - start.getTime()) / 86400000) + 10));
  return { start, days };
}

function monthBands(start: Date, days: number) {
  const bands: Array<{ key: string; label: string; days: number }> = [];
  for (let i = 0; i < days; i += 1) {
    const d = addDays(start, i);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const last = bands.at(-1);
    if (last && last.key === key) last.days += 1;
    else bands.push({ key, label: `${month(d)} ${d.getUTCFullYear()}`, days: 1 });
  }
  return bands;
}

function barBox(activity: ProgrammeActivity, origin: Date, px: number) {
  if (!activity.plannedStart || !activity.plannedFinish) return null;
  const a = parse(activity.plannedStart);
  const b = parse(activity.plannedFinish);
  const left = Math.max(0, ((a.getTime() - origin.getTime()) / 86400000) * px);
  const width = Math.max(px * 0.6, ((b.getTime() - origin.getTime()) / 86400000 - (a.getTime() - origin.getTime()) / 86400000 + 1) * px - 2);
  return { left, width };
}

function parse(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(date: Date, n: number) {
  return new Date(date.getTime() + n * 86400000);
}

function shiftIso(iso: string, days: number) {
  return addDays(parse(iso), days).toISOString().slice(0, 10);
}

function weekNum(date: Date) {
  const oneJan = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - oneJan.getTime()) / 86400000 + oneJan.getUTCDay() + 1) / 7);
}

function month(date: Date) {
  return date.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
}
