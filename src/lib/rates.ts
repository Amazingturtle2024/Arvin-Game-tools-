import { randomUUID } from "node:crypto";
import { MASTER_RATES } from "@/modules/drawing-planning/starter-rates";
import type { ProductionRate } from "@/modules/drawing-planning/types";
import { sql } from "./db";

const RATE_COLUMNS = `id, owner_id, activity_key, variant_key, trade, label, unit, rate_per_day, workers, teams, plant,
            hours_per_day, days_per_week, site_conditions, accessibility, weather_allowance_pct, notes, is_default`;

export async function listRates(ownerId: string): Promise<ProductionRate[]> {
  await seedRates(ownerId);
  return sql<ProductionRate>(
    `select ${RATE_COLUMNS}
     from production_rates where owner_id = $1
     order by trade, activity_key, label`,
    [ownerId],
  );
}

export async function saveRates(ownerId: string, rates: Partial<ProductionRate>[]): Promise<ProductionRate[]> {
  for (const rate of rates) {
    const variantKey = rate.variant_key || rate.activity_key;
    if (!rate.activity_key || !variantKey) continue;
    if (rate.is_default) {
      await sql(
        `update production_rates set is_default = false where owner_id = $1 and activity_key = $2`,
        [ownerId, rate.activity_key],
      );
    }
    await sql(
      `insert into production_rates (
         id, owner_id, activity_key, variant_key, trade, label, unit, rate_per_day, workers, teams, plant,
         hours_per_day, days_per_week, site_conditions, accessibility, weather_allowance_pct, notes, is_default
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       on conflict (owner_id, variant_key) do update set
         activity_key = excluded.activity_key,
         trade = excluded.trade,
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
         is_default = excluded.is_default,
         updated_at = now()`,
      [
        rate.id || randomUUID(),
        ownerId,
        rate.activity_key,
        variantKey,
        rate.trade ?? "",
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
        Boolean(rate.is_default),
      ],
    );
  }
  return listRates(ownerId);
}

async function seedRates(ownerId: string): Promise<void> {
  const [{ n }] = await sql<{ n: number }>(
    `select count(*)::int as n from production_rates where owner_id = $1`,
    [ownerId],
  );
  if (n < MASTER_RATES.length) {
    for (const row of MASTER_RATES) {
      await sql(
        `insert into production_rates (
           id, owner_id, activity_key, variant_key, trade, label, unit, rate_per_day, workers, teams, plant,
           hours_per_day, days_per_week, site_conditions, accessibility, weather_allowance_pct, notes, is_default
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,8,5,'','',0,$12,$13)
         on conflict (owner_id, variant_key) do nothing`,
        [
          randomUUID(),
          ownerId,
          row.activity_key,
          row.variant_key,
          row.trade,
          row.label,
          row.unit,
          row.rate_per_day,
          row.workers,
          row.teams,
          row.plant,
          row.notes,
          row.is_default,
        ],
      );
    }
  }
  await sql(
    `delete from production_rates where owner_id = $1 and notes like 'Starter rate%'`,
    [ownerId],
  );
  const counts = await sql<{ activity_key: string; n: number }>(
    `select activity_key, count(*)::int as n from production_rates
     where owner_id = $1 and is_default = true group by activity_key`,
    [ownerId],
  );
  const byFamily = new Map(counts.map((row) => [row.activity_key, row.n]));
  for (const row of MASTER_RATES.filter((r) => r.is_default)) {
    if (byFamily.get(row.activity_key) === 1) continue;
    await sql(
      `update production_rates set is_default = (variant_key = $3) where owner_id = $1 and activity_key = $2`,
      [ownerId, row.activity_key, row.variant_key],
    );
  }
}

function hoursPerDay(value: number | null | undefined): number {
  return value == null || Number.isNaN(value) ? 8 : value;
}

function teamsCount(value: number | null | undefined): number {
  return value == null || Number.isNaN(value) ? 1 : value;
}
