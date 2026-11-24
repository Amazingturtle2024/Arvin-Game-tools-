"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { LinksEditor } from "./LinksEditor";
import { addLink, linkTypeFromAnchors } from "@/modules/programme/links";
import type { ConstructionProgramme, LinkType, ProgrammeActivity } from "@/modules/programme/types";

type Scale = "day" | "week" | "month";
type Anchor = "start" | "finish";

const PX: Record<Scale, number> = { day: 22, week: 10, month: 4 };
const ROW = 32;
const HEAD = 32;

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
  const rows = programme.activities.filter((a) => !a.parentId || !collapsed.has(a.parentId));
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const range = dateRange(programme);
  const width = Math.max(range.days * px, 400);
  const height = HEAD + rows.length * ROW;
  const selected = programme.activities.find((a) => a.id === selectedId) ?? null;

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
    setHint(`Drag onto another bar to create a ${anchor === "finish" ? "finish" : "start"} link.`);
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
          Drag a brass handle onto another bar to link them. Click a link or a bar to change type, lag or remove it. The sequence recalculates immediately.
        </p>
      </div>
      {hint ? <p className="text-sm text-moss">{hint}</p> : null}
      <div className="max-w-full overflow-auto border border-rule">
        <div className="flex min-w-full">
          <div className="sticky left-0 z-10 w-[280px] shrink-0 border-r border-rule bg-sheet">
            <div className="border-b border-rule px-2 py-2 font-mono text-[10px] uppercase tracking-widest text-brass" style={{ height: HEAD }}>WBS / Activity / links</div>
            {rows.map((a) => (
              <button
                type="button"
                key={a.id}
                className={`flex w-full items-center gap-1 border-b border-rule/60 px-2 text-left text-xs ${selectedId === a.id ? "bg-moss/10" : ""}`}
                style={{ height: ROW }}
                onClick={() => {
                  setSelectedId(a.id);
                  setSelectedLink(null);
                }}
              >
                {a.kind === "summary" ? (
                  <span className="w-4 text-moss" onClick={(e) => { e.stopPropagation(); toggle(a.id); }}>{collapsed.has(a.id) ? "+" : "–"}</span>
                ) : <span className="w-4" />}
                <span className={`truncate ${a.critical ? "text-stamp" : ""} ${a.kind === "summary" ? "font-medium" : ""}`}>
                  {a.wbs} {a.name}
                </span>
                {a.kind !== "summary" && a.predecessors.length ? (
                  <span className="ml-auto shrink-0 font-mono text-[9px] text-brass">
                    {a.predecessors.map((p) => `${labelOf(programme.activities, p.predecessorId)} ${p.type}${p.lagWorkingDays ? `+${p.lagWorkingDays}` : ""}`).join(" · ")}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="relative select-none" ref={chartRef} style={{ width, height }}>
            <svg className="pointer-events-none absolute left-0 top-0 z-0" width={width} height={height}>
              {linkGeometry(rows, programme.activities, range.start, px).map((geom) => {
                const active = selectedLink?.successorId === geom.successorId && selectedLink?.predecessorId === geom.predecessorId;
                return (
                  <g key={`${geom.successorId}-${geom.predecessorId}`} className="pointer-events-auto">
                    <path d={geom.d} stroke="transparent" strokeWidth="12" fill="none" className="cursor-pointer" onClick={() => {
                      setSelectedLink({ successorId: geom.successorId, predecessorId: geom.predecessorId });
                      setSelectedId(geom.successorId);
                      setHint(`Edit ${geom.type} link${geom.lag ? ` with ${geom.lag} working days lag` : ""} below, or remove it.`);
                    }} />
                    <path d={geom.d} stroke={active ? "#9c2a2a" : "#b08d3e"} strokeWidth={active ? 2.2 : 1.4} fill="none" markerEnd="url(#gantt-arrow)" />
                    <text x={geom.labelX} y={geom.labelY} fontSize="9" fill="#7a6a3a">{geom.type}{geom.lag ? `+${geom.lag}` : ""}</text>
                  </g>
                );
              })}
              <defs>
                <marker id="gantt-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#b08d3e" />
                </marker>
              </defs>
            </svg>
            <svg className="pointer-events-none absolute left-0 top-0 z-20" width={width} height={height}>
              {wire ? <path d={`M ${wire.x1} ${wire.y1} L ${wire.x2} ${wire.y2}`} stroke="#2f4f3e" strokeDasharray="4 3" fill="none" /> : null}
            </svg>
            <div className="pointer-events-none relative z-10 flex border-b border-rule bg-paper/80" style={{ height: HEAD }}>
              {Array.from({ length: range.days }, (_, i) => {
                const d = addDays(range.start, i);
                const label = scale === "day" ? d.getUTCDate() : scale === "week" ? (d.getUTCDay() === 1 ? `W${weekNum(d)}` : "") : (d.getUTCDate() === 1 ? month(d) : "");
                return (
                  <div key={i} className="border-r border-rule/40 text-center font-mono text-[9px] text-ink/50" style={{ width: px, height: HEAD }}>
                    {label}
                  </div>
                );
              })}
            </div>
            {rows.map((a) => {
              const bar = barBox(a, range.start, px);
              return (
                <div key={a.id} className={`pointer-events-none relative z-10 border-b border-rule/60 ${selectedId === a.id ? "bg-moss/5" : ""}`} style={{ height: ROW }}>
                  {bar ? (
                    <div
                      className={`pointer-events-auto absolute top-2 h-5 cursor-grab ${a.kind === "milestone" ? "rotate-45" : ""} ${a.critical ? "bg-stamp" : a.kind === "summary" ? "bg-brass/70" : "bg-moss"}`}
                      style={{ left: bar.left, width: a.kind === "milestone" ? 10 : bar.width }}
                      onPointerDown={(e) => onBarDown(a, "move", e)}
                      title={`${a.name} ${a.plannedStart ?? ""} – ${a.plannedFinish ?? ""}`}
                    >
                      {a.kind !== "summary" ? (
                        <>
                          <span
                            className="absolute -left-1.5 top-1 z-20 h-3 w-3 cursor-crosshair rounded-full border border-paper bg-brass"
                            title="Drag from the start to link (SS or SF)"
                            onPointerDown={(e) => onHandleDown(a, "start", e)}
                          />
                          <span
                            className="absolute -right-1.5 top-1 z-20 h-3 w-3 cursor-crosshair rounded-full border border-paper bg-brass"
                            title="Drag from the finish to link (FS or FF)"
                            onPointerDown={(e) => onHandleDown(a, "finish", e)}
                          />
                        </>
                      ) : null}
                      {a.kind !== "milestone" && a.kind !== "summary" ? (
                        <span
                          className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-ew-resize bg-black/20"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            onBarDown(a, "resize", e);
                          }}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {selected && selected.kind !== "summary" ? (
        <div className="border border-rule bg-paper/70 p-4">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{selected.activityId} {selected.name}</p>
            <p className="citation">{selected.plannedStart || "—"} → {selected.plannedFinish || "—"} · {selected.durationWorkingDays ?? "—"} wd</p>
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
        </div>
      ) : (
        <p className="text-sm text-ink/60">Select a task to change its predecessors, relationship type and lag at any time.</p>
      )}
    </div>
  );
}

function linkGeometry(
  rows: ProgrammeActivity[],
  all: ProgrammeActivity[],
  origin: Date,
  px: number,
): Array<{ successorId: string; predecessorId: string; type: LinkType; lag: number; d: string; labelX: number; labelY: number }> {
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
      const elbow = x1 + (x2 >= x1 ? 18 : -18);
      const d = Math.abs(y1 - y2) < 2
        ? `M ${x1} ${y1} L ${x2} ${y2}`
        : `M ${x1} ${y1} H ${elbow} V ${y2} H ${x2}`;
      out.push({
        successorId: succ.id,
        predecessorId: pred.id,
        type: link.type,
        lag: link.lagWorkingDays,
        d,
        labelX: elbow + 4,
        labelY: (y1 + y2) / 2 - 3,
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

function dateRange(programme: ConstructionProgramme) {
  const dates = programme.activities.flatMap((a) => [a.plannedStart, a.plannedFinish, programme.setup.commencementDate.value]).filter(Boolean) as string[];
  dates.sort();
  const start = parse(dates[0] || "2026-01-01");
  const finish = dates.at(-1) || dates[0] || "2026-01-31";
  const end = parse(finish);
  const days = Math.min(180, Math.max(21, Math.round((end.getTime() - start.getTime()) / 86400000) + 7));
  return { start, days };
}

function barBox(activity: ProgrammeActivity, origin: Date, px: number) {
  if (!activity.plannedStart || !activity.plannedFinish) return null;
  const a = parse(activity.plannedStart);
  const b = parse(activity.plannedFinish);
  const left = Math.max(0, ((a.getTime() - origin.getTime()) / 86400000) * px);
  const width = Math.max(px * 0.6, ((b.getTime() - a.getTime()) / 86400000 + 1) * px - 2);
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
