import { locationLabel } from "@/modules/document-analysis/parse";
import type { ParsedDocument, SourceRef } from "@/modules/document-analysis/types";
import type { QuantityTakeoff } from "./types";

type Hit = { text: string; source: SourceRef };

export function calculateQuantities(docs: ParsedDocument[]): QuantityTakeoff[] {
  const drawingDocs = docs.filter((d) => d.role === "drawings");
  const hits = flatten(drawingDocs);
  const allText = hits.map((h) => h.text).join("\n");
  const takeoff: QuantityTakeoff[] = [];

  takeoff.push(...pads(hits, allText));
  takeoff.push(...wallFooting(hits, allText));
  takeoff.push(...groundBeam(hits, allText));
  takeoff.push(...pipes(hits, allText));
  takeoff.push(...brick(hits, allText));
  takeoff.push(...road(hits, allText));
  takeoff.push(...gabion(hits, allText));
  takeoff.push(...statedVolumes(hits, takeoff));
  return takeoff;
}

function pads(hits: Hit[], allText: string): QuantityTakeoff[] {
  const count = match(hits, /\b(?:foundation )?pads?\s*[:.]?\s*(\d+)\s*(?:nr|no\.?)/i);
  const size = match(hits, /\b(\d+(?:\.\d+)?)\s*m\s*[x×]\s*(\d+(?:\.\d+)?)\s*m\s*[x×]\s*(\d+(?:\.\d+)?)\s*m\s*(?:deep|depth)?/i);
  const working = match(hits, /\bworking space\s*(\d+(?:\.\d+)?)\s*m/i);
  const extra = match(hits, /\bexcavate to\s*(\d+(?:\.\d+)?)\s*m\s*(?:below)?/i);
  if (!count || !size) {
    if (/pad footing|foundation pad/i.test(allText)) {
      return [incomplete("excavation", "Pad excavation", "m3", "Pads are mentioned but count or size is not fully stated. No volume has been calculated.", [count, size].filter(Boolean) as Hit[])];
    }
    return [];
  }
  const n = Number(count.cap[1]);
  const l = Number(size.cap[1]);
  const w = Number(size.cap[2]);
  const d = Number(size.cap[3]);
  const ws = working ? Number(working.cap[1]) : null;
  const excavDepth = extra ? Number(extra.cap[1]) : d;
  const plan = ws != null ? l + 2 * ws : l;
  const planW = ws != null ? w + 2 * ws : w;
  const concrete = round(n * l * w * d);
  const excavation = round(n * plan * planW * excavDepth);
  const backfill = round(Math.max(excavation - concrete, 0));
  const formwork = round(n * 2 * (l + w) * d);
  const assumptions = [
    ...(ws == null ? ["Working space is not stated. Plan area for excavation uses the pad size only."] : []),
    ...(extra == null ? ["Excavation depth uses the pad depth because a deeper formation level is not stated."] : []),
  ];
  const inputs = [
    inp("Pad count", `${n} nr`, count),
    inp("Pad size L×W×D", `${l} × ${w} × ${d} m`, size),
    ...(working ? [inp("Working space", `${ws} m`, working)] : []),
    ...(extra ? [inp("Excavate to", `${excavDepth} m`, extra)] : []),
  ];
  const drawings = sources([count, size, working, extra]);
  return [
    complete("excavation", "Excavation — foundation pads", "m3", excavation,
      `${n} × ${plan} × ${planW} × ${excavDepth} = ${excavation} m³`, inputs, assumptions, drawings),
    complete("concrete", "Concrete — foundation pads", "m3", concrete,
      `${n} × ${l} × ${w} × ${d} = ${concrete} m³`, inputs, [], drawings),
    complete("formwork", "Formwork — foundation pads", "m2", formwork,
      `${n} × 2 × (${l} + ${w}) × ${d} = ${formwork} m²`, inputs, [], drawings),
    complete("backfill", "Backfill — around pads", "m3", backfill,
      `${excavation} − ${concrete} = ${backfill} m³`, inputs, ["Backfill is the excavated void minus the concrete. Compaction of the same material is listed separately if a rate exists."], drawings),
    complete("compaction", "Compaction — pad backfill", "m3", backfill,
      `Same quantity as backfill: ${backfill} m³`, inputs, ["No separate compaction thickness is stated; the backfill volume is used."], drawings),
  ];
}

