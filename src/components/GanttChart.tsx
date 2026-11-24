"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import type { ConstructionProgramme, ProgrammeActivity } from "@/modules/programme/types";

type Scale = "day" | "week" | "month";

const PX: Record<Scale, number> = { day: 22, week: 10, month: 4 };

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
  const drag = useRef<{ id: string; mode: "move" | "resize"; startX: number; start: string; duration: number } | null>(null);
  const px = PX[scale];
  const rows = programme.activities.filter((a) => !a.parentId || !collapsed.has(a.parentId));
  const range = useMemo(() => dateRange(programme), [programme]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onPointerDown(activity: ProgrammeActivity, mode: "move" | "resize", event: PointerEvent<Element>) {
    if (!activity.plannedStart || activity.kind === "summary") return;
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = {
      id: activity.id,
      mode,
      startX: event.clientX,
      start: activity.plannedStart,
      duration: activity.durationWorkingDays ?? 1,
    };
  }

  function onPointerMove(event: PointerEvent<Element>) {
    const current = drag.current;
    if (!current) return;
    const deltaDays = Math.round((event.clientX - current.startX) / px);
    onChange(programme.activities.map((a) => {
      if (a.id !== current.id) return a;
      if (current.mode === "resize") {
        const days = Math.max(a.kind === "milestone" ? 0 : 0.5, current.duration + deltaDays);
        return { ...a, durationWorkingDays: days, durationManual: true, origin: "user", approval: a.approval === "approved" ? "edited" : a.approval };
      }
      const next = shiftIso(current.start, deltaDays);
      return { ...a, startConstraint: next, origin: "user", approval: a.approval === "approved" ? "edited" : a.approval };
    }));
  }

  function onPointerUp() {
    if (drag.current) onCommit?.(programme.activities);
    drag.current = null;
  }

  const width = Math.max(range.days * px, 400);

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap gap-2 text-sm">
        {(["day", "week", "month"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setScale(item)} className={`border px-3 py-1 ${scale === item ? "border-moss bg-moss text-paper" : "border-ink/30"}`}>
            {item}
          </button>
        ))}
        <p className="self-center text-xs text-ink/60">Drag a bar to move the start. Drag the right edge to override duration. Critical work is marked.</p>
      </div>
      <div className="max-w-full overflow-auto border border-rule" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <div className="flex min-w-full">
          <div className="sticky left-0 z-10 w-[260px] shrink-0 border-r border-rule bg-sheet">
            <div className="border-b border-rule px-2 py-2 font-mono text-[10px] uppercase tracking-widest text-brass">WBS / Activity</div>
            {rows.map((a) => (
              <div key={a.id} className="flex h-8 items-center gap-1 border-b border-rule/60 px-2 text-xs">
                {a.kind === "summary" ? (
                  <button type="button" className="w-4 text-moss" onClick={() => toggle(a.id)}>{collapsed.has(a.id) ? "+" : "–"}</button>
                ) : <span className="w-4" />}
                <span className={`truncate ${a.critical ? "text-stamp" : ""} ${a.kind === "summary" ? "font-medium" : ""}`}>
                  {a.wbs} {a.name}
                </span>
              </div>
            ))}
          </div>
          <div className="relative" style={{ width }}>
            <div className="flex border-b border-rule bg-paper/80">
              {Array.from({ length: range.days }, (_, i) => {
                const d = addDays(range.start, i);
                const label = scale === "day" ? d.getUTCDate() : scale === "week" ? (d.getUTCDay() === 1 ? `W${weekNum(d)}` : "") : (d.getUTCDate() === 1 ? month(d) : "");
                return (
                  <div key={i} className="h-8 border-r border-rule/40 text-center font-mono text-[9px] text-ink/50" style={{ width: px }}>
                    {label}
                  </div>
                );
              })}
            </div>
            {rows.map((a) => {
              const bar = barBox(a, range.start, px);
              return (
                <div key={a.id} className="relative h-8 border-b border-rule/60">
                  {bar ? (
                    <div
                      className={`absolute top-1.5 h-5 cursor-grab ${a.kind === "milestone" ? "rotate-45" : ""} ${a.critical ? "bg-stamp" : a.kind === "summary" ? "bg-brass/70" : "bg-moss"}`}
                      style={{ left: bar.left, width: a.kind === "milestone" ? 10 : bar.width }}
                      onPointerDown={(e) => onPointerDown(a, "move", e)}
                      title={`${a.name} ${a.plannedStart ?? ""} – ${a.plannedFinish ?? ""}`}
                    >
                      {a.kind !== "milestone" && a.kind !== "summary" ? (
                        <span
                          className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/20"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            onPointerDown(a, "resize", e);
                          }}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  {a.kind !== "summary" ? a.predecessors.map((p) => {
                    const pred = programme.activities.find((x) => x.id === p.predecessorId);
                    const from = pred ? barBox(pred, range.start, px) : null;
                    if (!from || !bar) return null;
                    const x1 = from.left + from.width;
                    const x2 = bar.left;
                    return (
                      <svg key={`${a.id}-${p.predecessorId}`} className="pointer-events-none absolute inset-0 h-8" style={{ width }}>
                        <path d={`M ${x1} 12 H ${Math.max(x1, x2 - 4)} L ${x2} 12`} stroke="#b08d3e" strokeWidth="1" fill="none" />
                      </svg>
                    );
                  }) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
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
