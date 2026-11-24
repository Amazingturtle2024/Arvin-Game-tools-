import { describe, expect, it } from "vitest";
import { analyzeDocuments } from "@/modules/document-analysis";
import { buildSampleTenderPack } from "@/modules/document-analysis/sample-pack";
import { analyzeDrawings } from "@/modules/drawing-planning";
import { buildSampleDrawingPack } from "@/modules/drawing-planning/sample";
import { STARTER_RATES } from "@/modules/drawing-planning/starter-rates";
import type { ProductionRate } from "@/modules/drawing-planning/types";
import { applySchedule } from "./apply";
import { addWorkingDays, parseEnglishDate, parseIsoDate } from "./calendar";
import { runCpm } from "./cpm";
import { addLink, removeLink, updateLink } from "./links";
import { calculateWorkingDays } from "./duration";
import { generateProgramme } from "./generate";
import { nextSaveMeta } from "./revision";
import { programmeMspXml } from "./msp-xml";
import { seedSetup } from "./seed";
import type { ProgrammeActivity, ProgrammeSetup } from "./types";

function rates(): ProductionRate[] {
  return STARTER_RATES.map((row, i) => ({
    id: `r${i}`,
    owner_id: "test",
    activity_key: row.activity_key,
    variant_key: row.variant_key,
    trade: row.trade,
    label: row.label,
    unit: row.unit,
    rate_per_day: row.rate_per_day,
    workers: row.workers,
    teams: 1,
    plant: row.plant,
    hours_per_day: 8,
    days_per_week: 5,
    site_conditions: "",
    accessibility: "",
    weather_allowance_pct: 0,
    notes: row.notes,
    is_default: row.is_default,
  }));
}

function blankSetup(over: Partial<Record<keyof ProgrammeSetup, Partial<ProgrammeSetup[keyof ProgrammeSetup]>>> = {}): ProgrammeSetup {
  const setup = seedSetup({ projectName: "Test", tender: null, drawings: null, rates: rates() });
  for (const [key, patch] of Object.entries(over)) {
    const field = setup[key as keyof ProgrammeSetup];
    Object.assign(field, patch);
  }
  return setup;
}

describe("programme duration and calendar", () => {
  it("uses quantity ÷ (rate × teams) and does not invent a duration", () => {
    const ok = calculateWorkingDays({
      quantity: 1200, ratePerDay: 150, teams: 2, hoursPerDay: 8, weatherAllowancePct: null, durationManual: false, durationWorkingDays: null,
    });
    expect(ok.days).toBe(4);
    const missing = calculateWorkingDays({
      quantity: 1200, ratePerDay: null, teams: 2, hoursPerDay: 8, weatherAllowancePct: null, durationManual: false, durationWorkingDays: null,
    });
    expect(missing.days).toBeNull();
    expect(missing.blockedReason).toMatch(/production rate/i);
  });

  it("walks Monday–Friday and skips the weekend", () => {
    const setup = blankSetup({
      commencementDate: { value: "2026-04-06", origin: "user", sourceLabel: null },
      workingPattern: { value: "monday_friday", origin: "user", sourceLabel: null },
      saturdays: { value: false, origin: "user", sourceLabel: null },
    });
    const monday = parseIsoDate("2026-04-06")!;
    expect(monday.getUTCDay()).toBe(1);
    expect(addWorkingDays(monday, 5, setup).toISOString().slice(0, 10)).toBe("2026-04-10");
    expect(addWorkingDays(monday, 6, setup).toISOString().slice(0, 10)).toBe("2026-04-13");
    expect(parseEnglishDate("6 April 2026")).toBe("2026-04-06");
  });
});

