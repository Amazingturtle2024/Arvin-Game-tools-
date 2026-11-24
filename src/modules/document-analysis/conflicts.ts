import type { ConflictItem, ExtractedFact } from "./types";

const COMPARE_FIELDS = new Set([
  "contract_family",
  "project_name",
  "client",
  "starting_date",
  "access_date",
  "completion_date",
  "duration",
  "delay_damages",
  "retention",
  "main_option",
]);

export function findConflicts(facts: ExtractedFact[]): ConflictItem[] {
  const groups = new Map<string, ExtractedFact[]>();
  for (const fact of facts) {
    if (!COMPARE_FIELDS.has(fact.field)) continue;
    const list = groups.get(fact.field) ?? [];
    list.push(fact);
    groups.set(fact.field, list);
  }
  const conflicts: ConflictItem[] = [];
  for (const [field, list] of groups) {
    const unique = uniqueByValue(list);
    if (unique.length < 2) continue;
    conflicts.push({
      field,
      label: list[0].label,
      values: unique.map((f) => f.value),
      facts: unique,
      note: "These statements were found in the uploaded files and do not match. Nothing has been chosen between them.",
    });
  }

  const durationFacts = facts.filter((f) => f.field === "duration");
  const start = facts.find((f) => f.field === "starting_date");
  const finish = facts.find((f) => f.field === "completion_date");
  if (start && finish && durationFacts.length > 0) {
    const fromDates = daysBetween(parseLooseDate(start.value), parseLooseDate(finish.value));
    for (const duration of durationFacts) {
      const stated = durationToDays(duration.value);
      if (fromDates == null || stated == null) continue;
      if (Math.abs(fromDates - stated) > 10) {
        conflicts.push({
          field: "duration_vs_dates",
          label: "Construction period versus stated dates",
          values: [
            duration.value,
            `${start.value} to ${finish.value} (about ${Math.round(fromDates / 7)} weeks if both dates are calendar dates)`,
          ],
          facts: [duration, start, finish],
          note: "The stated period and the two dates were all found in the files. The gap is flagged because they do not line up. Date parsing can be wrong if the source used a non-calendar phrase.",
        });
      }
    }
  }
  return conflicts;
}

function uniqueByValue(facts: ExtractedFact[]): ExtractedFact[] {
  const map = new Map<string, ExtractedFact>();
  for (const fact of facts) {
    const key = normalize(fact.value);
    if (!map.has(key)) map.set(key, fact);
  }
  return [...map.values()];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9£$%./]+/g, " ").replace(/\s+/g, " ").trim();
}

export function parseLooseDate(value: string): Date | null {
  const cleaned = value.replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  const match = cleaned.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (match) {
    const date = new Date(`${match[1]} ${match[2]} ${match[3]} UTC`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function durationToDays(value: string): number | null {
  const weeks = value.match(/(\d+(?:\.\d+)?)\s*weeks?/i);
  if (weeks) return Number(weeks[1]) * 7;
  const months = value.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (months) return Number(months[1]) * 30;
  const days = value.match(/(\d+(?:\.\d+)?)\s*days?/i);
  if (days) return Number(days[1]);
  return null;
}

function daysBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
