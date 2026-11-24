import { randomUUID } from "node:crypto";
import { STARTER_RATES } from "@/modules/drawing-planning/starter-rates";
import type { ProductionRate } from "@/modules/drawing-planning/types";
import { sql } from "./db";

export async function listRates(ownerId: string): Promise<ProductionRate[]> {
  await seedRates(ownerId);
  return sql<ProductionRate>(
    `select id, owner_id, activity_key, label, unit, rate_per_day, workers, teams, plant,
            hours_per_day, days_per_week, site_conditions, accessibility, weather_allowance_pct, notes
     from production_rates where owner_id = $1 order by label`,
    [ownerId],
  );
}

export async function saveRates(ownerId: string, rates: Partial<ProductionRate>[]): Promise<ProductionRate[]> {
  for (const rate of rates) {
    if (!rate.activity_key) continue;
    await sql(
      `insert into production_rates (
         id, owner_id, activity_key, label, unit, rate_per_day, workers, teams, plant,
         hours_per_day, days_per_week, site_conditions, accessibility, weather_allowance_pct, notes
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       on conflict (owner_id, activity_key) do update set
         label = excluded.label,
         unit = excluded.unit,
         rate_per_day = excluded.rate_per_day,
         workers = excluded.workers,
         teams = excluded.teams,
         plant = excluded.plant,
         hours_per_day = excluded.hours_per_day,
         days_per_week = excluded.days_per_week,
         site_conditions = excluded.site_conditions,
         accessibility = excluded.accessibility,
         weather_allowance_pct = excluded.weather_allowance_pct,
         notes = excluded.notes,
         updated_at = now()`,
      [
        rate.id || randomUUID(),
        ownerId,
        rate.activity_key,
        rate.label || rate.activity_key,
        rate.unit || "m3",
        rate.rate_per_day ?? null,
        rate.workers ?? 1,
        teamsCount(rate.teams),
        rate.plant ?? "",
        hoursPerDay(rate.hours_per_day),
        rate.days_per_week ?? 5,
        rate.site_conditions ?? "",
        rate.accessibility ?? "",
        rate.weather_allowance_pct ?? 0,
        rate.notes ?? "",
      ],
    );
  }
  return listRates(ownerId);
}

async function seedRates(ownerId: string): Promise<void> {
  for (const row of STARTER_RATES) {
    await sql(
      `insert into production_rates (
         id, owner_id, activity_key, label, unit, rate_per_day, workers, teams, plant,
         hours_per_day, days_per_week, site_conditions, accessibility, weather_allowance_pct, notes
       ) values ($1,$2,$3,$4,$5,$6,1,1,$7,8,5,'','',0,$8)
       on conflict (owner_id, activity_key) do nothing`,
      [randomUUID(), ownerId, row.activity_key, row.label, row.unit, row.rate_per_day, row.plant, row.notes],
    );
  }
}

function hoursPerDay(value: number | null | undefined): number {
  return value != null && value > 0 ? value : 8;
}

function teamsCount(value: number | null | undefined): number {
  return value != null && value > 0 ? value : 1;
}
