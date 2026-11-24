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
    const rate = rates.find((r) => r.activity_key === key && r.unit.toLowerCase() === items[0].unit.toLowerCase())
      ?? rates.find((r) => r.activity_key === key);
    const quantity = round(items.reduce((n, i) => n + i.quantity, 0));
    const unit = items[0].unit;
    const unitMismatch = Boolean(rate && rate.unit.toLowerCase() !== unit.toLowerCase());
    if (!rate || rate.rate_per_day == null || rate.rate_per_day <= 0 || unitMismatch) {
      results.push({
        activityKey: key,
        label: items.map((i) => i.label).join("; "),
        quantity,
        unit,
        ratePerDay: rate?.rate_per_day ?? null,
        teams: rate?.teams ?? 1,
        hoursPerDay: rate?.hours_per_day ?? 8,
        daysPerWeek: rate?.days_per_week ?? 5,
        weatherAllowancePct: rate?.weather_allowance_pct ?? 0,
        effectiveDaily: null,
        durationWorkingDays: null,
        calendarWeeks: null,
        formula: "Duration not calculated",
        blockedReason: unitMismatch
          ? `The productivity table rate is in ${rate?.unit}, not ${unit}. Units are not mixed to invent a duration.`
          : "No production rate is entered for this activity. Enter a rate in the productivity table. A duration has not been assumed.",
        plant: rate?.plant ?? "",
        workers: rate?.workers ?? 1,
        siteConditions: rate?.site_conditions ?? "",
        accessibility: rate?.accessibility ?? "",
      });
      continue;
    }
    const hourFactor = rate.hours_per_day / 8;
    const teams = Math.max(rate.teams, 1);
    const effectiveDaily = round(rate.rate_per_day * teams * hourFactor);
    const rawDays = quantity / effectiveDaily;
    const withWeather = rawDays * (1 + (rate.weather_allowance_pct || 0) / 100);
    const durationWorkingDays = round(withWeather);
    const calendarWeeks = rate.days_per_week > 0 ? round(durationWorkingDays / rate.days_per_week) : null;
    results.push({
      activityKey: key,
      label: items.map((i) => i.label).join("; "),
      quantity,
      unit,
      ratePerDay: rate.rate_per_day,
      teams,
      hoursPerDay: rate.hours_per_day,
      daysPerWeek: rate.days_per_week,
      weatherAllowancePct: rate.weather_allowance_pct,
      effectiveDaily,
      durationWorkingDays,
      calendarWeeks,
      formula: `${quantity} ${unit} ÷ (${rate.rate_per_day} ${unit}/day × ${teams} team(s) × ${rate.hours_per_day}/8 h) × (1 + ${rate.weather_allowance_pct}% weather) = ${durationWorkingDays} working days`,
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
