/** Move speed slider: 1 (slow) … 10 (fast). Default 5 is a bit slower than the original feel. */
export const MOVE_SPEED_MIN = 1;
export const MOVE_SPEED_MAX = 10;
export const MOVE_SPEED_DEFAULT = 5;

const STORAGE_KEY = "lostKingdom.moveSpeed";

export function clampMoveSpeed(level: number): number {
  return Math.min(MOVE_SPEED_MAX, Math.max(MOVE_SPEED_MIN, Math.round(level)));
}

export function loadMoveSpeed(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return MOVE_SPEED_DEFAULT;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return MOVE_SPEED_DEFAULT;
    return clampMoveSpeed(parsed);
  } catch {
    return MOVE_SPEED_DEFAULT;
  }
}

export function saveMoveSpeed(level: number): number {
  const next = clampMoveSpeed(level);
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Ignore quota / private-mode failures.
  }
  return next;
}

/** Walk pixels/sec for a 1–10 level. Level 7 ≈ original 140. */
export function walkSpeedFor(level: number): number {
  const n = clampMoveSpeed(level);
  return 50 + n * 12;
}

/** Run is ~1.55× walk (original was 220/140). */
export function runSpeedFor(level: number): number {
  return Math.round(walkSpeedFor(level) * 1.55);
}