function wallFooting(hits: Hit[], allText: string): QuantityTakeoff[] {
  const wall = match(hits, /\bwall footing length\s*(\d+(?:\.\d+)?)\s*m\s*width\s*(\d+(?:\.\d+)?)\s*m/i);
  const sameSheet = wall ? hits.filter((h) => h.source.documentId === wall.source.documentId) : [];
  const depth = match(sameSheet, /\bwall footing[^\n]{0,80}depth\s*(\d+(?:\.\d+)?)\s*m/i);
  if (wall && !depth) {
    return [incomplete(
      "concrete",
      "Concrete — wall footing",
      "m3",
      "Wall footing length and width are stated. Depth is not stated on this detail. Do not assume a depth.",
      [wall],
    )];
  }
  if (!wall && /wall footing/i.test(allText)) {
    return [incomplete("concrete", "Concrete — wall footing", "m3", "A wall footing is mentioned without enough dimensions to calculate a volume.", [])];
  }
  if (!wall || !depth) return [];
  const vol = round(Number(wall.cap[1]) * Number(wall.cap[2]) * Number(depth.cap[1]));
  return [complete(
    "concrete",
    "Concrete — wall footing",
    "m3",
    vol,
    `${wall.cap[1]} × ${wall.cap[2]} × ${depth.cap[1]} = ${vol} m³`,
    [inp("Length × width", wall.text, wall), inp("Depth", depth.text, depth)],
    [],
    [wall.source.documentName],
  )];
}

function groundBeam(hits: Hit[], allText: string): QuantityTakeoff[] {
  const beam = match(hits, /\bground beams?\s*[:.]?\s*(\d+(?:\.\d+)?)\s*mm\s*[x×]\s*(\d+(?:\.\d+)?)\s*mm\s*[x×]?\s*(?:length\s*)?(\d+(?:\.\d+)?)\s*m/i)
    || match(hits, /\bground beams?\s*[:.]?\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*mm.*?length\s*(\d+(?:\.\d+)?)\s*m/i);
  if (!beam) {
    if (/ground beam/i.test(allText) && !/\d+\s*mm/.test(allText)) {
      return [incomplete("concrete", "Concrete — ground beams", "m3", "Ground beams are mentioned but a full size and length are not stated.", [])];
    }
    return [];
  }
  const b = Number(beam.cap[1]) / 1000;
  const h = Number(beam.cap[2]) / 1000;
  const len = Number(beam.cap[3]);
  const vol = round(b * h * len);
  const form = round(2 * (b + h) * len);
  const rebar = match(hits, /\breinforcement\s*(?:rate|density)?\s*[:.]?\s*(\d+(?:\.\d+)?)\s*kg\/m3/i);
  const kg = rebar ? round(vol * Number(rebar.cap[1])) : null;
  const out = [
    complete("concrete", "Concrete — ground beams", "m3", vol,
      `${b} × ${h} × ${len} = ${vol} m³`, [inp("Beam size and length", beam.text, beam)], [], [beam.source.documentName]),
    complete("formwork", "Formwork — ground beams", "m2", form,
      `2 × (${b} + ${h}) × ${len} = ${form} m²`, [inp("Beam size and length", beam.text, beam)], [], [beam.source.documentName]),
  ];
  if (kg != null && rebar) {
    out.push(complete("reinforcement", "Reinforcement — ground beams", "t", round(kg / 1000),
      `${vol} m³ × ${rebar.cap[1]} kg/m³ = ${kg} kg = ${round(kg / 1000)} t`, [inp("Density", rebar.text, rebar)], [], [beam.source.documentName]));
  } else if (/reinforcement|rebar/i.test(allText)) {
    out.push(incomplete("reinforcement", "Reinforcement — ground beams", "t", "Beams are sized but a kg/m³ rate or bar schedule total is not stated, so tonnes are not calculated.", [beam]));
  }
  return out;
}

