import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { parseIsoDate } from "./calendar";
import type { ConstructionProgramme } from "./types";
import { depthOf } from "./wbs";

export async function programmePdf(programme: ConstructionProgramme): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [842, 595];
  let page = doc.addPage(pageSize);
  const moss = rgb(0.18, 0.31, 0.24);
  const ink = rgb(0.11, 0.16, 0.14);
  const brass = rgb(0.69, 0.55, 0.24);
  const stamp = rgb(0.75, 0.31, 0.3);
  const taskBlue = rgb(0.31, 0.51, 0.74);
  const summary = rgb(0.12, 0.12, 0.12);
  const rule = rgb(0.8, 0.75, 0.65);

  const title = programme.setup.projectName.value || "Construction programme";
  page.drawText("PLANFORM — CONSTRUCTION PROGRAMME", { x: 36, y: 560, size: 9, font: bold, color: brass });
  page.drawText(title, { x: 36, y: 540, size: 16, font: bold, color: ink });
  page.drawText(`Revision ${programme.revision}  ·  ${programme.status}  ·  Planned completion ${programme.plannedCompletion || "—"}`, {
    x: 36, y: 522, size: 9, font, color: moss,
  });

  const leaves = programme.activities.filter((a) => a.kind !== "summary");
  const starts = leaves.map((a) => a.plannedStart).filter(Boolean) as string[];
  const finishes = leaves.map((a) => a.plannedFinish).filter(Boolean) as string[];
  const min = parseIsoDate(starts.sort()[0] || programme.setup.commencementDate.value);
  const max = parseIsoDate(finishes.sort().at(-1) || programme.setup.completionDate.value);
  const chartX = 220;
  const chartW = 586;
  const rowH = 14;
  let y = 500;
  const span = min && max ? Math.max(1, (max.getTime() - min.getTime()) / 86400000) : 1;

  page.drawText("WBS / Activity", { x: 36, y, size: 8, font: bold, color: moss });
  page.drawText("Gantt (calendar days)", { x: chartX, y, size: 8, font: bold, color: moss });
  y -= 10;
  page.drawLine({ start: { x: 36, y }, end: { x: 806, y }, thickness: 0.5, color: rule });
  y -= 12;

  for (const activity of programme.activities) {
    if (y < 40) {
      page = doc.addPage(pageSize);
      y = 550;
    }
    const depth = depthOf(activity, programme.activities);
    const label = `${activity.wbs}  ${activity.name}`.slice(0, 42);
    page.drawText(label, { x: 36 + depth * 8, y, size: 7, font: activity.kind === "summary" ? bold : font, color: ink });
    if (activity.plannedStart && activity.plannedFinish && min) {
      const a = parseIsoDate(activity.plannedStart);
      const b = parseIsoDate(activity.plannedFinish);
      if (a && b) {
        const x0 = chartX + ((a.getTime() - min.getTime()) / 86400000 / span) * chartW;
        const x1 = chartX + ((b.getTime() - min.getTime()) / 86400000 / span) * chartW;
        const w = Math.max(activity.kind === "milestone" ? 6 : 4, x1 - x0 + 4);
        if (activity.kind === "milestone") {
          page.drawRectangle({ x: x0, y: y - 1, width: 6, height: 6, color: summary });
        } else if (activity.kind === "summary") {
          page.drawRectangle({ x: x0, y: y + 2, width: w, height: 4, color: summary });
        } else {
          page.drawRectangle({ x: x0, y: y, width: w, height: 7, color: activity.critical ? stamp : taskBlue });
        }
      }
    }
    y -= rowH;
  }

  y -= 8;
  page.drawText("Critical tasks red, other tasks blue, summaries black. Dates follow the working calendar.", {
    x: 36, y: Math.max(y, 24), size: 7, font, color: moss,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
