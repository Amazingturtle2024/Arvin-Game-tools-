import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { extractText, getDocumentProxy } from "unpdf";
import { classifyDocument } from "./classify";
import type { DocumentKind, ParsedDocument, TextUnit } from "./types";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_PAGES = 250;
const MAX_SHEETS = 40;
const MAX_ROWS = 4000;

export { MAX_FILE_BYTES };

export async function parseDocument(input: {
  documentId: string;
  filename: string;
  mime: string;
  bytes: Buffer;
}): Promise<ParsedDocument> {
  const kind = detectKind(input.filename, input.mime, input.bytes);
  const warnings: string[] = [];
  let units: TextUnit[] = [];
  let pageCount: number | null = null;
  let sheetNames: string[] = [];

  if (kind === "unsupported") {
    warnings.push("This file type is not parsed. Upload PDF, Word, Excel, or a drawing image (PNG, JPEG, WebP).");
  } else if (kind === "image") {
    warnings.push("Raster images have no selectable text. Dimensions are not read from pixels unless a model transcription is enabled. They are not used as measured quantities on their own.");
  } else if (kind === "pdf") {
    const pdf = await parsePdf(input.bytes);
    units = pdf.units;
    pageCount = pdf.pageCount;
    warnings.push(...pdf.warnings);
  } else if (kind === "docx") {
    const word = await parseDocx(input.bytes);
    units = word.units;
    warnings.push(...word.warnings);
  } else if (kind === "xlsx") {
    const book = parseXlsx(input.bytes);
    units = book.units;
    sheetNames = book.sheetNames;
    warnings.push(...book.warnings);
  } else if (kind === "txt") {
    units = splitPlain(input.bytes.toString("utf8"));
  }

  const { role, roleReason } = classifyDocument(input.filename, units);
  const fullText = units.map((u) => u.text).join("\n");

  return {
    documentId: input.documentId,
    filename: input.filename,
    mime: input.mime,
    kind,
    role,
    roleReason,
    units,
    fullText,
    warnings,
    pageCount,
    sheetNames,
  };
}

export function detectKind(filename: string, mime: string, bytes: Buffer): DocumentKind {
  const name = filename.toLowerCase();
  const head = bytes.subarray(0, 8).toString("latin1");
  if (head.startsWith("%PDF")) return "pdf";
  if (head.startsWith("\x89PNG") || head.startsWith("\xff\xd8") || mime.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(name)) {
    return "image";
  }
  if (name.endsWith(".txt") || mime.startsWith("text/plain")) return "txt";
  if (head.startsWith("PK")) {
    if (name.endsWith(".docx")) return "docx";
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "xlsx";
    const zipHint = bytes.toString("latin1", 0, Math.min(bytes.length, 4000));
    if (zipHint.includes("word/")) return "docx";
    if (zipHint.includes("xl/")) return "xlsx";
  }
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "xlsx";
  return "unsupported";
}

async function parsePdf(bytes: Buffer): Promise<{ units: TextUnit[]; pageCount: number; warnings: string[] }> {
  const warnings: string[] = [];
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const extracted = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
  const pageCount = pages.length;
  if (pageCount > MAX_PAGES) {
    warnings.push(`Only the first ${MAX_PAGES} of ${pageCount} pages were read.`);
  }
  const units: TextUnit[] = [];
  pages.slice(0, MAX_PAGES).forEach((raw, i) => {
    const pageNo = i + 1;
    const text = normalizeSpace(String(raw || ""));
    if (!text) return;
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) {
      units.push({ text, page: pageNo, sheet: null, row: null, heading: null });
      return;
    }
    lines.forEach((line, li) => {
      units.push({
        text: line,
        page: pageNo,
        sheet: null,
        row: li + 1,
        heading: isHeading(line) ? line.slice(0, 160) : null,
      });
    });
  });
  if (units.length === 0) {
    warnings.push("No extractable text was found. Scanned drawings need OCR before they can be reviewed.");
  }
  return { units, pageCount, warnings };
}

async function parseDocx(bytes: Buffer): Promise<{ units: TextUnit[]; warnings: string[] }> {
  const warnings = [
    "Word files do not have stable printed page numbers. Citations use headings and paragraph numbers, not pages.",
  ];
  const result = await mammoth.extractRawText({ buffer: bytes });
  const paragraphs = result.value.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const units: TextUnit[] = [];
  let heading: string | null = null;
  paragraphs.forEach((text, i) => {
    if (isHeading(text)) heading = text.slice(0, 160);
    units.push({
      text: normalizeSpace(text),
      page: null,
      sheet: null,
      row: i + 1,
      heading,
    });
  });
  if (units.length === 0) warnings.push("The Word file contained no extractable text.");
  return { units, warnings };
}

function parseXlsx(bytes: Buffer): { units: TextUnit[]; sheetNames: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true });
  const sheetNames = workbook.SheetNames.slice(0, MAX_SHEETS);
  if (workbook.SheetNames.length > MAX_SHEETS) {
    warnings.push(`Only the first ${MAX_SHEETS} sheets were read.`);
  }
  const units: TextUnit[] = [];
  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    const limited = rows.slice(0, MAX_ROWS);
    if (rows.length > MAX_ROWS) {
      warnings.push(`Sheet “${name}” was truncated after ${MAX_ROWS} rows.`);
    }
    limited.forEach((row, i) => {
      const cells = (row || []).map((c) => String(c ?? "").trim()).filter(Boolean);
      if (cells.length === 0) return;
      units.push({
        text: cells.join(" | "),
        page: null,
        sheet: name,
        row: i + 1,
        heading: name,
      });
    });
  }
  if (units.length === 0) warnings.push("The spreadsheet contained no readable cells.");
  return { units, sheetNames, warnings };
}

function splitPlain(text: string): TextUnit[] {
  return text.split(/\n+/).map((line, i) => ({
    text: normalizeSpace(line),
    page: null,
    sheet: null,
    row: i + 1,
    heading: null,
  })).filter((u) => u.text.length > 0);
}

function isHeading(text: string): boolean {
  return text.length < 120 && (
    /^(section|clause|part|chapter|schedule|appendix|z\d+)\b/i.test(text)
    || /^[A-Z0-9][A-Z0-9 \-:]{8,}$/.test(text)
  );
}

function normalizeSpace(text: string): string {
  return text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\s+\n/g, "\n").trim();
}

export function locationLabel(unit: Pick<TextUnit, "page" | "sheet" | "row" | "heading">, clause?: string | null): string {
  const parts: string[] = [];
  if (unit.page != null) parts.push(`p.${unit.page}`);
  if (unit.sheet) parts.push(`sheet ${unit.sheet}`);
  if (unit.row != null) parts.push(unit.page != null ? `line ${unit.row}` : `¶ ${unit.row}`);
  if (unit.heading && unit.heading !== unit.sheet) parts.push(unit.heading.slice(0, 80));
  if (clause) parts.push(`cl. ${clause}`);
  return parts.join(" · ") || "location not stated";
}
