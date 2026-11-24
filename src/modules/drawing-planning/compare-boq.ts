import type { BoqLine } from "@/modules/document-analysis/boq-items";
import type { BoqVariance, QuantityTakeoff } from "./types";

const KEYWORDS: Array<{ key: string; words: string[] }> = [
  { key: "excavation", words: ["excavat"] },
  { key: "concrete", words: ["concrete", "in-situ"] },
  { key: "formwork", words: ["formwork", "shutter"] },
  { key: "reinforcement", words: ["reinforcement", "rebar"] },
  { key: "brickwork", words: ["brick"] },
  { key: "pipe", words: ["drain", "pipe", "sewer"] },
  { key: "backfill", words: ["backfill"] },
  { key: "compaction", words: ["compact"] },
  { key: "roadworks", words: ["road", "pavement", "asphalt", "sub-base", "wearing"] },
  { key: "gabion", words: ["gabion", "reno"] },
];

const STOP = new Set(["the", "and", "for", "with", "from", "into", "onto", "dia", "nr", "item"]);

export function compareBoq(takeoff: QuantityTakeoff[], boq: BoqLine[]): BoqVariance[] {
  const items = takeoff.filter((t) => t.complete && t.quantity > 0);
  const usedTakeoff = new Set<number>();
  const usedBoq = new Set<number>();
  const rows: BoqVariance[] = [];

  const candidates: Array<{ t: number; b: number; score: number }> = [];
  items.forEach((item, t) => {
    boq.forEach((line, b) => {
      const s = score(item, line);
      if (s > 0) candidates.push({ t, b, score: s });
    });
  });
  candidates.sort((a, b) => b.score - a.score || a.t - b.t);

  for (const cand of candidates) {
    if (usedTakeoff.has(cand.t) || usedBoq.has(cand.b)) continue;
    usedTakeoff.add(cand.t);
    usedBoq.add(cand.b);
    rows.push(pair(items[cand.t], boq[cand.b]));
  }

  items.forEach((item, t) => {
    if (usedTakeoff.has(t)) return;
    rows.push({
      status: "drawing_only",
      boqItem: null,
      drawingItem: item.label,
      unit: item.unit,
      boqQty: null,
      drawingQty: item.quantity,
      varianceQty: null,
      variancePct: null,
      note: "This drawing take-off has no matching BOQ line on unit and description. It may be a scope gap or sit inside a prelim/composite item.",
      sources: item.inputs.map((x) => x.source),
    });
  });

  boq.forEach((line, i) => {
    if (usedBoq.has(i)) return;
    rows.push({
      status: "boq_only",
      boqItem: label(line),
      drawingItem: null,
      unit: line.unit,
      boqQty: line.quantity,
      drawingQty: null,
      varianceQty: null,
      variancePct: null,
      note: "This BOQ line was not matched to a drawing take-off. It may be off-drawing, in a drawing without extractable text, or missing from the pack.",
      sources: [line.source],
    });
  });

  const order = { difference: 0, drawing_only: 1, boq_only: 2, match: 3 };
  return rows.sort((a, b) => order[a.status] - order[b.status]);
}

function pair(item: QuantityTakeoff, line: BoqLine): BoqVariance {
  const boqQty = line.quantity;
  const drawingQty = item.quantity;
  const difference = boqQty != null && Math.abs(boqQty - drawingQty) > Math.max(0.05 * Math.max(boqQty, drawingQty), 0.1);
  const varianceQty = boqQty != null ? round(drawingQty - boqQty) : null;
  const variancePct = boqQty != null && boqQty !== 0 ? round((100 * (drawingQty - boqQty)) / boqQty) : null;
  return {
    status: difference ? "difference" : "match",
    boqItem: label(line),
    drawingItem: item.label,
    unit: item.unit,
    boqQty,
    drawingQty,
    varianceQty,
    variancePct,
    note: difference
      ? `BOQ ${boqQty} ${line.unit} versus drawing ${drawingQty} ${item.unit} (${signed(varianceQty)} / ${signed(variancePct)}%). Neither figure has been changed. Ask the Engineer which governs.`
      : "Drawing take-off and BOQ are in the same order of quantity for this item.",
    sources: [line.source, ...item.inputs.map((x) => x.source)],
  };
}

function score(item: QuantityTakeoff, line: BoqLine): number {
  if (normalizeUnit(line.unit) !== normalizeUnit(item.unit)) return 0;
  const words = KEYWORDS.find((k) => k.key === item.activityKey)?.words ?? [item.activityKey];
  const desc = `${line.description} ${line.itemNo}`.toLowerCase();
  if (!words.some((w) => desc.includes(w))) return 0;
  let n = 2;
  // Composite billed lines name more than one activity ("excavate and backfill").
  // Prefer the activity named first so a later word cannot steal the line.
  if (firstNamedActivity(desc) === item.activityKey) n += 8;
  for (const token of tokens(`${item.label} ${item.activityKey}`)) {
    const named = desc.includes(token) || words.some((w) => token.startsWith(w) || w.startsWith(token));
    if (named) n += token.match(/^\d/) ? 3 : 1;
  }
  return n;
}

function firstNamedActivity(desc: string): string | null {
  let hit: { key: string; at: number } | null = null;
  for (const row of KEYWORDS) {
    for (const word of row.words) {
      const at = desc.indexOf(word);
      if (at < 0) continue;
      if (!hit || at < hit.at) hit = { key: row.key, at };
    }
  }
  return hit?.key ?? null;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function label(line: BoqLine): string {
  return `${line.itemNo} ${line.description}`.trim();
}

function signed(n: number | null): string {
  if (n == null) return "—";
  return n > 0 ? `+${n}` : String(n);
}

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().replace(/\s/g, "");
  if (u === "m3" || u === "cum") return "m3";
  if (u === "m2" || u === "sqm") return "m2";
  if (u === "t" || u === "tonne" || u === "tonnes") return "t";
  return u;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
