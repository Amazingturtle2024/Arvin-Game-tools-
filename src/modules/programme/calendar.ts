import type { ProgrammeSetup, WorkingPattern } from "./types";

const MS_DAY = 86_400_000;

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export function parseEnglishDate(text: string | null | undefined): string | null {
  if (!text) return null;
  const iso = parseIsoDate(text.trim());
  if (iso) return formatIsoDate(iso);
  const match = text.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  const date = new Date(Date.UTC(Number(match[3]), month - 1, Number(match[1])));
  return Number.isNaN(date.getTime()) ? null : formatIsoDate(date);
}

export function weekdayFlags(setup: ProgrammeSetup): boolean[] {
  const flags = [false, true, true, true, true, true, false];
  const pattern: WorkingPattern = setup.workingPattern.value;
  if (pattern === "monday_saturday" || setup.saturdays.value) flags[6] = true;
  if (pattern === "monday_friday") flags[6] = false;
  if (setup.sundays.value) flags[0] = true;
  if (pattern === "custom") {
    flags[6] = setup.saturdays.value;
    flags[0] = setup.sundays.value;
  }
  return flags;
}

function holidaySet(setup: ProgrammeSetup): Set<string> {
  const dates = new Set<string>();
  if (setup.publicHolidays.value === "exclude") {
    for (const day of setup.holidayDates.value) {
      const iso = parseEnglishDate(day) ?? parseIsoDate(day.trim())?.toISOString().slice(0, 10);
      if (iso) dates.add(iso);
    }
  }
  const shutdown = setup.annualShutdown.value.trim();
  const range = shutdown.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|–|-)\s*(\d{4}-\d{2}-\d{2})/i)
    ?? shutdown.match(/(\d{1,2}\s+\w+\s+\d{4})\s*(?:to|–|-)\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  if (range) {
    const start = parseEnglishDate(range[1]) ?? parseIsoDate(range[1])?.toISOString().slice(0, 10);
    const end = parseEnglishDate(range[2]) ?? parseIsoDate(range[2])?.toISOString().slice(0, 10);
    const a = start ? parseIsoDate(start) : null;
    const b = end ? parseIsoDate(end) : null;
    if (a && b && b >= a) {
      for (let d = new Date(a); d <= b; d = new Date(d.getTime() + MS_DAY)) {
        dates.add(formatIsoDate(d));
      }
    }
  }
  return dates;
}

export function isWorkingDay(date: Date, setup: ProgrammeSetup): boolean {
  const flags = weekdayFlags(setup);
  if (!flags[date.getUTCDay()]) return false;
  const holidays = holidaySet(setup);
  return !holidays.has(formatIsoDate(date));
}

export function nextWorkingDay(date: Date, setup: ProgrammeSetup): Date {
  let cursor = date;
  for (let i = 0; i < 3660; i += 1) {
    if (isWorkingDay(cursor, setup)) return cursor;
    cursor = new Date(cursor.getTime() + MS_DAY);
  }
  return date;
}

export function addWorkingDays(start: Date, workingDays: number, setup: ProgrammeSetup): Date {
  const origin = nextWorkingDay(start, setup);
  if (workingDays <= 0) return origin;
  let remaining = workingDays;
  let cursor = origin;
  while (remaining > 1) {
    cursor = new Date(cursor.getTime() + MS_DAY);
    if (isWorkingDay(cursor, setup)) remaining -= 1;
  }
  return cursor;
}

export function workingDaysBetween(start: Date, finish: Date, setup: ProgrammeSetup): number {
  if (finish < start) return 0;
  let n = 0;
  for (let d = new Date(start); d <= finish; d = new Date(d.getTime() + MS_DAY)) {
    if (isWorkingDay(d, setup)) n += 1;
  }
  return n;
}

export function workingDayIndex(start: Date, date: Date, setup: ProgrammeSetup): number {
  const origin = nextWorkingDay(start, setup);
  if (date <= origin) return 0;
  let n = 0;
  for (let d = origin; d < date; d = new Date(d.getTime() + MS_DAY)) {
    if (isWorkingDay(d, setup)) n += 1;
  }
  return n;
}

export function dateFromWorkingIndex(start: Date, index: number, setup: ProgrammeSetup): Date {
  const origin = nextWorkingDay(start, setup);
  if (index <= 0) return origin;
  return addWorkingDays(origin, index + 1, setup);
}
