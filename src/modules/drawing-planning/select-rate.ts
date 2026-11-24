type RateLike = {
  activity_key: string;
  unit: string;
  is_default?: boolean;
};

export function selectRate<T extends RateLike>(
  rates: T[],
  activityKey: string,
  unit?: string | null,
): T | undefined {
  const family = rates.filter((r) => r.activity_key === activityKey);
  if (!family.length) return undefined;
  const wanted = unit?.trim().toLowerCase();
  const pool = wanted ? family.filter((r) => r.unit.toLowerCase() === wanted) : family;
  if (!pool.length) return undefined;
  return pool.find((r) => r.is_default) ?? pool[0];
}
