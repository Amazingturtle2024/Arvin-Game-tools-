import type { TenderReviewReport } from "@/modules/document-analysis/types";
import type { DrawingPlanningReport, ProductionRate } from "@/modules/drawing-planning/types";
import { parseEnglishDate } from "./calendar";
import type { FieldOrigin, FilledField, ProgrammeSetup, WorkingPattern } from "./types";

function field<T>(value: T, origin: FieldOrigin, sourceLabel: string | null): FilledField<T> {
  return { value, origin, sourceLabel };
}

function fact(report: TenderReviewReport | null, fieldName: string): { value: string; label: string } | null {
  if (!report) return null;
  const rows = [
    ...report.projectDetails,
    ...report.timeProvisions,
    ...report.scopeOfWorks,
    ...report.specifications,
    ...(report.contract.facts ?? []),
  ];
  const hit = rows.find((f) => f.field === fieldName);
  if (!hit) return null;
  return { value: hit.value.trim(), label: `${hit.source.documentName} · ${hit.source.locationLabel}` };
}

function parseHours(text: string | null): { hours: number | null; label: string | null; saturdays: boolean | null; pattern: WorkingPattern | null } {
  if (!text) return { hours: null, label: null, saturdays: null, pattern: null };
  const span = text.match(/(\d{1,2}:\d{2})\s*(?:to|–|-)\s*(\d{1,2}:\d{2})/i);
  let hours: number | null = null;
  let label: string | null = null;
  if (span) {
    const [sh, sm] = span[1].split(":").map(Number);
    const [eh, em] = span[2].split(":").map(Number);
    const mins = eh * 60 + em - (sh * 60 + sm);
    if (mins > 0) hours = Math.round((mins / 60) * 100) / 100;
    label = `${span[1]} – ${span[2]}`;
  }
  const noSat = /no saturday/i.test(text);
  const sat = /saturday/i.test(text) && !noSat;
  const monFri = /monday\s+to\s+friday/i.test(text);
  return {
    hours,
    label,
    saturdays: noSat ? false : sat ? true : null,
    pattern: monFri ? "monday_friday" : sat ? "monday_saturday" : null,
  };
}

export function seedSetup(input: {
  projectName: string;
  tender: TenderReviewReport | null;
  drawings: DrawingPlanningReport | null;
  rates: ProductionRate[];
}): ProgrammeSetup {
  const tender = input.tender;
  const name = fact(tender, "project_name");
  const client = fact(tender, "client");
  const pm = fact(tender, "project_manager");
  const contractor = fact(tender, "contractor");
  const site = fact(tender, "site");
  const start = fact(tender, "starting_date") ?? fact(tender, "access_date");
  const finish = fact(tender, "completion_date");
  const duration = fact(tender, "duration");
  const hoursFact = fact(tender, "working_hours");
  const hours = parseHours(hoursFact?.value ?? null);
  const family = tender?.contract.status === "identified"
    ? [tender.contract.family, tender.contract.edition, tender.contract.option].filter(Boolean).join(" · ")
    : "";
  const contractLabel = tender?.contract.status === "identified"
    ? tender.contract.facts[0]?.source.documentName ?? "Contract documents"
    : null;

  const rate = input.rates[0];
  const teams = input.rates.reduce((n, r) => Math.max(n, r.teams || 0), 0) || null;
  const workers = input.rates.reduce((n, r) => Math.max(n, r.workers || 0), 0) || null;
  const plant = [...new Set(input.rates.map((r) => r.plant).filter(Boolean))].join("; ");

  const commencement = parseEnglishDate(start?.value ?? "") ?? "";
  const completion = parseEnglishDate(finish?.value ?? "") ?? "";

  return {
    projectName: field(name?.value || input.projectName, name ? "module-01" : "user", name?.label ?? null),
    client: field(client?.value ?? "", client ? "module-01" : "user", client?.label ?? null),
    consultant: field(pm?.value ?? "", pm ? "module-01" : "user", pm?.label ?? null),
    mainContractor: field(contractor?.value ?? "", contractor ? "module-01" : "user", contractor?.label ?? null),
    location: field(site?.value ?? "", site ? "module-01" : "user", site?.label ?? null),
    contractNumber: field("", "user", null),
    contractType: field(family, family ? "module-01" : "user", contractLabel),
    contractDuration: field(duration?.value ?? "", duration ? "module-01" : "user", duration?.label ?? null),
    commencementDate: field(commencement, commencement ? "module-01" : "user", start?.label ?? null),
    completionDate: field(completion, completion ? "module-01" : "user", finish?.label ?? null),
    workingPattern: field(hours.pattern ?? "monday_friday", hours.pattern ? "module-01" : "user", hoursFact?.label ?? null),
    hoursPerDay: field(rate?.hours_per_day ?? 8, rate ? "module-02" : "user", rate ? "Productivity table" : null),
    workingHours: field(hours.label ?? "", hours.label ? "module-01" : "user", hoursFact?.label ?? null),
    saturdays: field(hours.saturdays ?? false, hours.saturdays != null ? "module-01" : "user", hoursFact?.label ?? null),
    sundays: field(false, "user", null),
    publicHolidays: field("exclude", "user", null),
    holidayDates: field([], "user", null),
    annualShutdown: field("", "user", null),
    weatherAllowancePct: field(null, "user", null),
    generalWorkers: field(workers, workers != null ? "module-02" : "user", workers != null ? "Productivity table" : null),
    skilledWorkers: field(null, "user", null),
    supervisors: field(null, "user", null),
    teams: field(teams, teams != null ? "module-02" : "user", teams != null ? "Productivity table" : null),
    plant: field(plant, plant ? "module-02" : "user", plant ? "Productivity table" : null),
  };
}
