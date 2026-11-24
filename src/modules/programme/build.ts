import type { BoqLine } from "@/modules/document-analysis/boq-items";
import type { TenderReviewReport } from "@/modules/document-analysis/types";
import { selectRate } from "@/modules/drawing-planning/select-rate";
import type { DrawingPlanningReport, ProductionRate, QuantityTakeoff } from "@/modules/drawing-planning/types";
import { calculateWorkingDays, setupHours, setupWeather } from "./duration";
import type { ActivityKind, ActivityLink, FieldOrigin, ProgrammeActivity, ProgrammeSetup } from "./types";

const TRADE_CHAIN = ["excavation", "reinforcement", "formwork", "concrete", "curing"] as const;
const ELEMENT_ORDER = ["pad-footings", "wall-footing", "ground-beams"];
const FOUNDATION_ELEMENTS = new Set(["pad-footings", "wall-footing", "ground-beams"]);

type Draft = {
  name: string;
  section: string;
  kind: ActivityKind;
  boqRef: string | null;
  drawingRef: string | null;
  quantity: number | null;
  unit: string;
  ratePerDay: number | null;
  teams: number;
  activityKey: string | null;
  elementKey: string | null;
  sources: ProgrammeActivity["sources"];
  whyLinks: string;
};

export function buildActivities(input: {
  tender: TenderReviewReport | null;
  drawings: DrawingPlanningReport | null;
  rates: ProductionRate[];
  setup: ProgrammeSetup;
}): ProgrammeActivity[] {
  const drafts: Draft[] = [];
  drafts.push({
    name: "Start on site",
    section: "Milestones",
    kind: "milestone",
    boqRef: null,
    drawingRef: null,
    quantity: null,
    unit: "",
    ratePerDay: null,
    teams: 1,
    activityKey: "milestone-start",
    elementKey: "milestones",
    sources: [],
    whyLinks: "Possession / starting date from the contract data, if stated.",
  });

  const boq = input.tender?.boq.lines ?? [];
  for (const line of boq.filter(isPrelim)) {
    drafts.push({
      name: line.description || line.itemNo,
      section: "Preliminaries",
      kind: "task",
      boqRef: labelBoq(line),
      drawingRef: null,
      quantity: line.quantity,
      unit: line.unit,
      ratePerDay: null,
      teams: 1,
      activityKey: "prelim",
      elementKey: "preliminaries",
      sources: [line.source],
      whyLinks: "Lump-sum prelim from the bill. Duration is not inferred from a rate.",
    });
  }

  const takeoff = input.drawings?.takeoff ?? [];
  const comparisons = input.drawings?.boqComparison ?? [];
  for (const item of takeoff) {
    const rate = findRate(input.rates, item.activityKey, item.unit);
    const boqHit = comparisons.find((c) => c.drawingItem === item.label && c.boqItem);
    drafts.push({
      name: item.label,
      section: sectionFor(item),
      kind: "task",
      boqRef: boqHit?.boqItem ?? null,
      drawingRef: item.sourceDrawings.join("; ") || null,
      quantity: item.complete ? item.quantity : null,
      unit: item.unit,
      ratePerDay: rate?.rate_per_day ?? null,
      teams: Math.max(rate?.teams ?? input.setup.teams.value ?? 1, 1),
      activityKey: item.activityKey,
      elementKey: item.elementKey,
      sources: item.inputs.map((i) => i.source),
      whyLinks: item.complete ? "Measured from drawings." : item.assumptions[0] || "Quantity is not complete.",
    });
  }

  const concretes = takeoff.filter((t) => t.activityKey === "concrete" && t.complete);
  for (const item of concretes) {
    drafts.push({
      name: `Curing — ${item.elementName}`,
      section: sectionFor(item),
      kind: "task",
      boqRef: null,
      drawingRef: item.sourceDrawings.join("; ") || null,
      quantity: null,
      unit: "day",
      ratePerDay: null,
      teams: 1,
      activityKey: "curing",
      elementKey: item.elementKey,
      sources: [],
      whyLinks: "Curing days are not stated on the drawings. Enter a duration; none has been assumed.",
    });
  }

  drafts.push({
    name: "Completion",
    section: "Milestones",
    kind: "milestone",
    boqRef: null,
    drawingRef: null,
    quantity: null,
    unit: "",
    ratePerDay: null,
    teams: 1,
    activityKey: "milestone-finish",
    elementKey: "milestones",
    sources: [],
    whyLinks: "Contract completion date, if stated.",
  });

  const activities = assembleWbs(drafts, input.setup);
  return linkActivities(activities);
}

