import { describe, expect, it } from "vitest";
import { extractFacts, locateQuote, resetFactIds } from "../document-analysis/extract-facts";
import { buildReport } from "../document-analysis/report";
import { buildSampleTenderPack } from "../document-analysis/sample-pack";
import { analyzeDocuments } from "../document-analysis";
import type { ParsedDocument } from "../document-analysis/types";
import { analyzeDrawings } from "./index";
import { compareBoq } from "./compare-boq";
import { calculateDurations } from "./durations";
import { calculateQuantities } from "./quantities";
import { selectRate } from "./select-rate";
import { MASTER_RATES, STARTER_RATES } from "./starter-rates";
import { buildSampleDrawingPack } from "./sample";
import type { ProductionRate, QuantityTakeoff } from "./types";

function doc(partial: Partial<ParsedDocument> & { fullText: string; filename: string }): ParsedDocument {
  const units = partial.units ?? [{ text: partial.fullText, page: 1, sheet: null, row: null, heading: null }];
  return {
    documentId: partial.documentId ?? "d1",
    filename: partial.filename,
    mime: partial.mime ?? "application/pdf",
    kind: partial.kind ?? "pdf",
    role: partial.role ?? "other",
    roleReason: partial.roleReason ?? "test",
    units,
    fullText: partial.fullText,
    warnings: [],
    pageCount: 1,
    sheetNames: partial.sheetNames ?? [],
  };
}

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
    teams: row.teams,
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

describe("module 1 bugbot regressions", () => {
  it("does not treat a random spreadsheet as a bill", () => {
    resetFactIds();
    const docs = [doc({
      filename: "resource-histogram.xlsx",
      kind: "xlsx",
      role: "other",
      fullText: "Week | Gang | Hours\n1 | 4 | 40",
      units: [{ text: "Week | Gang | Hours", page: null, sheet: "Plan", row: 1, heading: "Plan" }],
      sheetNames: ["Plan"],
    })];
    const report = buildReport({ projectId: "p", projectName: "n", docs, extraFacts: extractFacts(docs) });
    expect(report.boq.found).toBe(false);
  });

  it("locates a model quote on the file that actually contains it", () => {
    const docs = [
      doc({ documentId: "a", filename: "wrong.pdf", fullText: "Unrelated notes about brickwork." }),
      doc({ documentId: "b", filename: "right.pdf", fullText: "The delay damages are £8,500 per day on this page." }),
    ];
    const found = locateQuote("delay damages are £8,500 per day", docs);
    expect(found?.doc.filename).toBe("right.pdf");
  });
});

