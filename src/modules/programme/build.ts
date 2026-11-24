import type { BoqLine } from "@/modules/document-analysis/boq-items";
import type { TenderReviewReport } from "@/modules/document-analysis/types";
import type { DrawingPlanningReport, ProductionRate, QuantityTakeoff } from "@/modules/drawing-planning/types";
import { calculateWorkingDays, setupHours, setupWeather } from "./duration";
import type { ActivityKind, ActivityLink, FieldOrigin, ProgrammeActivity, ProgrammeSetup } from "./types";

const SECTION_ORDER = [
  "Milestones",
  "Preliminaries",
  "Earthworks",
  "Foundations",
  "Drainage",
  "Superstructure",
  "External works",
] as const;

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

  const grouped = new Map<string, Draft[]>();
  for (const section of SECTION_ORDER) grouped.set(section, []);
  for (const draft of drafts) {
    const list = grouped.get(draft.section) ?? [];
    list.push(draft);
    grouped.set(draft.section, list);
  }

  const activities: ProgrammeActivity[] = [];
  let sectionNo = 0;
  let leafNo = 0;
  for (const section of SECTION_ORDER) {
    const items = grouped.get(section) ?? [];
    if (items.length === 0) continue;
    sectionNo += 1;
    const parentId = `W${sectionNo}`;
    activities.push(blankActivity({
      id: parentId,
      wbs: String(sectionNo),
      activityId: `W${sectionNo}`,
      name: section,
      kind: "summary",
      parentId: null,
      section,
      origin: "recommendation",
    }));
    let child = 0;
    for (const item of items) {
      child += 1;
      leafNo += 1;
      const id = `A${String(leafNo).padStart(3, "0")}`;
      const hours = setupHours(input.setup);
      const calc = calculateWorkingDays({
        quantity: item.quantity,
        ratePerDay: item.ratePerDay,
        teams: item.teams,
        hoursPerDay: hours,
        weatherAllowancePct: setupWeather(input.setup),
        durationManual: false,
        durationWorkingDays: null,
      });
      activities.push({
        ...blankActivity({
          id,
          wbs: `${sectionNo}.${child}`,
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
      });
    }
  }

  return linkActivities(activities);
}

function linkActivities(activities: ProgrammeActivity[]): ProgrammeActivity[] {
  const leaves = activities.filter((a) => a.kind !== "summary");
  const byKey = (key: string, element?: string | null) =>
    leaves.filter((a) => a.activityKey === key && (element == null || a.elementKey === element));

  const start = leaves.find((a) => a.activityKey === "milestone-start");
  const finish = leaves.find((a) => a.activityKey === "milestone-finish");
  const prelims = leaves.filter((a) => a.activityKey === "prelim");
  const firstWorks = leaves.filter((a) => a.kind === "task" && a.activityKey !== "prelim" && a.activityKey !== "curing");

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
  const padExc = byKey("excavation").filter((a) => a.elementKey === "pad-footings");
  const otherExc = byKey("excavation").filter((a) => a.elementKey !== "pad-footings");
  if (lastPrelim) {
    const anchors = padExc.length ? padExc : byKey("excavation");
    for (const a of anchors) {
      update(a.id, [link(lastPrelim.id, "FS", 0, "Groundworks follow site establishment.")]);
    }
  }
  const firstExc = padExc[0] ?? byKey("excavation")[0];
  if (firstExc) {
    otherExc.forEach((a, i) => {
      update(a.id, [link(firstExc.id, "SS", 0, "Separate work areas may run together if plant allows.")]);
      if (i > 0) return;
    });
  }

  const elements = [...new Set(leaves.map((a) => a.elementKey).filter(Boolean))] as string[];
  for (const el of elements) {
    if (el === "preliminaries" || el === "milestones") continue;
    const excavation = byKey("excavation", el)[0];
    const formwork = byKey("formwork", el)[0];
    const rebar = byKey("reinforcement", el)[0];
    const concrete = byKey("concrete", el)[0];
    const curing = byKey("curing", el)[0];
    const pipe = byKey("pipe", el)[0];
    const backfill = byKey("backfill", el)[0];
    const compaction = byKey("compaction", el)[0];
    const brick = byKey("brickwork", el)[0];
    const road = byKey("roadworks", el)[0];
    const gabion = byKey("gabion", el)[0];

    if (excavation && formwork) update(formwork.id, [link(excavation.id, "FS", 0, "Shutters follow a formed excavation.")]);
    if (excavation && rebar) update(rebar.id, [link(excavation.id, "FS", 0, "Steel follows a formed excavation.")]);
    if (formwork && rebar) {
      const row = out.find((a) => a.id === rebar.id);
      if (row && !row.predecessors.some((p) => p.predecessorId === formwork.id)) {
        row.predecessors.push(link(formwork.id, "SS", 0, "Shutters and steel can proceed together on the same pour."));
      }
    }
    const pourPreds: ActivityLink[] = [];
    if (formwork) pourPreds.push(link(formwork.id, "FS", 0, "Concrete waits on formwork."));
    if (rebar) pourPreds.push(link(rebar.id, "FS", 0, "Concrete waits on reinforcement."));
    if (!formwork && !rebar && excavation) pourPreds.push(link(excavation.id, "FS", 0, "Concrete follows excavation where no shutters are measured."));
    if (concrete && pourPreds.length) update(concrete.id, pourPreds);
    if (curing && concrete) update(curing.id, [link(concrete.id, "FS", 0, "Curing follows the pour. Days are entered by the planner.")]);
    if (pipe && excavation) update(pipe.id, [link(excavation.id, "FS", 0, "Pipes follow trench excavation.")]);
    const fillAfter = curing ?? concrete ?? pipe ?? excavation;
    if (backfill && fillAfter) update(backfill.id, [link(fillAfter.id, "FS", 0, "Backfill waits on the work occupying the excavation.")]);
    if (compaction && backfill) update(compaction.id, [link(backfill.id, "FS", 0, "Compaction is the finishing pass on placed fill.")]);
    if (brick) {
      const found = byKey("concrete").find((a) => a.elementKey === "ground-beams" || a.elementKey === "pad-footings") ?? concrete;
      if (found) update(brick.id, [link(found.id, "FS", 0, "Walls sit on the structure.")]);
    }
    if (road) {
      const after = byKey("backfill")[0] ?? byKey("pipe")[0] ?? excavation;
      if (after) update(road.id, [link(after.id, "FS", 0, "Pavement follows buried services and filled trenches.")]);
    }
    if (gabion && excavation) update(gabion.id, [link(excavation.id, "FS", 0, "Cages follow formation.")]);
  }

  if (finish) {
    const tails = out.filter((a) => a.kind === "task" && !out.some((b) => b.predecessors.some((p) => p.predecessorId === a.id) && b.kind !== "summary"));
    const preds = (tails.length ? tails : firstWorks).filter((a) => a.id !== finish.id);
    update(finish.id, preds.slice(-6).map((a) => link(a.id, "FS", 0, "Completion follows remaining construction.")));
  }

  return out;
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
  return rates.find((r) => r.activity_key === key && r.unit.toLowerCase() === unit.toLowerCase())
    ?? rates.find((r) => r.activity_key === key);
}

function sectionFor(item: QuantityTakeoff): string {
  if (item.activityKey === "pipe") return "Drainage";
  if (item.activityKey === "brickwork") return "Superstructure";
  if (item.activityKey === "roadworks" || item.activityKey === "gabion") return "External works";
  if (item.activityKey === "excavation" && item.elementKey?.includes("pipe")) return "Drainage";
  if (item.activityKey === "excavation" && /pad|beam|wall|foundation/i.test(`${item.elementKey} ${item.elementName} ${item.label}`)) {
    return "Foundations";
  }
  if (["formwork", "reinforcement", "concrete", "curing"].includes(item.activityKey)) return "Foundations";
  if (item.activityKey === "excavation" || item.activityKey === "backfill" || item.activityKey === "compaction") {
    if (/pad|beam|wall|foundation/i.test(`${item.elementKey} ${item.elementName}`)) return "Foundations";
    return "Earthworks";
  }
  return "Earthworks";
}
