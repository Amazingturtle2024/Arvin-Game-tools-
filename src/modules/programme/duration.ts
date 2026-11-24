import type { ProgrammeSetup } from "./types";

export function calculateWorkingDays(input: {
  quantity: number | null;
  ratePerDay: number | null;
  teams: number;
  hoursPerDay: number;
  weatherAllowancePct: number | null;
  durationManual: boolean;
  durationWorkingDays: number | null;
}): { days: number | null; formula: string; blockedReason: string | null } {
  if (input.durationManual) {
    if (input.durationWorkingDays == null) {
      return { days: null, formula: "Planner override — duration not entered.", blockedReason: "A manual duration was chosen but no working days were entered." };
    }
    return { days: round(input.durationWorkingDays), formula: `Planner override: ${input.durationWorkingDays} working days`, blockedReason: null };
  }
  if (input.quantity == null) {
    return { days: null, formula: "Duration not calculated", blockedReason: "Quantity is not stated. A duration has not been assumed." };
  }
  if (input.ratePerDay == null || input.ratePerDay <= 0) {
    return { days: null, formula: "Duration not calculated", blockedReason: "No production rate is entered for this activity. A duration has not been assumed." };
  }
  if (input.teams <= 0 || input.hoursPerDay <= 0) {
    return { days: null, formula: "Duration not calculated", blockedReason: "Teams and hours per day must be greater than zero. A duration has not been assumed." };
  }
  const hourFactor = input.hoursPerDay / 8;
  const daily = round(input.ratePerDay * input.teams * hourFactor);
  if (daily <= 0 || !Number.isFinite(daily)) {
    return { days: null, formula: "Duration not calculated", blockedReason: "Daily production capacity is zero. A duration has not been assumed." };
  }
  const weather = input.weatherAllowancePct ?? 0;
  const days = round((input.quantity / daily) * (1 + weather / 100));
  if (!Number.isFinite(days)) {
    return { days: null, formula: "Duration not calculated", blockedReason: "The duration was not a finite number." };
  }
  const weatherBit = weather ? ` × (1 + ${weather}% weather)` : "";
  const hourBit = hourFactor !== 1 ? ` × ${input.hoursPerDay}/8 h` : "";
  return {
    days,
    formula: `${input.quantity} ÷ (${input.ratePerDay}/day × ${input.teams} team(s)${hourBit})${weatherBit} = ${days} working days`,
    blockedReason: null,
  };
}

export function setupHours(setup: ProgrammeSetup): number {
  return setup.hoursPerDay.value > 0 ? setup.hoursPerDay.value : 8;
}

export function setupWeather(setup: ProgrammeSetup): number | null {
  return setup.weatherAllowancePct.value;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
