import type { ProgrammeActivity } from "./types";

export function leafDescendants(activities: ProgrammeActivity[], parentId: string): ProgrammeActivity[] {
  const out: ProgrammeActivity[] = [];
  for (const child of activities.filter((a) => a.parentId === parentId)) {
    if (child.kind === "summary") out.push(...leafDescendants(activities, child.id));
    else out.push(child);
  }
  return out;
}

export function depthOf(activity: ProgrammeActivity, activities: ProgrammeActivity[]): number {
  const byId = new Map(activities.map((a) => [a.id, a]));
  let depth = 0;
  let parentId = activity.parentId;
  while (parentId) {
    depth += 1;
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return depth;
}

export function ancestorCollapsed(
  activity: ProgrammeActivity,
  collapsed: Set<string>,
  activities: ProgrammeActivity[],
): boolean {
  const byId = new Map(activities.map((a) => [a.id, a]));
  let parentId = activity.parentId;
  while (parentId) {
    if (collapsed.has(parentId)) return true;
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return false;
}