describe("critical path", () => {
  it("marks the zero-float chain and honours FS lag", () => {
    const a = task("A", 4, []);
    const b = task("B", 2, [{ predecessorId: "A", type: "FS", lagWorkingDays: 1, origin: "recommendation", why: "test" }]);
    const rows = runCpm([a, b]);
    const A = rows.find((r) => r.id === "A")!;
    const B = rows.find((r) => r.id === "B")!;
    expect(A.es).toBe(0);
    expect(A.ef).toBe(4);
    expect(B.es).toBe(5);
    expect(B.ef).toBe(7);
    expect(A.critical).toBe(true);
    expect(B.critical).toBe(true);
    expect(A.totalFloat).toBe(0);
  });

  it("lets the planner add, change and remove links without inventing a loop", () => {
    const start = [task("A", 4, []), task("B", 2, []), task("C", 3, [])];
    const linked = addLink(start, "B", "A", "FS", 0);
    expect(linked.find((r) => r.id === "B")?.predecessors).toEqual([
      expect.objectContaining({ predecessorId: "A", type: "FS", origin: "user" }),
    ]);
    const ss = updateLink(linked, "B", "A", { type: "SS", lagWorkingDays: 2 });
    expect(ss.find((r) => r.id === "B")?.predecessors[0]).toMatchObject({ type: "SS", lagWorkingDays: 2 });
    const loop = addLink(ss, "A", "B", "FS", 0);
    expect(loop.find((r) => r.id === "A")?.predecessors).toEqual([]);
    const cleared = removeLink(ss, "B", "A");
    expect(cleared.find((r) => r.id === "B")?.predecessors).toEqual([]);
  });

  it("recalculates dates when the planner changes a link", () => {
    const setup = blankSetup({
      commencementDate: { value: "2026-04-06", origin: "user", sourceLabel: null },
      workingPattern: { value: "monday_friday", origin: "user", sourceLabel: null },
      saturdays: { value: false, origin: "user", sourceLabel: null },
    });
    const shell = {
      module: "programme" as const,
      generatedAt: "",
      projectId: "p",
      revision: 1,
      status: "draft" as const,
      setup,
      warnings: [],
      criticalPath: [],
      plannedCompletion: null,
      contractCompletion: null,
      methodology: [],
      baselineOf: null,
    };
    const open = applySchedule({ ...shell, activities: [task("A", 5, []), task("B", 2, [])] });
    expect(open.activities.find((r) => r.id === "B")?.plannedStart).toBe("2026-04-06");
    const fs = applySchedule({ ...shell, activities: addLink(open.activities, "B", "A", "FS", 0) });
    expect(fs.activities.find((r) => r.id === "A")?.plannedFinish).toBe("2026-04-10");
    expect(fs.activities.find((r) => r.id === "B")?.plannedStart).toBe("2026-04-13");
    const ss = applySchedule({ ...shell, activities: updateLink(fs.activities, "B", "A", { type: "SS", lagWorkingDays: 0 }) });
    expect(ss.activities.find((r) => r.id === "B")?.plannedStart).toBe("2026-04-06");
    const lagged = applySchedule({ ...shell, activities: updateLink(fs.activities, "B", "A", { lagWorkingDays: 2 }) });
    expect(lagged.activities.find((r) => r.id === "B")?.plannedStart).toBe("2026-04-15");
  });
});

