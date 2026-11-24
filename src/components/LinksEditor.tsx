"use client";

import { addLink, removeLink, replacePredecessor, updateLink } from "@/modules/programme/links";
import type { LinkType, ProgrammeActivity } from "@/modules/programme/types";

const TYPES: LinkType[] = ["FS", "SS", "FF", "SF"];

export function LinksEditor({
  activity,
  activities,
  onChange,
  compact = false,
  highlightPredecessorId,
}: {
  activity: ProgrammeActivity;
  activities: ProgrammeActivity[];
  onChange: (activities: ProgrammeActivity[]) => void;
  compact?: boolean;
  highlightPredecessorId?: string | null;
}) {
  const options = activities.filter((a) => a.kind !== "summary" && a.id !== activity.id);
  const unused = options.filter((a) => !activity.predecessors.some((p) => p.predecessorId === a.id));

  return (
    <div className={compact ? "space-y-1 text-xs" : "space-y-2 text-sm"}>
      {activity.predecessors.length === 0 && !compact ? (
        <p className="text-ink/60">No predecessors. This activity can start at possession unless you link it.</p>
      ) : null}
      {activity.predecessors.map((link) => {
        const pred = activities.find((a) => a.id === link.predecessorId);
        const highlighted = highlightPredecessorId === link.predecessorId;
        const choices = options.filter((a) => a.id === link.predecessorId || unused.some((u) => u.id === a.id));
        return (
          <div
            key={link.predecessorId}
            className={`flex flex-wrap items-center gap-2 ${compact ? "py-0.5" : "border-b border-rule/70 py-1"} ${highlighted ? "bg-moss/10" : ""}`}
          >
            <select
              className="field min-w-36"
              value={link.predecessorId}
              onChange={(e) => onChange(replacePredecessor(activities, activity.id, link.predecessorId, e.target.value))}
            >
              {choices.map((a) => (
                <option key={a.id} value={a.id}>{a.activityId} {a.name}</option>
              ))}
              {!pred ? <option value={link.predecessorId}>{link.predecessorId}</option> : null}
            </select>
            <select
              className="field w-16"
              value={link.type}
              title="FS finish-to-start · SS start-to-start · FF finish-to-finish · SF start-to-finish"
              onChange={(e) => onChange(updateLink(activities, activity.id, link.predecessorId, { type: e.target.value as LinkType }))}
            >
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs">
              Lag
              <input
                className="field w-14"
                type="number"
                value={link.lagWorkingDays}
                onChange={(e) => onChange(updateLink(activities, activity.id, link.predecessorId, { lagWorkingDays: Number(e.target.value) }))}
              />
            </label>
            <button
              type="button"
              className="text-xs uppercase tracking-wider text-stamp"
              onClick={() => onChange(removeLink(activities, activity.id, link.predecessorId))}
            >
              Remove
            </button>
          </div>
        );
      })}
      {activity.kind !== "summary" ? (
        <label className={`block ${compact ? "text-[10px]" : "text-xs"}`}>
          {compact ? "Add" : "Add predecessor"}
          <select
            className="field mt-1"
            value=""
            onChange={(e) => {
              if (e.target.value) onChange(addLink(activities, activity.id, e.target.value, "FS", 0));
            }}
          >
            <option value="">Link from…</option>
            {unused.map((a) => (
              <option key={a.id} value={a.id}>{a.activityId} {a.name}</option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
