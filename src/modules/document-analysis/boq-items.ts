import { locationLabel } from "./parse";
import { looksLikeBoqItem } from "./extract-facts";
import type { BoqLine, ParsedDocument } from "./types";

export type { BoqLine };

export function extractBoqLines(docs: ParsedDocument[]): BoqLine[] {
  const lines: BoqLine[] = [];
  for (const doc of docs) {
    if (doc.role !== "boq" && doc.kind !== "xlsx") continue;
    let section: string | null = null;
    for (const unit of doc.units) {
      const parts = unit.text.split("|").map((p) => p.trim());
      if (/^bill$/i.test(parts[0]) && parts[1]) {
        section = parts.slice(1).join(" ");
        continue;
      }
      if (/^(item|ref)$/i.test(parts[0]) && /description/i.test(parts[1] || "")) continue;
      if (!looksLikeBoqItem(unit.text)) continue;
      const qty = parseNumber(parts[3] ?? parts.find((p, i) => i > 1 && /^-?\d+(?:\.\d+)?$/.test(p)));
      lines.push({
        itemNo: parts[0] || "",
        description: parts[1] || unit.text,
        unit: (parts[2] || "").toLowerCase(),
        quantity: qty,
        rate: parseNumber(parts[4]),
        amount: parseNumber(parts[5]),
        section: section || unit.heading,
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
