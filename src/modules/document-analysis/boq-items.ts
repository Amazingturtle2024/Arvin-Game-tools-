import { locationLabel } from "./parse";
import { looksLikeBoqItem } from "./extract-facts";
import type { ParsedDocument, SourceRef } from "./types";

export type BoqLine = {
  itemNo: string;
  description: string;
  unit: string;
  quantity: number | null;
  source: SourceRef;
};

export function extractBoqLines(docs: ParsedDocument[]): BoqLine[] {
  const lines: BoqLine[] = [];
  for (const doc of docs) {
    if (doc.role !== "boq" && doc.kind !== "xlsx") continue;
    for (const unit of doc.units) {
      if (!looksLikeBoqItem(unit.text)) continue;
      const parts = unit.text.split("|").map((p) => p.trim());
      const qty = parseNumber(parts[3] ?? parts.find((p, i) => i > 1 && /^-?\d+(?:\.\d+)?$/.test(p)));
      const unitName = (parts[2] || "").toLowerCase();
      lines.push({
        itemNo: parts[0] || "",
        description: parts[1] || unit.text,
        unit: unitName,
        quantity: qty,
        source: {
          documentId: doc.documentId,
          documentName: doc.filename,
          page: unit.page,
          sheet: unit.sheet,
          row: unit.row,
          heading: unit.heading,
          clause: null,
          quote: unit.text,
          locationLabel: locationLabel(unit),
        },
      });
    }
  }
  return lines;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
