import { dateFromWorkingIndex, formatIsoDate, parseIsoDate, workingDayIndex } from "./calendar";
import { hasCycle, runCpm } from "./cpm";
import { calculateWorkingDays, setupHours, setupWeather } from "./duration";
import { validateProgramme } from "./validate";
import type { ConstructionProgramme, ProgrammeActivity } from "./types";

export function applySchedule(programme: ConstructionProgramme): ConstructionProgramme {
  const start = parseIsoDate(programme.setup.commencementDate.value);
  const prepared = programme.activities.map((activity) => prepareDuration(activity, programme));
  const constrained = prepared.map((activity) => {
    if (!activity.startConstraint || !start) return activity;
    const day = parseIsoDate(activity.startConstraint);
    if (!day) return activity;
    return { ...activity, es: workingDayIndex(start, day, programme.setup) };
  });
  const timed = hasCycle(constrained) ? constrained.map(clearCpm) : runCpm(constrained);
  const dated = timed.map((activity) => assignDates(activity, start, programme));
  const withSummaries = rollupSummaries(dated);
  const plannedCompletion = completionOf(withSummaries);
  const next: ConstructionProgramme = {
    ...programme,
    generatedAt: new Date().toISOString(),
    activities: withSummaries,
    plannedCompletion,
    contractCompletion: programme.setup.completionDate.value || null,
    criticalPath: withSummaries.filter((a) => a.critical && a.kind !== "summary").map((a) => a.id),
    warnings: [],
  };
  next.warnings = validateProgramme(next);
  return next;
}

function prepareDuration(activity: ProgrammeActivity, programme: ConstructionProgramme): ProgrammeActivity {
  if (activity.kind === "summary") return activity;
  if (activity.kind === "milestone") {
    return { ...activity, durationWorkingDays: 0, durationFormula: "Milestone", blockedReason: null };
  }
  if (activity.approval === "approved" && !activity.durationManual) return activity;
  const calc = calculateWorkingDays({
    quantity: activity.quantity,
    ratePerDay: activity.ratePerDay,
    teams: activity.teams,
    hoursPerDay: setupHours(programme.setup),
    weatherAllowancePct: setupWeather(programme.setup),
    durationManual: activity.durationManual,
    durationWorkingDays: activity.durationWorkingDays,
  });
  if (activity.approval === "approved") return activity;
  return {
    ...activity,
    durationWorkingDays: calc.days,
    durationFormula: calc.formula,
    blockedReason: calc.blockedReason,
  };
}

function assignDates(activity: ProgrammeActivity, start: Date | null, programme: ConstructionProgramme): ProgrammeActivity {
  if (!start || activity.es == null || activity.ef == null) {
    return { ...activity, plannedStart: null, plannedFinish: null };
  }
  const plannedStart = formatIsoDate(dateFromWorkingIndex(start, Math.floor(activity.es), programme.setup));
  const finishIndex = activity.kind === "milestone" || (activity.durationWorkingDays ?? 0) <= 0
    ? Math.floor(activity.es)
    : Math.max(Math.floor(activity.es), Math.ceil(activity.ef) - 1);
  const plannedFinish = formatIsoDate(dateFromWorkingIndex(start, finishIndex, programme.setup));
  return { ...activity, plannedStart, plannedFinish };
}

function rollupSummaries(activities: ProgrammeActivity[]): ProgrammeActivity[] {
  return activities.map((activity) => {
    if (activity.kind !== "summary") return activity;
    const kids = activities.filter((a) => a.parentId === activity.id && a.kind !== "summary");
    if (!kids.length) return activity;
    const starts = kids.map((k) => k.plannedStart).filter(Boolean) as string[];
    const finishes = kids.map((k) => k.plannedFinish).filter(Boolean) as string[];
    const days = kids.reduce((n, k) => n + (k.durationWorkingDays ?? 0), 0);
    return {
      ...activity,
      plannedStart: starts.sort()[0] ?? null,
      plannedFinish: finishes.sort().at(-1) ?? null,
      durationWorkingDays: round(days),
      durationFormula: "Sum of section working days (not elapsed).",
    };
  });
}

function completionOf(activities: ProgrammeActivity[]): string | null {
  const mile = activities.find((a) => a.activityKey === "milestone-finish");
  if (mile?.plannedFinish) return mile.plannedFinish;
  const dates = activities.map((a) => a.plannedFinish).filter(Boolean) as string[];
  return dates.sort().at(-1) ?? null;
}

function clearCpm(activity: ProgrammeActivity): ProgrammeActivity {
  return { ...activity, es: null, ef: null, ls: null, lf: null, totalFloat: null, freeFloat: null, critical: false };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