function assembleWbs(drafts: Draft[], setup: ProgrammeSetup): ProgrammeActivity[] {
  const activities: ProgrammeActivity[] = [];
  let summaryNo = 0;
  let leafNo = 0;
  const root = { n: 0 };

  const take = (section: string) => drafts.filter((d) => d.section === section && d.kind !== "milestone");
  const start = drafts.find((d) => d.activityKey === "milestone-start");
  const finish = drafts.find((d) => d.activityKey === "milestone-finish");

  const addSummary = (name: string, section: string, parentId: string | null, wbs: string) => {
    summaryNo += 1;
    const id = `W${summaryNo}`;
    const row = blankActivity({
      id,
      wbs,
      activityId: id,
      name,
      kind: "summary",
      parentId,
      section,
      origin: "recommendation",
    });
    activities.push(row);
    return row;
  };

  const addLeaf = (item: Draft, parentId: string | null, wbs: string) => {
    leafNo += 1;
    const id = `A${String(leafNo).padStart(3, "0")}`;
    const hours = setupHours(setup);
    const calc = calculateWorkingDays({
      quantity: item.quantity,
      ratePerDay: item.ratePerDay,
      teams: item.teams,
      hoursPerDay: hours,
      weatherAllowancePct: setupWeather(setup),
      durationManual: false,
      durationWorkingDays: null,
    });
    const row: ProgrammeActivity = {
      ...blankActivity({
        id,
        wbs,
        activityId: id,
        name: item.name,
        kind: item.kind,
        parentId,
        section: item.section,
        origin: "recommendation",
      }),
      boqRef: item.boqRef,
      drawingRef: item.drawingRef,
      quantity: item.quantity,
      unit: item.unit,
      ratePerDay: item.ratePerDay,
      teams: item.teams,
      durationWorkingDays: item.kind === "milestone" ? 0 : calc.days,
      durationFormula: item.kind === "milestone" ? "Milestone" : calc.formula,
      blockedReason: item.kind === "milestone" ? null : calc.blockedReason,
      activityKey: item.activityKey,
      elementKey: item.elementKey,
      sources: item.sources,
    };
    activities.push(row);
    return row;
  };

  if (start) addLeaf(start, null, nextWbs("", root));

  addGroup("Preliminaries", take("Preliminaries"), null, root, addSummary, addLeaf);

  const earth = take("Earthworks");
  addGroup("Earthworks", sortTrades(earth), null, root, addSummary, addLeaf);

  const foundationDrafts = take("Foundations");
  const superDrafts = take("Superstructure");
  if (foundationDrafts.length || superDrafts.length) {
    const structuralWbs = nextWbs("", root);
    const structural = addSummary("Structural Works", "Structural Works", null, structuralWbs);
    const structuralCount = { n: 0 };
    if (foundationDrafts.length) {
      const foundationWbs = nextWbs(structuralWbs, structuralCount);
      const foundation = addSummary("Foundation", "Foundations", structural.id, foundationWbs);
      const foundationCount = { n: 0 };
      for (const group of groupedElements(foundationDrafts)) {
        const groupWbs = nextWbs(foundationWbs, foundationCount);
        const parent = addSummary(group.name, "Foundations", foundation.id, groupWbs);
        const childCount = { n: 0 };
        for (const item of sortTrades(group.items)) {
          addLeaf(item, parent.id, nextWbs(groupWbs, childCount));
        }
      }
      addLeaf({
        name: "Completion of Foundation Works",
        section: "Foundations",
        kind: "milestone",
        boqRef: null,
        drawingRef: null,
        quantity: null,
        unit: "",
        ratePerDay: null,
        teams: 1,
        activityKey: "milestone-foundation",
        elementKey: "foundation-complete",
        sources: [],
        whyLinks: "Marks the end of foundation pads, walls and beams before backfill and superstructure.",
      }, foundation.id, nextWbs(foundationWbs, foundationCount));
    }
    if (superDrafts.length) {
      const superWbs = nextWbs(structuralWbs, structuralCount);
      const superstructure = addSummary("Superstructure", "Superstructure", structural.id, superWbs);
      const superCount = { n: 0 };
      for (const group of groupedElements(superDrafts)) {
        const groupWbs = nextWbs(superWbs, superCount);
        if (group.items.length === 1) {
          addLeaf(group.items[0], superstructure.id, groupWbs);
          continue;
        }
        const parent = addSummary(group.name, "Superstructure", superstructure.id, groupWbs);
        const childCount = { n: 0 };
        for (const item of sortTrades(group.items)) {
          addLeaf(item, parent.id, nextWbs(groupWbs, childCount));
        }
      }
    }
  }

  addGroup("Drainage", sortTrades(take("Drainage")), null, root, addSummary, addLeaf);
  addGroup("External works", sortTrades(take("External works")), null, root, addSummary, addLeaf);

  if (finish) addLeaf(finish, null, nextWbs("", root));
  return activities;
}