describe("module 3 programme from modules 1 and 2", () => {
  it("builds a WBS from the actual pack, not a generic finishes template", async () => {
    const tenderFiles = await buildSampleTenderPack();
    const drawingFiles = await buildSampleDrawingPack();
    const files = [...tenderFiles, ...drawingFiles].map((file, i) => ({
      documentId: `f${i}`,
      filename: file.filename,
      mime: file.mime,
      bytes: file.bytes,
    }));
    const tender = await analyzeDocuments({ projectId: "p1", projectName: "Riverside", files });
    const drawings = await analyzeDrawings({ projectId: "p1", projectName: "Riverside", files, rates: rates() });
    const programme = generateProgramme({
      projectId: "p1",
      projectName: "Riverside",
      tender: tender.report,
      drawings,
      rates: rates(),
      revision: 1,
    });
    expect(programme.setup.client.value).toMatch(/Bristol City Council/);
    expect(programme.setup.commencementDate.value).toBe("2026-04-06");
    expect(programme.setup.contractType.value).toMatch(/NEC4/);
    expect(programme.activities.some((a) => /plaster|paint|commission/i.test(a.name))).toBe(false);
    expect(programme.activities.some((a) => /Site establishment/i.test(a.name))).toBe(true);
    const pads = programme.activities.find((a) => a.name.includes("Excavation — foundation pads"));
    expect(pads?.durationWorkingDays).toBeCloseTo(147 / 100, 2);
    expect(pads?.origin).toBe("recommendation");
    const curing = programme.activities.find((a) => a.name.startsWith("Curing"));
    expect(curing?.durationWorkingDays).toBeNull();
    expect(curing?.blockedReason).toMatch(/not been assumed|not stated/i);
    expect(programme.activities.some((a) => a.critical && a.kind === "task")).toBe(true);
    const xml = programmeMspXml(programme);
    expect(xml).toContain("<Project");
    expect(xml).toContain("Excavation");
    expect(xml).toContain("PredecessorLink");

    const locked = programme.activities.map((a) => a.name.includes("Site establishment") ? { ...a, approval: "approved" as const, durationManual: true, durationWorkingDays: 12 } : a);
    const again = generateProgramme({
      projectId: "p1",
      projectName: "Riverside",
      tender: tender.report,
      drawings,
      rates: rates(),
      previous: { ...programme, activities: locked },
      revision: 2,
    });
    const kept = again.activities.find((a) => a.name.includes("Site establishment"));
    expect(kept?.approval).toBe("approved");
    expect(kept?.durationWorkingDays).toBe(12);

    const finish = programme.activities.find((a) => a.activityKey === "milestone-finish");
    const orphans = programme.activities.filter((a) => (
      a.kind === "task"
      && a.activityKey !== "milestone-finish"
      && !programme.activities.some((b) => b.predecessors.some((p) => p.predecessorId === a.id))
    ));
    expect(orphans).toEqual([]);
    expect(finish?.predecessors.length).toBeGreaterThan(0);

    const prefixed = programme.activities.map((a) => ({
      ...a,
      id: `prev-${a.id}`,
      parentId: a.parentId ? `prev-${a.parentId}` : null,
      predecessors: a.predecessors.map((p) => ({ ...p, predecessorId: `prev-${p.predecessorId}` })),
      approval: a.name.includes("Concrete — foundation pads") ? "approved" as const : a.approval,
      durationManual: a.name.includes("Concrete — foundation pads") ? true : a.durationManual,
      durationWorkingDays: a.name.includes("Concrete — foundation pads") ? 99 : a.durationWorkingDays,
    }));
    const remapped = generateProgramme({
      projectId: "p1",
      projectName: "Riverside",
      tender: tender.report,
      drawings,
      rates: rates(),
      previous: { ...programme, activities: prefixed },
      revision: 3,
    });
    const conc = remapped.activities.find((a) => a.name.includes("Concrete — foundation pads"));
    expect(conc?.approval).toBe("approved");
    expect(conc?.durationWorkingDays).toBe(99);
    expect(conc?.id.startsWith("prev-")).toBe(false);
    expect(conc?.predecessors.every((p) => remapped.activities.some((a) => a.id === p.predecessorId))).toBe(true);
    expect(conc?.predecessors.some((p) => p.predecessorId.startsWith("prev-"))).toBe(false);
  });

  it("opens a new draft revision after a baseline instead of overwriting it", () => {
    const previous = {
      module: "programme" as const,
      generatedAt: "",
      projectId: "p",
      revision: 4,
      status: "baseline" as const,
      setup: blankSetup(),
      activities: [],
      warnings: [],
      criticalPath: [],
      plannedCompletion: null,
      contractCompletion: null,
      methodology: [],
      baselineOf: 4,
    };
    expect(nextSaveMeta(previous, { ...previous, status: "draft" })).toEqual({
      revision: 5,
      status: "draft",
      baselineOf: 4,
    });
  });

  it("recalculates dates when teams change and leaves a planner override", () => {
    const setup = blankSetup({ commencementDate: { value: "2026-04-06", origin: "user", sourceLabel: null } });
    const activity = task("EXC", 0, []);
    activity.quantity = 1200;
    activity.unit = "m3";
    activity.ratePerDay = 150;
    activity.teams = 2;
    activity.durationManual = false;
    activity.durationWorkingDays = null;
    const programme = applySchedule({
      module: "programme",
      generatedAt: "",
      projectId: "p",
      revision: 1,
      status: "draft",
      setup,
      activities: [activity],
      warnings: [],
      criticalPath: [],
      plannedCompletion: null,
      contractCompletion: null,
      methodology: [],
      baselineOf: null,
    });
    expect(programme.activities[0].durationWorkingDays).toBe(4);
    expect(programme.activities[0].plannedStart).toBe("2026-04-06");
    expect(programme.activities[0].plannedFinish).toBe("2026-04-09");
    programme.activities[0].durationManual = true;
    programme.activities[0].durationWorkingDays = 10;
    const overridden = applySchedule(programme);
    expect(overridden.activities[0].durationWorkingDays).toBe(10);
    expect(overridden.activities[0].durationFormula).toMatch(/override/i);
  });
});

function task(id: string, duration: number, predecessors: ProgrammeActivity["predecessors"]): ProgrammeActivity {
  return {
    id,
    wbs: id,
    activityId: id,
    name: id,
    kind: "task",
    parentId: null,
    section: "Works",
    boqRef: null,
    drawingRef: null,
    quantity: null,
    unit: "",
    ratePerDay: null,
    teams: 1,
    durationWorkingDays: duration,
    durationManual: true,
    durationFormula: "",
    blockedReason: null,
    predecessors,
    plannedStart: null,
    plannedFinish: null,
    startConstraint: null,
    responsible: "",
    status: "not_started",
    progressPct: 0,
    approval: "recommended",
    origin: "recommendation",
    activityKey: id,
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