describe("module 2 drawing take-off", () => {
  it("calculates pad volumes from stated sizes and does not invent a wall-footing depth", async () => {
    const drawings = await buildSampleDrawingPack();
    const tender = await buildSampleTenderPack();
    const files = [...tender, ...drawings].map((file, i) => ({
      documentId: `f${i}`,
      filename: file.filename,
      mime: file.mime,
      bytes: file.bytes,
    }));
    const report = await analyzeDrawings({
      projectId: "p1",
      projectName: "Riverside",
      files,
      rates: rates(),
    });
    const excavation = report.takeoff.find((t) => t.label.includes("Excavation — foundation pads") && t.complete);
    expect(excavation?.quantity).toBe(147);
    expect(excavation?.formula).toMatch(/12/);
    const concrete = report.takeoff.find((t) => t.label.includes("Concrete — foundation pads") && t.complete);
    expect(concrete?.quantity).toBe(60);
    const wall = report.takeoff.find((t) => /wall footing/i.test(t.label) || t.assumptions.some((a) => /depth/i.test(a)));
    expect(report.takeoff.some((t) => t.complete === false && /depth/i.test(t.assumptions.join(" ")))).toBe(true);
    expect(wall === undefined || wall.complete === false).toBe(true);
    const pipe = report.takeoff.find((t) => t.label.includes("150 mm pipe") && t.complete);
    expect(pipe?.quantity).toBe(210);
    const excDuration = report.durations.find((d) => d.activityKey === "excavation");
    expect(excDuration?.quantity).toBeGreaterThan(147);
    expect(excDuration?.durationWorkingDays).toBeCloseTo((excDuration?.quantity ?? 0) / 100, 1);
    expect(report.boqComparison.some((r) => r.status === "difference" || r.status === "match")).toBe(true);
    const pipe150 = report.boqComparison.find((r) => /150/.test(r.boqItem || "") && /150/.test(r.drawingItem || ""));
    expect(pipe150?.status).toBe("match");
    expect(pipe150?.boqQty).toBe(210);
    expect(pipe150?.drawingQty).toBe(210);
    const pipe450 = report.boqComparison.find((r) => /450/.test(r.boqItem || "") && /450/.test(r.drawingItem || ""));
    expect(pipe450?.status).toBe("match");
    const pads = report.boqComparison.find((r) => /C\.1/.test(r.boqItem || ""));
    expect(pads?.drawingQty).toBe(147);
    expect(pads?.status).toBe("difference");
    const padEl = report.elements.find((e) => e.id === "pad-footings");
    expect(padEl?.measures.find((m) => m.kind === "concrete_m3")?.quantity).toBe(60);
    expect(padEl?.measures.find((m) => m.kind === "rebar_t")?.complete).toBe(false);
    expect(padEl?.measures.find((m) => m.kind === "area_m2")?.quantity).toBe(96);
    const beamEl = report.elements.find((e) => e.id === "ground-beams");
    expect(beamEl?.measures.find((m) => m.kind === "concrete_m3")?.complete).toBe(true);
    expect(beamEl?.measures.find((m) => m.kind === "rebar_t")?.complete).toBe(true);
    const wallEl = report.elements.find((e) => e.id === "wall-footing");
    expect(wallEl?.measures.find((m) => m.kind === "concrete_m3")?.complete).toBe(false);
    expect(report.handoff.activities.length).toBeGreaterThan(0);
    expect(report.drawings.some((d) => d.drawingNumber === "S-FDN-101")).toBe(true);
    expect(report.drawings.find((d) => d.drawingNumber === "A-GA-001")?.drawingKind).toBe("general_arrangement");
    const roadDurations = report.durations.filter((d) => d.activityKey === "roadworks");
    expect(roadDurations.some((d) => d.unit === "m3" && d.quantity === 18.7)).toBe(true);
    expect(roadDurations.every((d) => d.unit !== "m3" || d.quantity < 100)).toBe(true);
  });

  it("does not take wall-footing depth from a different drawing", () => {
    const takeoff = calculateQuantities([
      doc({
        documentId: "wall",
        filename: "S-DET-401 Wall Footing Detail.pdf",
        role: "drawings",
        fullText: "Wall footing length 18 m width 0.9 m. Depth not stated on this detail.",
      }),
      doc({
        documentId: "other",
        filename: "S-FDN-999 Other.pdf",
        role: "drawings",
        fullText: "Wall footing depth 0.6 m on a different sheet.",
      }),
    ]);
    const wall = takeoff.find((t) => /wall footing/i.test(t.label));
    expect(wall?.complete).toBe(false);
    expect(wall?.assumptions.join(" ")).toMatch(/depth/i);
  });

  it("does not add a stated excavation total on top of a calculated pad volume", () => {
    const takeoff = calculateQuantities([
      doc({
        filename: "S-FDN-101 Foundation Plan.pdf",
        role: "drawings",
        fullText: "Foundation pads: 12 nr 2.5 m x 2.5 m x 0.8 m deep. Working space 0.5 m. Excavate to 1.0 m below NGL. Total excavation: 999 m3.",
      }),
    ]);
    const excavation = takeoff.filter((t) => t.activityKey === "excavation" && t.complete);
    expect(excavation).toHaveLength(1);
    expect(excavation[0].quantity).toBe(147);
  });

  it("blocks duration when the production rate is blank", async () => {
    const drawings = await buildSampleDrawingPack();
    const files = drawings.map((file, i) => ({
      documentId: `d${i}`,
      filename: file.filename,
      mime: file.mime,
      bytes: file.bytes,
    }));
    const blank = rates().map((r) => ({ ...r, rate_per_day: null }));
    const report = await analyzeDrawings({
      projectId: "p1",
      projectName: "Riverside",
      files,
      rates: blank,
    });
    expect(report.durations.every((d) => d.durationWorkingDays == null)).toBe(true);
    expect(report.durations.some((d) => d.blockedReason?.includes("No production rate"))).toBe(true);
  });

  it("does not take quantities from a method statement that is not a drawing", () => {
    const takeoff = calculateQuantities([
      doc({
        filename: "Construction Phase Plan.pdf",
        role: "other",
        fullText: "Foundation pads: 12 nr 2.5 m x 2.5 m x 0.8 m deep. Working space 0.5 m. Excavate to 1.0 m below NGL.",
      }),
    ]);
    expect(takeoff).toHaveLength(0);
  });

  it("does not attach two take-off groups to the same BOQ line", () => {
    const src = {
      documentId: "b",
      documentName: "boq.xlsx",
      page: null,
      sheet: "Bill",
      row: 1,
      heading: null,
      clause: null,
      quote: "excavate and backfill",
      locationLabel: "Bill r.1",
    };
    const rows = compareBoq(
      [
        qty("excavation", "Pads", "m3", 10),
        qty("backfill", "Backfill", "m3", 8),
      ],
      [{ itemNo: "C.1", description: "Excavate and backfill foundations", unit: "m3", quantity: 12, rate: null, amount: null, section: "Measured works", source: src }],
    );
    const billed = rows.filter((r) => r.boqItem?.includes("C.1"));
    expect(billed).toHaveLength(1);
    expect(billed[0].drawingItem).toBe("Pads");
    expect(billed[0].drawingQty).toBe(10);
    expect(rows.find((r) => r.drawingItem === "Backfill")?.status).toBe("drawing_only");
  });

  it("does not let a leading modifier or included fill steal the billed activity", () => {
    const src = {
      documentId: "b",
      documentName: "boq.xlsx",
      page: null,
      sheet: "Bill",
      row: 2,
      heading: null,
      clause: null,
      quote: "road excavation",
      locationLabel: "Bill r.2",
    };
    const road = compareBoq(
      [
        qty("roadworks", "Roadworks layer", "m3", 18.7),
        qty("excavation", "Trench excavation", "m3", 40),
      ],
      [{ itemNo: "C.4", description: "Road excavation", unit: "m3", quantity: 40, rate: null, amount: null, section: "Measured works", source: src }],
    );
    expect(road.find((r) => r.boqItem?.includes("C.4"))?.drawingItem).toBe("Trench excavation");
    expect(road.find((r) => r.drawingItem === "Roadworks layer")?.status).toBe("drawing_only");

    const fill = compareBoq(
      [
        qty("excavation", "Pads", "m3", 10),
        qty("backfill", "Backfill", "m3", 8),
      ],
      [{ itemNo: "C.5", description: "Backfill to excavations", unit: "m3", quantity: 8, rate: null, amount: null, section: "Measured works", source: { ...src, row: 3, quote: "backfill to excavations" } }],
    );
    expect(fill.find((r) => r.boqItem?.includes("C.5"))?.drawingItem).toBe("Backfill");

    const excavated = compareBoq(
      [
        qty("excavation", "Pads", "m3", 10),
        qty("backfill", "Backfill", "m3", 8),
      ],
      [{ itemNo: "C.6", description: "Backfill excavated material", unit: "m3", quantity: 8, rate: null, amount: null, section: "Measured works", source: { ...src, row: 4, quote: "backfill excavated material" } }],
    );
    expect(excavated.find((r) => r.boqItem?.includes("C.6"))?.drawingItem).toBe("Backfill");

    const pipeline = compareBoq(
      [qty("pipe", "150 mm pipe", "m", 210)],
      [{ itemNo: "R.3", description: "150mm pipeline", unit: "m", quantity: 210, rate: null, amount: null, section: "Measured works", source: { ...src, row: 5, quote: "150mm pipeline" } }],
    );
    expect(pipeline.find((r) => r.boqItem?.includes("R.3"))?.drawingItem).toBe("150 mm pipe");
    expect(pipeline.find((r) => r.boqItem?.includes("R.3"))?.status).toBe("match");
  });

  it("uses the Production Rates MASTER default gang, not bulk plant output", () => {
    expect(selectRate(MASTER_RATES, "excavation", "m3")?.rate_per_day).toBe(100);
    expect(selectRate(MASTER_RATES, "excavation", "m3")?.label).toMatch(/1 TRUCK/i);
    expect(selectRate(MASTER_RATES, "pipe", "m")?.rate_per_day).toBe(40);
    expect(selectRate(MASTER_RATES, "formwork", "m2")?.rate_per_day).toBe(12);
    expect(selectRate(MASTER_RATES, "concrete", "m3")?.rate_per_day).toBe(20);
    const bulk = MASTER_RATES.find((r) => /BULK, 70m3/i.test(r.label));
    expect(bulk?.rate_per_day).toBe(630);
    expect(selectRate(MASTER_RATES, "excavation", "m3")?.variant_key).not.toBe(bulk?.variant_key);
    expect(selectRate(MASTER_RATES, "pipe", "kg")).toBeUndefined();
    expect(selectRate(MASTER_RATES, "excavation", "t")).toBeUndefined();
  });

  it("does not invent a duration when the rate is in a different unit", () => {
    const result = calculateDurations(
      [qty("excavation", "Pads", "t", 12)],
      rates(),
    );
    expect(result[0].durationWorkingDays).toBeNull();
    expect(result[0].blockedReason).toMatch(/units are not mixed/i);
  });

  it("blocks duration when hours per day are zero", () => {
    const result = calculateDurations(
      [qty("excavation", "Pads", "m3", 150)],
      rates().map((r) => (r.activity_key === "excavation" ? { ...r, hours_per_day: 0 } : r)),
    );
    expect(result[0].durationWorkingDays).toBeNull();
    expect(result[0].blockedReason).toMatch(/hours per day/i);
  });
});

function qty(activityKey: string, label: string, unit: string, quantity: number): QuantityTakeoff {
  return {
    id: label,
    activityKey,
    label,
    unit,
    quantity,
    formula: `${quantity}`,
    inputs: [],
    assumptions: [],
    sourceDrawings: [],
    complete: true,
    elementKey: activityKey,
    elementName: label,
  };
}

describe("sample tender still extracts spec sections", () => {
  it("finds Section A in the works information PDF", async () => {
    const files = await buildSampleTenderPack();
    const { report } = await analyzeDocuments({
      projectId: "p",
      projectName: "s",
      files: files.map((file, i) => ({
        documentId: `s${i}`,
        filename: file.filename,
        mime: file.mime,
        bytes: file.bytes,
      })),
    });
    expect(report.specifications.length).toBeGreaterThan(0);
  });
});
