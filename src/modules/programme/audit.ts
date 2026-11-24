import type { AuditChange, ConstructionProgramme } from "./types";

export function diffProgrammes(before: ConstructionProgramme | null, after: ConstructionProgramme): AuditChange[] {
  if (!before) {
    return [{ activityId: null, field: "revision", from: "", to: String(after.revision) }];
  }
  const changes: AuditChange[] = [];
  if (before.status !== after.status) {
    changes.push({ activityId: null, field: "status", from: before.status, to: after.status });
  }
  for (const key of Object.keys(after.setup) as Array<keyof ConstructionProgramme["setup"]>) {
    const prev = JSON.stringify(before.setup[key].value);
    const next = JSON.stringify(after.setup[key].value);
    if (prev !== next) {
      changes.push({ activityId: null, field: `setup.${String(key)}`, from: String(before.setup[key].value), to: String(after.setup[key].value) });
    }
  }
  const beforeById = new Map(before.activities.map((a) => [a.id, a]));
  for (const activity of after.activities) {
    const prev = beforeById.get(activity.id);
    if (!prev) {
      changes.push({ activityId: activity.id, field: "activity", from: "", to: activity.name });
      continue;
    }
    const fields: Array<keyof typeof activity> = [
      "name", "quantity", "unit", "ratePerDay", "teams", "durationWorkingDays", "durationManual",
      "plannedStart", "plannedFinish", "startConstraint", "responsible", "status", "progressPct", "approval",
    ];
    for (const field of fields) {
      if (String(prev[field] ?? "") !== String(activity[field] ?? "")) {
        changes.push({ activityId: activity.id, field, from: String(prev[field] ?? ""), to: String(activity[field] ?? "") });
      }
    }
    const pred = (row: typeof activity) => row.predecessors.map((p) => `${p.predecessorId}:${p.type}:${p.lagWorkingDays}`).join(",");
    if (pred(prev) !== pred(activity)) {
      changes.push({ activityId: activity.id, field: "predecessors", from: pred(prev), to: pred(activity) });
    }
  }
  return changes;
}
