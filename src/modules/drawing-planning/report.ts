import type { ProgrammeHandoff } from "@/kernel/handoff";
import { extractBoqLines } from "@/modules/document-analysis/boq-items";
import type { ParsedDocument } from "@/modules/document-analysis/types";
import { compareBoq } from "./compare-boq";
import { calculateDurations } from "./durations";
import { extractMeasurements, identifyDrawings } from "./extract";
import { buildMeasuredElements } from "./elements";
import { calculateQuantities } from "./quantities";
import { selectRate } from "./select-rate";
import { buildSequence, methodologyNarrative } from "./sequence";
import type { DrawingPlanningReport, PlanningRisk, ProductionRate } from "./types";

export function buildDrawingReport(input: {
  projectId: string;
  projectName: string;
  docs: ParsedDocument[];
  rates: ProductionRate[];
}): DrawingPlanningReport {
  const drawings = identifyDrawings(input.docs);
  const measurements = extractMeasurements(input.docs);
  const takeoff = calculateQuantities(input.docs);
  const elements = buildMeasuredElements(takeoff);
  const boq = extractBoqLines(input.docs);
  const boqComparison = compareBoq(takeoff, boq);
  const durations = calculateDurations(takeoff, input.rates);
  const sequence = buildSequence(durations);
  const discrepancies = findDiscrepancies(input.docs);
  const risks = buildRisks(takeoff, durations, boqComparison, drawings);
  const missingForProgramme = [
    ...durations.filter((d) => d.blockedReason).map((d) => d.blockedReason as string),
    ...takeoff.filter((t) => !t.complete).map((t) => t.assumptions[0]),
    ...(drawings.length === 0 ? ["No drawing with extractable text was identified."] : []),
  ];
  const hours = input.rates[0]?.hours_per_day ?? 8;
  const days = input.rates[0]?.days_per_week ?? 5;
  const handoff = toHandoff(input.projectId, durations, sequence, takeoff, input.rates, hours, days);

  return {
    module: "drawing-planning",
    generatedAt: new Date().toISOString(),
    projectId: input.projectId,
    projectName: input.projectName,
    methodology: [
      "After drawings are uploaded they are measured. Concrete work is reported in m³, reinforcement in tonnes per element, and surfaces in m². Missing figures stay blank.",
      "Quantities are calculated only from numbers found on the drawings or bill. Missing dimensions are listed; they are not filled in.",
      "Production rates come from your productivity table, not from the tender. Starter rates are labelled as such until you edit them.",
      "Duration = quantity ÷ (rate per day × teams × hours/8) × (1 + weather %). Working days, not calendar days, unless a week conversion is shown.",
      "Sequence is a method-statement reading for planning. Module 03 turns it into a Gantt chart; MS Project XML is an export, not an automatic write.",
      "BOQ comparison never changes either figure. Differences are for clarification.",
    ],
    drawings,
    measurements,
    discrepancies,
    takeoff,
    elements,
    durations,
    sequence,
    methodologyNarrative: methodologyNarrative(sequence, durations),
    boqComparison,
    risks,
    missingForProgramme,
    handoff,
    parsed: input.docs.map((d) => ({
      documentId: d.documentId,
      filename: d.filename,
      role: d.role,
      kind: d.kind,
      warnings: d.warnings,
    })),
  };
}

function findDiscrepancies(docs: ParsedDocument[]): DrawingPlanningReport["discrepancies"] {
  const out: DrawingPlanningReport["discrepancies"] = [];
  const spec = docs.filter((d) => d.role === "specification");
  const drawings = docs.filter((d) => d.role === "drawings");
  const specText = spec.map((d) => d.fullText).join("\n");
  for (const doc of drawings) {
    const concrete = doc.fullText.match(/\bC\d{2}\/\d{2}\b|\b\d{2}\s*MPa\b/);
    const specConcrete = specText.match(/\bC\d{2}\/\d{2}\b|\bBS\s*8500\b|\b\d{2}\s*MPa\b/);
    if (concrete && specConcrete && concrete[0].toLowerCase() !== specConcrete[0].toLowerCase()) {
      out.push({
        title: `Concrete specification versus drawing note — ${doc.filename}`,
        note: `The drawing states “${concrete[0]}” and the specification states “${specConcrete[0]}”. Neither has been selected.`,
        sources: [
          { documentId: doc.documentId, documentName: doc.filename, page: 1, sheet: null, row: null, heading: null, clause: null, quote: concrete[0], locationLabel: "drawing note" },
        ],
      });
    }
  }
  return out;
}

