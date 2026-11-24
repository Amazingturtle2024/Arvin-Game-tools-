import { locationLabel } from "@/modules/document-analysis/parse";
import type { ParsedDocument, SourceRef } from "@/modules/document-analysis/types";
import type { DrawingIdentity, DrawingKind, Measurement } from "./types";

export function identifyDrawings(docs: ParsedDocument[]): DrawingIdentity[] {
  return docs.filter((d) => d.role === "drawings").map((doc) => {
    const text = doc.fullText;
    const drawingNumber = first(text, /\b(?:drawing\s*(?:no\.?|number)|drg\.?\s*no\.?)\s*[:.]?\s*([A-Z0-9][A-Z0-9./-]{2,})/i);
    const revision = first(text, /\b(?:rev(?:ision)?)\s*[:.]?\s*([A-Z0-9]+)\b/i);
    const scale = first(text, /\bscale\s*[:.]?\s*(1\s*:\s*\d+|NTS|as shown)/i);
    const title = first(text, /\b(?:title|drawing title)\s*[:.]?\s*([^\n]{6,80})/i)
      || doc.filename.replace(/\.[a-z0-9]+$/i, "");
    const unit = doc.units[0];
    const source = ref(doc, unit, [drawingNumber, title].filter(Boolean).join(" · ") || doc.filename);
    return {
      documentId: doc.documentId,
      documentName: doc.filename,
      drawingKind: drawingKind(doc.filename, text),
      drawingNumber,
      revision,
      scale,
      title,
      source,
      warnings: [
        ...doc.warnings,
        ...(!drawingNumber ? ["Drawing number is not stated in extractable text."] : []),
        ...(!scale ? ["Scale is not stated. Lengths are used only where the note already gives a true size."] : []),
      ],
    };
  });
}

export function extractMeasurements(docs: ParsedDocument[]): Measurement[] {
  const out: Measurement[] = [];
  let i = 0;
  for (const doc of docs.filter((d) => d.role === "drawings")) {
    for (const unit of doc.units) {
      const patterns: Array<[Measurement["kind"], RegExp]> = [
        ["level", /\b(?:FFL|FGL|NGL|invert level|IL)\s*[=:]?\s*([+-]?\d+(?:\.\d+)?)\s*m\b/i],
        ["diameter", /\b(?:Ø|dia\.?|diameter)\s*[=:]?\s*(\d+(?:\.\d+)?)\s*(mm|m)\b/i],
        ["thickness", /\b(?:thickness|thk)\s*[=:]?\s*(\d+(?:\.\d+)?)\s*(mm|m)\b/i],
        ["depth", /\b(?:depth|deep)\s*[=:]?\s*(\d+(?:\.\d+)?)\s*(mm|m)\b/i],
        ["length", /\b(?:length|long)\s*[=:]?\s*(\d+(?:\.\d+)?)\s*(mm|m)\b/i],
        ["width", /\b(?:width|wide)\s*[=:]?\s*(\d+(?:\.\d+)?)\s*(mm|m)\b/i],
        ["height", /\b(?:height|high)\s*[=:]?\s*(\d+(?:\.\d+)?)\s*(mm|m)\b/i],
        ["count", /\b(\d+)\s*(?:nr|no\.?)\b/i],
      ];
      for (const [kind, re] of patterns) {
        for (const match of unit.text.matchAll(new RegExp(re.source, "gi"))) {
          const rawNum = Number(match[1]);
          if (!Number.isFinite(rawNum)) continue;
          const unitLabel = (match[2] || (kind === "count" ? "nr" : "")).toLowerCase();
          const value = unitLabel === "mm" ? rawNum / 1000 : rawNum;
          i += 1;
          out.push({
            id: `M${String(i).padStart(3, "0")}`,
            kind,
            label: `${kind} from ${doc.filename}`,
            value: kind === "count" ? rawNum : value,
            unit: kind === "count" ? "nr" : "m",
            raw: match[0],
            source: ref(doc, unit, match[0]),
          });
        }
      }
    }
  }
  return out;
}

function drawingKind(filename: string, text: string): DrawingKind {
  const name = filename.toLowerCase();
  if (/general arrangement|\bga[-_ ]/.test(name)) return "general_arrangement";
  if (/piling|foundation|pad footing|\bpad\b/.test(name)) return "foundation";
  if (/reinforcement|\brebar\b/.test(name)) return "reinforcement";
  if (/drain|sewer/.test(name)) return "drainage";
  if (/road|pavement/.test(name)) return "roadworks";
  if (/section|elevation/.test(name)) return "section_elevation";
  if (/detail/.test(name)) return "detail";
  const blob = `${filename} ${text.slice(0, 800)}`.toLowerCase();
  if (/piling|foundation|pad footing|pile/.test(blob)) return "foundation";
  if (/reinforcement|\brc\b|rebar|t\d{2}/.test(blob)) return "reinforcement";
  if (/drain|sewer|pipe/.test(blob)) return "drainage";
  if (/road|pavement|kerb|asphalt/.test(blob)) return "roadworks";
  if (/section|elevation/.test(blob)) return "section_elevation";
  if (/detail/.test(blob)) return "detail";
  if (/architect/.test(blob)) return "architectural";
  if (/structur/.test(blob)) return "structural";
  if (/civil/.test(blob)) return "civil";
  if (/general arrangement|\bga\b/.test(blob)) return "general_arrangement";
  return "other_drawing";
}

function first(text: string, re: RegExp): string | null {
  const match = text.match(re);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function ref(doc: ParsedDocument, unit: ParsedDocument["units"][number] | undefined, quote: string): SourceRef {
  const u = unit ?? { text: quote, page: null, sheet: null, row: null, heading: null };
  return {
    documentId: doc.documentId,
    documentName: doc.filename,
    page: u.page,
    sheet: u.sheet,
    row: u.row,
    heading: u.heading,
    clause: null,
    quote: quote.slice(0, 280),
    locationLabel: locationLabel(u),
  };
}