function pipes(hits: Hit[], _all: string): QuantityTakeoff[] {
  const out: QuantityTakeoff[] = [];
  const re = /\b(\d+)\s*mm\s*(?:dia\.?|diameter|Ø)?\s*(?:pipe|drain|sewer)[^\n]{0,40}?(\d+(?:\.\d+)?)\s*m\b/ig;
  const trench = match(hits, /\btrench\s*[:.]?\s*(\d+(?:\.\d+)?)\s*m\s*(?:wide|width).*?(\d+(?:\.\d+)?)\s*m\s*(?:deep|depth)/i)
    || match(hits, /\btrench width\s*(\d+(?:\.\d+)?)\s*m.*?depth\s*(\d+(?:\.\d+)?)\s*m/i);
  for (const hit of hits) {
    for (const m of hit.text.matchAll(re)) {
      const dia = Number(m[1]);
      const len = Number(m[2]);
      out.push(complete("pipe", `${dia} mm pipe`, "m", len, `Stated length ${len} m`, [inp("Pipe", m[0], hit)], [], [hit.source.documentName]));
      if (trench) {
        const tw = Number(trench.cap[1]);
        const td = Number(trench.cap[2]);
        const trenchVol = round(tw * td * len);
        out.push(complete("excavation", `Trench excavation — ${dia} mm pipe`, "m3", trenchVol,
          `${tw} × ${td} × ${len} = ${trenchVol} m³`, [inp("Trench", trench.text, trench), inp("Pipe length", m[0], hit)], [], [hit.source.documentName]));
        const pipeArea = Math.PI * Math.pow((dia / 1000) / 2, 2);
        const backfill = round(Math.max(trenchVol - pipeArea * len, 0));
        out.push(complete("backfill", `Trench backfill — ${dia} mm pipe`, "m3", backfill,
          `${trenchVol} − π(Ø/2)² × ${len} = ${backfill} m³`, [inp("Trench", trench.text, trench)], [], [hit.source.documentName]));
      }
    }
  }
  return mergeByLabel(out);
}

function brick(hits: Hit[], allText: string): QuantityTakeoff[] {
  const area = match(hits, /\bfacing brickwork\s*[:.]?\s*(\d+(?:\.\d+)?)\s*m2\b/i);
  if (area) {
    const a = Number(area.cap[1]);
    return [complete("brickwork", "Facing brickwork", "m2", a, `Stated area ${a} m²`, [inp("Brickwork", area.text, area)], [], [area.source.documentName])];
  }
  const lw = match(hits, /\bbrickwork\s*[:.]?\s*(\d+(?:\.\d+)?)\s*m\s*(?:long|length).*?(\d+(?:\.\d+)?)\s*m\s*(?:high|height)/i);
  if (lw) {
    const a = round(Number(lw.cap[1]) * Number(lw.cap[2]));
    return [complete("brickwork", "Facing brickwork", "m2", a, `${lw.cap[1]} × ${lw.cap[2]} = ${a} m²`, [inp("Wall", lw.text, lw)], [], [lw.source.documentName])];
  }
  if (/brickwork/i.test(allText)) {
    return [incomplete("brickwork", "Facing brickwork", "m2", "Brickwork is mentioned without a stated area or length × height.", [])];
  }
  return [];
}

function road(hits: Hit[], _all: string): QuantityTakeoff[] {
  const layer = match(hits, /\b(?:roadworks|carriageway|sub-?base|wearing course)\s*[:.]?\s*(\d+(?:\.\d+)?)\s*m\s*(?:long|length).*?(\d+(?:\.\d+)?)\s*m\s*(?:wide|width).*?(\d+(?:\.\d+)?)\s*(mm|m)\s*(?:thick|thickness)/i);
  if (!layer) return [];
  const len = Number(layer.cap[1]);
  const width = Number(layer.cap[2]);
  const thk = layer.cap[4].toLowerCase() === "mm" ? Number(layer.cap[3]) / 1000 : Number(layer.cap[3]);
  const vol = round(len * width * thk);
  const area = round(len * width);
  return [
    complete("roadworks", "Roadworks layer", "m3", vol, `${len} × ${width} × ${thk} = ${vol} m³`, [inp("Layer", layer.text, layer)], [], [layer.source.documentName]),
    complete("roadworks", "Roadworks area", "m2", area, `${len} × ${width} = ${area} m²`, [inp("Layer", layer.text, layer)], [], [layer.source.documentName]),
  ];
}

