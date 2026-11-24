import { hasCycle } from "./cpm";
import type { ActivityLink, FieldOrigin, LinkType, ProgrammeActivity } from "./types";

function markEdited(activity: ProgrammeActivity): ProgrammeActivity {
  return { ...activity, origin: "user", approval: "edited" };
}

export function addLink(
  activities: ProgrammeActivity[],
  successorId: string,
  predecessorId: string,
  type: LinkType = "FS",
  lagWorkingDays = 0,
): ProgrammeActivity[] {
  if (successorId === predecessorId) return activities;
  const pred = activities.find((a) => a.id === predecessorId);
  const succ = activities.find((a) => a.id === successorId);
  if (!pred || !succ || pred.kind === "summary" || succ.kind === "summary") return activities;
  const next = activities.map((activity) => {
    if (activity.id !== successorId) return activity;
    const existing = activity.predecessors.find((p) => p.predecessorId === predecessorId);
    const link: ActivityLink = {
      predecessorId,
      type,
      lagWorkingDays,
      origin: "user",
      why: existing?.why || "Planner linked these activities.",
    };
    const predecessors = existing
      ? activity.predecessors.map((p) => (p.predecessorId === predecessorId ? link : p))
      : [...activity.predecessors, link];
    return markEdited({ ...activity, predecessors });
  });
  return hasCycle(next) ? activities : next;
}

export function removeLink(
  activities: ProgrammeActivity[],
  successorId: string,
  predecessorId: string,
): ProgrammeActivity[] {
  return activities.map((activity) => {
    if (activity.id !== successorId) return activity;
    return markEdited({
      ...activity,
      predecessors: activity.predecessors.filter((p) => p.predecessorId !== predecessorId),
    });
  });
}

export function updateLink(
  activities: ProgrammeActivity[],
  successorId: string,
  predecessorId: string,
  patch: Partial<Pick<ActivityLink, "type" | "lagWorkingDays">>,
): ProgrammeActivity[] {
  const next = activities.map((activity) => {
    if (activity.id !== successorId) return activity;
    return markEdited({
      ...activity,
      predecessors: activity.predecessors.map((p) => (
        p.predecessorId === predecessorId
          ? { ...p, ...patch, origin: "user" as FieldOrigin, why: p.why || "Planner edited this link." }
          : p
      )),
    });
  });
  return hasCycle(next) ? activities : next;
}

export function replacePredecessor(
  activities: ProgrammeActivity[],
  successorId: string,
  oldPredecessorId: string,
  newPredecessorId: string,
): ProgrammeActivity[] {
  if (oldPredecessorId === newPredecessorId) return activities;
  const current = activities.find((a) => a.id === successorId);
  const existing = current?.predecessors.find((p) => p.predecessorId === oldPredecessorId);
  if (!existing) return activities;
  if (current?.predecessors.some((p) => p.predecessorId === newPredecessorId)) return activities;
  const next = activities.map((activity) => {
    if (activity.id !== successorId) return activity;
    return markEdited({
      ...activity,
      predecessors: activity.predecessors.map((p) => (
        p.predecessorId === oldPredecessorId
          ? { ...p, predecessorId: newPredecessorId, origin: "user" as FieldOrigin }
          : p
      )),
    });
  });
  return hasCycle(next) ? activities : next;
}

export function linkTypeFromAnchors(from: "start" | "finish", to: "start" | "finish"): LinkType {
  if (from === "start" && to === "start") return "SS";
  if (from === "finish" && to === "finish") return "FF";
  if (from === "start" && to === "finish") return "SF";
  return "FS";
}