function buildRisks(
  takeoff: DrawingPlanningReport["takeoff"],
  durations: DrawingPlanningReport["durations"],
  boq: DrawingPlanningReport["boqComparison"],
  drawings: DrawingPlanningReport["drawings"],
): PlanningRisk[] {
  const risks: PlanningRisk[] = [];
  for (const item of takeoff.filter((t) => !t.complete)) {
    risks.push({
      id: `missing-${item.id}`,
      title: `${item.label} cannot be quantified`,
      category: "quantity",
      note: item.assumptions.join(" "),
      sources: item.inputs.map((i) => i.source),
    });
  }
  for (const row of boq.filter((b) => b.status === "difference" || b.status === "drawing_only")) {
    risks.push({
      id: `boq-${row.drawingItem || row.boqItem}`,
      title: "Drawing and BOQ do not agree, or a drawing item is unbilled",
      category: "information",
      note: row.note,
      sources: row.sources,
    });
  }
  if (drawings.some((d) => !d.scale)) {
    risks.push({
      id: "scale",
      title: "Scale not stated on one or more drawings",
      category: "quantity",
      note: "True lengths have been taken only from dimension notes, not by scaling the sheet.",
      sources: drawings.filter((d) => !d.scale).map((d) => d.source),
    });
  }
  if (durations.some((d) => d.blockedReason)) {
    risks.push({
      id: "rates",
      title: "Durations blocked where production rates are blank",
      category: "time",
      note: "Enter rates before these activities can go on a programme.",
      sources: [],
    });
  }
  risks.push({
    id: "procurement",
    title: "Long-lead items need confirmed periods",
    category: "procurement",
    note: "Pipes, reinforcement, brick and gabions are flagged for procurement. Lead-in days are not invented.",
    sources: [],
  });
  return risks;
}

function toHandoff(
  projectId: string,
  durations: DrawingPlanningReport["durations"],
  sequence: DrawingPlanningReport["sequence"],
  takeoff: DrawingPlanningReport["takeoff"],
  rates: ProductionRate[],
  hoursPerDay: number,
  daysPerWeek: number,
): ProgrammeHandoff {
  const ready = durations.filter((d) => d.durationWorkingDays != null);
  return {
    module: "drawing-planning",
    generatedAt: new Date().toISOString(),
    projectId,
    calendar: { hoursPerDay, daysPerWeek },
    activities: ready.map((d) => {
      const seq = sequence.find((s) => s.activityKey === d.activityKey);
      const rate = selectRate(rates, d.activityKey, d.unit);
      const qtyItems = takeoff.filter((t) => t.activityKey === d.activityKey && t.unit === d.unit && t.complete);
      return {
        id: d.activityKey,
        name: seq?.name || d.label,
        wbs: d.activityKey,
        quantity: d.quantity,
        unit: d.unit,
        durationWorkingDays: d.durationWorkingDays as number,
        teams: d.teams,
        plant: d.plant,
        predecessors: (seq?.predecessors ?? []).map((id) => ({ id, type: "FS" as const, lagDays: 0 })),
        canRunWith: seq?.concurrentWith ?? [],
        quantityAudit: qtyItems.flatMap((t) => t.inputs.map((i) => i.source)),
        rateAudit: {
          rateId: rate?.id || "",
          label: rate?.label || d.activityKey,
          ratePerDay: d.ratePerDay || 0,
          unit: d.unit,
        },
        formula: d.formula,
      };
    }),
  };
}
