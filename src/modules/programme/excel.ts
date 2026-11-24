import * as XLSX from "xlsx";
import type { ConstructionProgramme } from "./types";

export function programmeWorkbook(programme: ConstructionProgramme): Buffer {
  const wb = XLSX.utils.book_new();
  const setup = programme.setup;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Construction programme", setup.projectName.value],
    ["Revision", programme.revision, "Status", programme.status],
    ["Generated", programme.generatedAt],
    [],
    ["Field", "Value", "Origin", "Source"],
    ...Object.entries(setup).map(([key, field]) => [
      key,
      Array.isArray(field.value) ? field.value.join(", ") : String(field.value ?? ""),
      field.origin,
      field.sourceLabel,
    ]),
  ]), "Setup");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Activity schedule — working days. Neither BOQ nor drawing quantities are changed."],
    ["WBS", "ID", "Description", "Kind", "BOQ", "Drawing", "Qty", "Unit", "Rate/day", "Teams", "Duration", "Formula", "Predecessor", "Rel", "Lag", "Start", "Finish", "Responsible", "Status", "Progress %", "Approval", "ES", "EF", "LS", "LF", "Total float", "Free float", "Critical"],
    ...programme.activities.map((a) => [
      a.wbs, a.activityId, a.name, a.kind, a.boqRef, a.drawingRef, a.quantity ?? "", a.unit, a.ratePerDay ?? "", a.teams,
      a.durationWorkingDays ?? "", a.durationFormula,
      a.predecessors.map((p) => p.predecessorId).join("; "),
      a.predecessors.map((p) => p.type).join("; "),
      a.predecessors.map((p) => p.lagWorkingDays).join("; "),
      a.plannedStart, a.plannedFinish, a.responsible, a.status, a.progressPct, a.approval,
      a.es, a.ef, a.ls, a.lf, a.totalFloat, a.freeFloat, a.critical ? "yes" : "",
    ]),
  ]), "Schedule");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Programme checks"],
    ["Severity", "Title", "Detail", "Activity"],
    ...programme.warnings.map((w) => [w.severity, w.title, w.detail, w.activityId]),
  ]), "Checks");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
