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
  { key: "roadworks", words: ["road", "pavement", "asphalt", "sub-base"] },
  { key: "gabion", words: ["gabion", "reno"] },
];

export function compareBoq(takeoff: QuantityTakeoff[], boq: BoqLine[]): BoqVariance[] {
  const drawingByKey = new Map<string, QuantityTakeoff[]>();
  for (const item of takeoff.filter((t) => t.complete)) {
    const groupKey = `${item.activityKey}|${item.unit}`;
    const list = drawingByKey.get(groupKey) ?? [];
    list.push(item);
    drawingByKey.set(groupKey, list);
  }
  const usedBoq = new Set<number>();
  const rows: BoqVariance[] = [];

  for (const items of drawingByKey.values()) {
    const key = items[0].activityKey;
    const drawingQty = round(items.reduce((n, i) => n + i.quantity, 0));
    const unit = items[0].unit;
    const matches = boq.map((line, i) => ({ line, i, score: score(key, line, unit) }))
      .filter((m) => m.score > 0 && !usedBoq.has(m.i))
      .sort((a, b) => b.score - a.score);
    const best = matches[0];
    if (!best) {
      rows.push({
        status: "drawing_only",
        boqItem: null,
        drawingItem: items.map((i) => i.label).join("; "),
        unit,
        boqQty: null,
        drawingQty,
        note: "This drawing take-off has no matching BOQ line on unit and description. It may be a scope gap or sit inside a prelim/composite item.",
        sources: items.flatMap((i) => i.inputs.map((x) => x.source)),
      });
      continue;
    }
    usedBoq.add(best.i);
    const boqQty = best.line.quantity;
    const difference = boqQty != null && Math.abs(boqQty - drawingQty) > Math.max(0.05 * Math.max(boqQty, drawingQty), 0.1);
    rows.push({
      status: difference ? "difference" : "match",
      boqItem: `${best.line.itemNo} ${best.line.description}`.trim(),
      drawingItem: items.map((i) => i.label).join("; "),
      unit,
      boqQty,
      drawingQty,
      note: difference
        ? `BOQ ${boqQty} ${best.line.unit} versus drawing ${drawingQty} ${unit}. Neither figure has been changed. Ask the Engineer which governs.`
        : "Drawing take-off and BOQ are in the same order of quantity for this item.",
      sources: [best.line.source, ...items.flatMap((i) => i.inputs.map((x) => x.source))],
    });
  }

  boq.forEach((line, i) => {
    if (usedBoq.has(i)) return;
    rows.push({
      status: "boq_only",
      boqItem: `${line.itemNo} ${line.description}`.trim(),
      drawingItem: null,
      unit: line.unit,
      boqQty: line.quantity,
      drawingQty: null,
      note: "This BOQ line was not matched to a drawing take-off. It may be off-drawing, in a drawing without extractable text, or missing from the pack.",
      sources: [line.source],
    });
  });
  return rows;
}

function score(key: string, line: { description: string; unit: string }, unit: string): number {
  const words = KEYWORDS.find((k) => k.key === key)?.words ?? [key];
  const desc = line.description.toLowerCase();
  if (!words.some((w) => desc.includes(w))) return 0;
  if (normalizeUnit(line.unit) !== normalizeUnit(unit)) return 0;
  return 2;
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