function gabion(hits: Hit[], _all: string): QuantityTakeoff[] {
  const g = match(hits, /\bgabion[s]?\s*[:.]?\s*(\d+)\s*(?:nr|no\.?).*?(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*m/i);
  if (!g) return [];
  const n = Number(g.cap[1]);
  const vol = round(n * Number(g.cap[2]) * Number(g.cap[3]) * Number(g.cap[4]));
  return [complete("gabion", "Gabions", "m3", vol, `${n} × ${g.cap[2]} × ${g.cap[3]} × ${g.cap[4]} = ${vol} m³`, [inp("Gabion", g.text, g)], [], [g.source.documentName])];
}

function statedVolumes(hits: Hit[], existing: QuantityTakeoff[]): QuantityTakeoff[] {
  const out: QuantityTakeoff[] = [];
  for (const hit of hits) {
    const m = hit.text.match(/\b(?:total )?(excavation|concrete)\s*[:.]?\s*(\d+(?:\.\d+)?)\s*m3\b/i);
    if (!m) continue;
    const key = m[1].toLowerCase() === "excavation" ? "excavation" : "concrete";
    if (existing.some((t) => t.activityKey === key && t.complete)) continue;
    out.push(complete(key, `Stated ${m[1].toLowerCase()}`, "m3", Number(m[2]), `As written: ${m[2]} m³`, [inp("Stated quantity", m[0], hit)], ["This figure is copied from the drawing note, not independently calculated."], [hit.source.documentName]));
  }
  return out;
}

type Cap = Hit & { cap: RegExpMatchArray };

function match(hits: Hit[], re: RegExp): Cap | null {
  for (const hit of hits) {
    const cap = hit.text.match(re);
    if (cap) return { ...hit, cap };
  }
  return null;
}

function flatten(docs: ParsedDocument[]): Hit[] {
  const hits: Hit[] = [];
  for (const doc of docs) {
    for (const unit of doc.units) {
      hits.push({
        text: unit.text,
        source: {
          documentId: doc.documentId,
          documentName: doc.filename,
          page: unit.page,
          sheet: unit.sheet,
          row: unit.row,
          heading: unit.heading,
          clause: null,
          quote: unit.text.slice(0, 280),
          locationLabel: locationLabel(unit),
        },
      });
    }
  }
  return hits;
}

function inp(label: string, value: string, hit: Hit): QuantityTakeoff["inputs"][number] {
  return { label, value, source: hit.source };
}

function sources(hits: Array<Hit | null>): string[] {
  return [...new Set(hits.filter((h): h is Hit => Boolean(h)).map((h) => h.source.documentName))];
}

function complete(
  activityKey: string,
  label: string,
  unit: string,
  quantity: number,
  formula: string,
  inputs: QuantityTakeoff["inputs"],
  assumptions: string[],
  sourceDrawings: string[],
): QuantityTakeoff {
  return {
    id: slug(label),
    activityKey,
    label,
    unit,
    quantity,
    formula,
    inputs,
    assumptions,
    sourceDrawings,
    complete: true,
  };
}

function incomplete(activityKey: string, label: string, unit: string, reason: string, hits: Hit[]): QuantityTakeoff {
  return {
    id: slug(label),
    activityKey,
    label,
    unit,
    quantity: 0,
    formula: "Not calculated",
    inputs: hits.map((h) => inp("Partial note", h.text, h)),
    assumptions: [reason],
    sourceDrawings: sources(hits),
    complete: false,
  };
}

function mergeByLabel(items: QuantityTakeoff[]): QuantityTakeoff[] {
  const map = new Map<string, QuantityTakeoff>();
  for (const item of items) {
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
      continue;
    }
    map.set(item.id, { ...item, quantity: round(prev.quantity + item.quantity), formula: `${prev.formula} + ${item.formula}` });
  }
  return [...map.values()];
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