function addGroup(
  name: string,
  items: Draft[],
  parentId: string | null,
  counter: { n: number },
  addSummary: (name: string, section: string, parentId: string | null, wbs: string) => ProgrammeActivity,
  addLeaf: (item: Draft, parentId: string | null, wbs: string) => ProgrammeActivity,
) {
  if (!items.length) return;
  const wbs = nextWbs(parentId ? "" : "", counter);
  const parent = addSummary(name, name, parentId, wbs);
  const child = { n: 0 };
  for (const item of items) addLeaf(item, parent.id, nextWbs(wbs, child));
}

function groupedElements(items: Draft[]): Array<{ name: string; items: Draft[] }> {
  const map = new Map<string, Draft[]>();
  for (const item of items) {
    const key = item.elementKey || item.name;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  const orderedKeys = [
    ...ELEMENT_ORDER.filter((key) => map.has(key)),
    ...[...map.keys()].filter((key) => !ELEMENT_ORDER.includes(key as typeof ELEMENT_ORDER[number])).sort(),
  ];
  return orderedKeys.map((key) => ({
    name: elementTitle(key, map.get(key) ?? []),
    items: map.get(key) ?? [],
  }));
}

function elementTitle(key: string, items: Draft[]): string {
  if (key === "pad-footings") return "Foundation pads";
  if (key === "wall-footing") return "Wall footing";
  if (key === "ground-beams") return "Ground beams";
  const named = items.find((item) => item.name.includes("—"));
  if (named) return named.name.split("—")[1]?.trim() || key;
  return key.replace(/-/g, " ");
}

function sortTrades(items: Draft[]): Draft[] {
  const rank = (key: string | null) => {
    const i = TRADE_CHAIN.indexOf(key as typeof TRADE_CHAIN[number]);
    return i === -1 ? TRADE_CHAIN.length + 1 : i;
  };
  return [...items].sort((a, b) => rank(a.activityKey) - rank(b.activityKey) || a.name.localeCompare(b.name));
}

function nextWbs(parent: string, counter: { n: number }): string {
  counter.n += 1;
  return parent ? `${parent}.${counter.n}` : String(counter.n);
}

function linkActivities(activities: ProgrammeActivity[]): ProgrammeActivity[] {
  const leaves = activities.filter((a) => a.kind !== "summary");
  const byKey = (key: string, element?: string | null) =>
    leaves.filter((a) => a.activityKey === key && (element == null || a.elementKey === element));

  const start = leaves.find((a) => a.activityKey === "milestone-start");
  const finish = leaves.find((a) => a.activityKey === "milestone-finish");
  const foundationDone = leaves.find((a) => a.activityKey === "milestone-foundation");
  const prelims = leaves.filter((a) => a.activityKey === "prelim");

  const out = activities.map((a) => ({ ...a, predecessors: [...a.predecessors] }));
  const update = (id: string, links: ActivityLink[]) => {
    const row = out.find((a) => a.id === id);
    if (row) row.predecessors = links;
  };

  if (start) {
    for (const p of prelims) {
      update(p.id, [link(start.id, "FS", 0, "Site establishment follows possession.")]);
    }
  }

  const lastPrelim = prelims[prelims.length - 1] ?? start;
  const excavations = byKey("excavation");
  if (lastPrelim && excavations[0]) {
    update(excavations[0].id, [link(lastPrelim.id, "FS", 0, "Groundworks follow site establishment.")]);
    excavations.slice(1).forEach((row, i) => {
      update(row.id, [link(excavations[i].id, "FS", 0, "Keep excavation as a cascade unless you split gangs.")]);
    });
  } else if (lastPrelim) {
    const firstWork = leaves.find((a) => a.kind === "task" && a.activityKey !== "prelim");
    if (firstWork) update(firstWork.id, [link(lastPrelim.id, "FS", 0, "First measured activity follows site establishment.")]);
  }

  const elementKeys = orderedElements(leaves);
  let previousTail: ProgrammeActivity | undefined;
  for (const el of elementKeys) {
    if (el === "preliminaries" || el === "milestones" || el === "foundation-complete") continue;
    const chain = TRADE_CHAIN.map((key) => byKey(key, el)[0]).filter(Boolean) as ProgrammeActivity[];
    chain.forEach((row, i) => {
      if (i === 0) {
        const preds: ActivityLink[] = [];
        if (previousTail) preds.push(link(previousTail.id, "FS", 0, "Next structural element waits on the pour or excavation just finished."));
        else if (row.activityKey !== "excavation" && excavations[0]) {
          preds.push(link(excavations[0].id, "FS", 0, "Shutters and steel follow a formed excavation."));
        }
        if (preds.length) update(row.id, preds);
        return;
      }
      const pred = chain[i - 1];
      const why = row.activityKey === "formwork"
        ? "Formwork follows steel on the same pour — finish-to-start so the bar chart steps like a construction programme."
        : row.activityKey === "concrete"
          ? "Concrete waits on formwork."
          : row.activityKey === "curing"
            ? "Curing follows the pour. Days are entered by the planner."
            : row.activityKey === "reinforcement"
              ? "Steel follows excavation or the previous trade."
              : "Recommended finish-to-start on the same element.";
      update(row.id, [link(pred.id, "FS", 0, why)]);
    });
    if (chain.length) previousTail = chain[chain.length - 1];

    const pipe = byKey("pipe", el)[0];
    const trench = byKey("excavation", el)[0] ?? excavations[0];
    if (pipe && trench) update(pipe.id, [link(trench.id, "FS", 0, "Pipes follow trench excavation.")]);
  }

  if (foundationDone) {
    const foundationTails = out.filter((a) => (
      a.kind !== "summary"
      && a.id !== foundationDone.id
      && FOUNDATION_ELEMENTS.has(a.elementKey || "")
      && ["concrete", "curing", "formwork", "reinforcement"].includes(a.activityKey || "")
      && !out.some((b) => b.id !== foundationDone.id && b.kind !== "summary" && b.predecessors.some((p) => p.predecessorId === a.id) && FOUNDATION_ELEMENTS.has(b.elementKey || ""))
    ));
    const preds = foundationTails.length ? foundationTails : previousTail ? [previousTail] : [];
    update(foundationDone.id, preds.map((a) => link(a.id, "FS", 0, "Foundation complete when the last foundation pour is finished.")));
  }

  const afterFoundation = foundationDone ?? previousTail;
  for (const fill of byKey("backfill")) {
    if (afterFoundation) update(fill.id, [link(afterFoundation.id, "FS", 0, "Backfill waits until the foundation occupying the excavation is complete.")]);
  }
  for (const compact of byKey("compaction")) {
    const fill = byKey("backfill", compact.elementKey)[0] ?? byKey("backfill")[0];
    if (fill) update(compact.id, [link(fill.id, "FS", 0, "Compaction is the finishing pass on placed fill.")]);
  }
  for (const brick of byKey("brickwork")) {
    if (afterFoundation) update(brick.id, [link(afterFoundation.id, "FS", 0, "Walls sit on the completed foundation.")]);
  }
  for (const road of byKey("roadworks")) {
    const after = byKey("compaction")[0] ?? byKey("backfill")[0] ?? byKey("pipe")[0] ?? excavations[0];
    if (after) update(road.id, [link(after.id, "FS", 0, "Pavement follows buried services and filled trenches.")]);
  }
  for (const gabion of byKey("gabion")) {
    if (excavations[0]) update(gabion.id, [link(excavations[0].id, "FS", 0, "Cages follow formation.")]);
  }

  if (finish) {
    const tails = out.filter((a) => a.kind === "task" && !out.some((b) => b.predecessors.some((p) => p.predecessorId === a.id) && b.kind !== "summary"));
    const preds = (tails.length ? tails : leaves.filter((a) => a.kind === "task")).filter((a) => a.id !== finish.id);
    update(finish.id, preds.map((a) => link(a.id, "FS", 0, "Completion follows remaining construction.")));
  }

  return out;
}

function orderedElements(leaves: ProgrammeActivity[]): string[] {
  const keys = [...new Set(leaves.map((a) => a.elementKey).filter(Boolean))] as string[];
  const ranked = [
    ...ELEMENT_ORDER.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !ELEMENT_ORDER.includes(key as typeof ELEMENT_ORDER[number]) && key !== "preliminaries" && key !== "milestones"),
  ];
  return ranked;
}

