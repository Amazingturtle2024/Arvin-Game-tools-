import { parseIsoDate } from "./calendar";
import { hasCycle } from "./cpm";
import type { ConstructionProgramme, ProgrammeWarning } from "./types";

export function validateProgramme(programme: ConstructionProgramme): ProgrammeWarning[] {
  const warnings: ProgrammeWarning[] = [];
  const tasks = programme.activities.filter((a) => a.kind !== "summary");
  const start = tasks.find((a) => a.activityKey === "milestone-start");
  const finish = tasks.find((a) => a.activityKey === "milestone-finish");

  if (!start) {
    warnings.push(note("missing-start", "Missing start milestone", "Add a start-on-site milestone before issuing the programme.", null));
  }
  if (!finish) {
    warnings.push(note("missing-finish", "Missing completion milestone", "Add a completion milestone tied to the contract date.", null));
  }

  const work = tasks.filter((a) => a.kind === "task");
  if (work.length === 0) {
    warnings.push(note("missing-activities", "No construction activities", "Run Module 02 take-off or add activities from the bill before building logic.", null));
  }

  for (const activity of work) {
    if (activity.predecessors.length === 0) {
      warnings.push(note(`open-${activity.id}`, "Activity without a predecessor", `${activity.name} has no predecessor. Confirm it can start at possession, or add logic.`, activity.id));
    }
    if (!activity.ratePerDay && activity.quantity != null && !activity.durationManual) {
      warnings.push(warn(`rate-${activity.id}`, "Missing production rate", `${activity.name} has a quantity but no rate. Duration is blank.`, activity.id));
    }
    if (activity.durationWorkingDays == null && activity.kind === "task") {
      warnings.push(warn(`dur-${activity.id}`, "Duration not calculated", activity.blockedReason || `${activity.name} has no working-day duration.`, activity.id));
    }
    if (activity.durationWorkingDays != null && activity.durationWorkingDays > 60) {
      warnings.push(note(`long-${activity.id}`, "Unusually long duration", `${activity.name} is ${activity.durationWorkingDays} working days. Check quantity, teams and rate.`, activity.id));
    }
    for (const link of activity.predecessors) {
      if (link.predecessorId === activity.id) {
        warnings.push(warn(`self-${activity.id}`, "Incorrect relationship", `${activity.name} is linked to itself.`, activity.id));
      }
    }
  }

  if (hasCycle(programme.activities)) {
    warnings.push(warn("cycle", "Circular logic", "A relationship loop was found. Dates are not calculated until the loop is removed.", null));
  }

  const teams = programme.setup.teams.value;
  if (teams != null && teams > 0) {
    const concurrent = peakTeams(programme);
    if (concurrent > teams) {
      warnings.push(warn("resource", "Overlapping resource requirement", `Concurrent work needs about ${concurrent} teams; the setup lists ${teams}. Stagger logic or add teams.`, null));
    }
  }

  const contract = parseIsoDate(programme.setup.completionDate.value);
  const planned = parseIsoDate(programme.plannedCompletion);
  if (contract && planned && planned > contract) {
    warnings.push(warn("overrun", "Exceeds contract completion", `Planned finish ${programme.plannedCompletion} is after the contract date ${programme.setup.completionDate.value}.`, finish?.id ?? null));
  }
  if (contract && planned && planned < contract) {
    const gap = Math.round((contract.getTime() - planned.getTime()) / 86400000);
    if (gap > 20) {
      warnings.push(note("early", "Finishes well before the contract date", `Planned finish ${programme.plannedCompletion} is ${gap} calendar days before ${programme.setup.completionDate.value}. Confirm remaining scope is on the programme.`, finish?.id ?? null));
    }
  }
  if (!programme.setup.commencementDate.value) {
    warnings.push(warn("no-start-date", "Commencement date not entered", "Working-day dates cannot be calculated without a start date from the contract or the planner.", null));
  }

  return warnings;
}

function peakTeams(programme: ConstructionProgramme): number {
  const tasks = programme.activities.filter((a) => a.kind === "task" && a.es != null && a.ef != null);
  if (!tasks.length) return 0;
  const end = Math.max(...tasks.map((t) => t.ef ?? 0));
  let peak = 0;
  for (let t = 0; t <= end; t += 1) {
    const used = tasks.filter((a) => (a.es ?? 0) <= t && t < (a.ef ?? 0)).reduce((n, a) => n + Math.max(a.teams, 0), 0);
    if (used > peak) peak = used;
  }
  return peak;
}

function warn(id: string, title: string, detail: string, activityId: string | null): ProgrammeWarning {
  return { id, severity: "warning", title, detail, activityId };
}

function note(id: string, title: string, detail: string, activityId: string | null): ProgrammeWarning {
  return { id, severity: "note", title, detail, activityId };
}
