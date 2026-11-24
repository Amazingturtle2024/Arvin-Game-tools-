import * as XLSX from "xlsx";
import type { DrawingPlanningReport } from "./types";

export function drawingReportWorkbook(report: DrawingPlanningReport): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Drawing Analysis Report", report.projectName],
    ["Generated", report.generatedAt],
    [],
    ["File", "Kind", "Drawing no.", "Rev", "Scale", "Title"],
    ...report.drawings.map((d) => [d.documentName, d.drawingKind, d.drawingNumber, d.revision, d.scale, d.title]),
    [],
    ["Measurements"],
    ["Kind", "Value", "Unit", "Quote", "Source"],
    ...report.measurements.map((m) => [m.kind, m.value, m.unit, m.raw, `${m.source.documentName} ${m.source.locationLabel}`]),
  ]), "Drawing analysis");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Measured elements — concrete m³, rebar t, area m²"],
    ["Element", "Measure", "Unit", "Qty", "Complete", "Formula / note", "Drawings"],
    ...report.elements.flatMap((el) => el.measures.map((m) => [
      el.name, m.label, m.unit, m.quantity ?? "", m.complete ? "yes" : "no", m.complete ? m.formula : (m.note || ""), el.sourceDrawings.join("; "),
    ])),
  ]), "Measured");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Quantity Take-Off"],
    ["Activity", "Label", "Qty", "Unit", "Formula", "Assumptions", "Drawings"],
    ...report.takeoff.map((t) => [t.activityKey, t.label, t.complete ? t.quantity : "", t.unit, t.formula, t.assumptions.join("; "), t.sourceDrawings.join("; ")]),
  ]), "Take-off");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Production rates used"],
    ["Activity", "Qty", "Unit", "Rate/day", "Teams", "Hours/day", "Weather %", "Effective daily", "Working days", "Formula", "Blocked"],
    ...report.durations.map((d) => [d.label, d.quantity, d.unit, d.ratePerDay, d.teams, d.hoursPerDay, d.weatherAllowancePct, d.effectiveDaily, d.durationWorkingDays, d.formula, d.blockedReason]),
  ]), "Durations");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["BOQ versus drawing — neither figure is changed"],
    ["Status", "BOQ item", "Drawing item", "Unit", "BOQ qty", "Drawing qty", "Variance qty", "Variance %", "Note"],
    ...report.boqComparison.map((r) => [r.status, r.boqItem, r.drawingItem, r.unit, r.boqQty, r.drawingQty, r.varianceQty, r.variancePct, r.note]),
  ]), "BOQ comparison");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Methodology and sequence"],
    ...report.methodologyNarrative.map((line) => [line]),
    [],
    ["Activity", "Predecessors", "Concurrent", "Why"],
    ...report.sequence.map((s) => [s.name, s.predecessors.join(", "), s.concurrentWith.join(", "), s.why]),
  ]), "Sequence");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Planning risk register"],
    ["ID", "Category", "Title", "Note"],
    ...report.risks.map((r) => [r.id, r.category, r.title, r.note]),
  ]), "Risks");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Programme handoff (future MS Project 2013)"],
    ["ID", "Name", "Qty", "Unit", "Working days", "Teams", "Plant", "Predecessors", "Formula"],
    ...report.handoff.activities.map((a) => [a.id, a.name, a.quantity, a.unit, a.durationWorkingDays, a.teams, a.plant, a.predecessors.map((p) => p.id).join(", "), a.formula]),
  ]), "Handoff");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