function link(predecessorId: string, type: ActivityLink["type"], lagWorkingDays: number, why: string): ActivityLink {
  return { predecessorId, type, lagWorkingDays, origin: "recommendation", why };
}

function blankActivity(partial: {
  id: string;
  wbs: string;
  activityId: string;
  name: string;
  kind: ActivityKind;
  parentId: string | null;
  section: string;
  origin: FieldOrigin;
}): ProgrammeActivity {
  return {
    id: partial.id,
    wbs: partial.wbs,
    activityId: partial.activityId,
    name: partial.name,
    kind: partial.kind,
    parentId: partial.parentId,
    section: partial.section,
    boqRef: null,
    drawingRef: null,
    quantity: null,
    unit: "",
    ratePerDay: null,
    teams: 1,
    durationWorkingDays: partial.kind === "milestone" ? 0 : null,
    durationManual: false,
    durationFormula: "",
    blockedReason: null,
    predecessors: [],
    plannedStart: null,
    plannedFinish: null,
    startConstraint: null,
    responsible: "",
    status: "not_started",
    progressPct: 0,
    approval: "recommended",
    origin: partial.origin,
    activityKey: null,
    elementKey: null,
    es: null,
    ef: null,
    ls: null,
    lf: null,
    totalFloat: null,
    freeFloat: null,
    critical: false,
    sources: [],
  };
}

function isPrelim(line: BoqLine): boolean {
  return /prelim|establishment|temporary|fencing|site office/i.test(`${line.section} ${line.description}`);
}

function labelBoq(line: BoqLine): string {
  return `${line.itemNo} ${line.description}`.trim();
}

function findRate(rates: ProductionRate[], key: string, unit: string): ProductionRate | undefined {
  return selectRate(rates, key, unit);
}

function sectionFor(item: QuantityTakeoff): string {
  if (item.activityKey === "pipe") return "Drainage";
  if (item.activityKey === "brickwork" || item.activityKey === "building") return "Superstructure";
  if (item.activityKey === "roadworks" || item.activityKey === "gabion") return "External works";
  if (item.activityKey === "excavation" && item.elementKey?.includes("pipe")) return "Drainage";
  if (item.activityKey === "excavation" || item.activityKey === "backfill" || item.activityKey === "compaction") {
    return "Earthworks";
  }
  if (["formwork", "reinforcement", "concrete", "curing"].includes(item.activityKey)) {
    return "Foundations";
  }
  return "Earthworks";
}
