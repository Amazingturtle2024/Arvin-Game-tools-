import { ELEMENT_MEASURE_SLOTS, type ElementMeasure, type MeasuredElement, type QuantityTakeoff } from "./types";

const CONCRETE_ELEMENTS = new Set(["pad-footings", "wall-footing", "ground-beams"]);

export function buildMeasuredElements(takeoff: QuantityTakeoff[]): MeasuredElement[] {
  const groups = new Map<string, QuantityTakeoff[]>();
  for (const item of takeoff) {
    const key = item.elementKey || item.id;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.values()].map((items) => {
    const key = items[0].elementKey || items[0].id;
    const name = items[0].elementName || items[0].label;
    const concreteWork = CONCRETE_ELEMENTS.has(key) || items.some((i) => i.activityKey === "concrete");
    const drawings = [...new Set(items.flatMap((i) => i.sourceDrawings))];
    const measures: ElementMeasure[] = [];
    if (concreteWork) {
      measures.push(slot(items, "concrete_m3", "Concrete", "m3", "concrete", "No concrete volume is stated for this element."));
      measures.push(slot(items, "rebar_t", "Reinforcement", "t", "reinforcement", "No bar schedule or kg/m³ rate is stated for this element. Tonnes are not assumed."));
      measures.push(areaSlot(items));
    } else {
      for (const item of items.filter((i) => i.unit === "m2" || i.activityKey === "brickwork")) {
        measures.push(fromItem(item, "area_m2", "Area"));
      }
    }
    const used = new Set(measures.flatMap((m) => items.filter((i) => matchesSlot(i, m)).map((i) => i.id)));
    for (const item of items) {
      if (used.has(item.id)) continue;
      measures.push(fromItem(item, item.activityKey, item.label));
    }
    return { id: key, name, concreteWork, sourceDrawings: drawings, measures };
  });
}

function areaSlot(items: QuantityTakeoff[]): ElementMeasure {
  const form = items.find((i) => i.activityKey === "formwork" && i.unit === "m2");
  if (form) return fromItem(form, "area_m2", "Area");
  const area = items.find((i) => i.unit === "m2");
  if (area) return fromItem(area, "area_m2", "Area");
  return {
    kind: "area_m2",
    label: "Area",
    unit: "m2",
    quantity: null,
    complete: false,
    formula: "Not calculated",
    note: "No formwork or surface area is stated for this element.",
  };
}

function slot(
  items: QuantityTakeoff[],
  kind: string,
  label: string,
  unit: string,
  activityKey: string,
  missing: string,
): ElementMeasure {
  const hit = items.find((i) => i.activityKey === activityKey && i.unit === unit);
  if (hit) return fromItem(hit, kind, label);
  return {
    kind,
    label,
    unit,
    quantity: null,
    complete: false,
    formula: "Not calculated",
    note: missing,
  };
}

function fromItem(item: QuantityTakeoff, kind: string, label: string): ElementMeasure {
  return {
    kind,
    label,
    unit: item.unit,
    quantity: item.complete ? item.quantity : null,
    complete: item.complete,
    formula: item.formula,
    note: item.complete ? null : item.assumptions[0] ?? "Not calculated from the drawing.",
  };
}

function matchesSlot(item: QuantityTakeoff, measure: ElementMeasure): boolean {
  const def = ELEMENT_MEASURE_SLOTS.find((s) => s.kind === measure.kind);
  if (def) return item.activityKey === def.activityKey || (measure.kind === "area_m2" && item.unit === "m2");
  return item.activityKey === measure.kind || item.label === measure.label;
}
