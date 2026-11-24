import { selectRate } from "./select-rate";
import type { DurationResult, ProductionRate, QuantityTakeoff } from "./types";

export function calculateDurations(takeoff: QuantityTakeoff[], rates: ProductionRate[]): DurationResult[] {
  const complete = takeoff.filter((t) => t.complete && t.quantity > 0);
  const grouped = new Map<string, QuantityTakeoff[]>();
  for (const item of complete) {
    const groupKey = `${item.activityKey}|${item.unit}`;
    const list = grouped.get(groupKey) ?? [];
    list.push(item);
    grouped.set(groupKey, list);
  }
  const results: DurationResult[] = [];
  for (const items of grouped.values()) {
    const key = items[0].activityKey;
    const rate = selectRate(rates, key, items[0].unit);
    const quantity = round(items.reduce((n, i) => n + i.quantity, 0));
    const unit = items[0].unit;
    const otherUnit = !rate ? rates.find((r) => r.activity_key === key) : undefined;
    const unitMismatch = Boolean(otherUnit);
    const hours = rate?.hours_per_day ?? 8;
    const teams = Math.max(rate?.teams ?? 1, 0);
    const invalidOutput = hours <= 0 || teams <= 0;
    if (!rate || rate.rate_per_day == null || rate.rate_per_day <= 0 || unitMismatch || invalidOutput) {
      results.push({
        activityKey: key,
        label: items.map((i) => i.label).join("; "),
        quantity,
        unit,
        ratePerDay: rate?.rate_per_day ?? otherUnit?.rate_per_day ?? null,
        teams: rate?.teams ?? otherUnit?.teams ?? 1,
        hoursPerDay: hours,
        daysPerWeek: rate?.days_per_week ?? otherUnit?.days_per_week ?? 5,
        weatherAllowancePct: rate?.weather_allowance_pct ?? otherUnit?.weather_allowance_pct ?? 0,
        effectiveDaily: null,
        durationWorkingDays: null,
        calendarWeeks: null,
        formula: "Duration not calculated",
        blockedReason: unitMismatch
          ? `The productivity table rate is in ${otherUnit?.unit}, not ${unit}. Units are not mixed to invent a duration.`
          : invalidOutput
            ? "Hours per day and teams must be greater than zero. A duration has not been assumed."
            : "No production rate is entered for this activity. Enter a rate in the productivity table. A duration has not been assumed.",
        plant: rate?.plant ?? "",
        workers: rate?.workers ?? 1,
        siteConditions: rate?.site_conditions ?? "",
        accessibility: rate?.accessibility ?? "",
      });
      continue;
    }
    const hourFactor = hours / 8;
    const usedTeams = Math.max(teams, 1);
    const effectiveDaily = round(rate.rate_per_day * usedTeams * hourFactor);
    if (effectiveDaily <= 0 || !Number.isFinite(effectiveDaily)) {
      results.push({
        activityKey: key,
        label: items.map((i) => i.label).join("; "),
        quantity,
        unit,
        ratePerDay: rate.rate_per_day,
        teams: usedTeams,
        hoursPerDay: hours,
        daysPerWeek: rate.days_per_week,
        weatherAllowancePct: rate.weather_allowance_pct,
        effectiveDaily: null,
        durationWorkingDays: null,
        calendarWeeks: null,
        formula: "Duration not calculated",
        blockedReason: "Effective daily output is zero. Enter a positive rate, team count and hours per day.",
        plant: rate.plant,
        workers: rate.workers,
        siteConditions: rate.site_conditions,
        accessibility: rate.accessibility,
      });
      continue;
    }
    const rawDays = quantity / effectiveDaily;
    const withWeather = rawDays * (1 + (rate.weather_allowance_pct || 0) / 100);
    const durationWorkingDays = round(withWeather);
    if (!Number.isFinite(durationWorkingDays)) {
      results.push({
        activityKey: key,
        label: items.map((i) => i.label).join("; "),
        quantity,
        unit,
        ratePerDay: rate.rate_per_day,
        teams: usedTeams,
        hoursPerDay: hours,
        daysPerWeek: rate.days_per_week,
        weatherAllowancePct: rate.weather_allowance_pct,
        effectiveDaily,
        durationWorkingDays: null,
        calendarWeeks: null,
        formula: "Duration not calculated",
        blockedReason: "The duration was not a finite number. Check rate, hours and quantity.",
        plant: rate.plant,
        workers: rate.workers,
        siteConditions: rate.site_conditions,
        accessibility: rate.accessibility,
      });
      continue;
    }
    const calendarWeeks = rate.days_per_week > 0 ? round(durationWorkingDays / rate.days_per_week) : null;
    results.push({
      activityKey: key,
      label: items.map((i) => i.label).join("; "),
      quantity,
      unit,
      ratePerDay: rate.rate_per_day,
      teams: usedTeams,
      hoursPerDay: hours,
      daysPerWeek: rate.days_per_week,
      weatherAllowancePct: rate.weather_allowance_pct,
      effectiveDaily,
      durationWorkingDays,
      calendarWeeks,
      formula: `${quantity} ${unit} ÷ (${rate.rate_per_day} ${unit}/day × ${usedTeams} team(s) × ${hours}/8 h) × (1 + ${rate.weather_allowance_pct}% weather) = ${durationWorkingDays} working days`,
      blockedReason: null,
      plant: rate.plant,
      workers: rate.workers,
      siteConditions: rate.site_conditions,
      accessibility: rate.accessibility,
    });
  }
  return results;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
