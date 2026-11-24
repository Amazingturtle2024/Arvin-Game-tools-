import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";

export type SampleFile = {
  filename: string;
  mime: string;
  bytes: Buffer;
};

export async function buildSampleTenderPack(): Promise<SampleFile[]> {
  const [contractData, specification, invitation] = await Promise.all([
    pdf("Contract Data — Riverside Primary School Extension.pdf", [
      "CONTRACT DATA — PART ONE",
      "This document completes the contract data for this project. It does not replace unread conditions.",
      "The conditions of contract are the NEC4 Engineering and Construction Contract June 2017 (with January 2023 amendments), Main Option A (Priced contract with activity schedule), and Secondary Options X5, X7, X16.",
      "The project is the Riverside Primary School Extension.",
      "The site is 14 Mill Lane, Bristol, BS1 4AA.",
      "The Client is Bristol City Council.",
      "The Project Manager is Harbour + Field Ltd.",
      "The starting date is 6 April 2026.",
      "The access date is 13 April 2026.",
      "The Completion Date for the whole of the works is 22 October 2027.",
      "The delay damages are £8,500 per day.",
      "The retention is 5%.",
      "The defects date is 52 weeks after Completion.",
      "The assessment interval is four weeks.",
      "The Contractor submits a first programme for acceptance within two weeks of the starting date (clause 31.1).",
      "Works Information: construction of a two-storey classroom wing, associated external works, drainage and incoming services.",
    ]),
    pdf("Specification — Works Information.pdf", [
      "WORKS INFORMATION / TECHNICAL SPECIFICATION",
      "Section A Preliminaries",
      "Working hours are 08:00 to 18:00 Monday to Friday. No Saturday working without the Project Manager's instruction.",
      "The Contractor's design includes the classroom-wing steel connections and the drainage layout below ground, to be submitted for acceptance.",
      "Insurance: the Contractor provides the insurances stated in Contract Data and keeps evidence on site.",
      "Section C Concrete",
      "In-situ concrete to foundations in accordance with BS 8500.",
      "Section F Masonry",
      "Facing brickwork to match the existing school hall.",
      "Section R Drainage",
      "Foul and surface-water drainage connecting to the adopted sewer in Mill Lane.",
      "Scope of the works is the classroom wing, link corridor, playground regrade and incoming services only. The existing hall is occupied and is not in the works.",
    ]),
    pdf("Invitation to Tender.pdf", [
      "INVITATION TO TENDER",
      "Riverside Primary School Extension — tender enquiry",
      "Tenderers are invited to submit a compliant tender by 16 January 2026.",
      "The construction period shall be 78 weeks from the starting date.",
      "Liquidated damages are referred to in the Contract Data.",
      "Drawings will be issued as a separate pack. This invitation does not include the drawing register.",
    ]),
  ]);

  const particular = await docx("Particular Conditions — Z clauses.docx", [
    ["PARTICULAR CONDITIONS", true],
    ["These Z clauses amend the NEC4 Engineering and Construction Contract for this project only.", false],
    ["Z1 Weather: clause 60.1(13) is deleted. The Contractor accepts weather risk.", false],
    ["Z2 Photographs: the Contractor keeps weekly dated site photographs as a contemporaneous record.", false],
    ["Z3 Neighbours: no percussive piling before 09:30 because of the occupied hall.", false],
  ]);

  const boq = xlsx("BOQ — Activity Schedule.xlsx");
  return [contractData, particular, specification, boq, invitation];
}

async function pdf(filename: string, paragraphs: string[]): Promise<SampleFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  let page = doc.addPage([595, 842]);
  let y = 800;
  const size = 11;
  const leading = 16;
  paragraphs.forEach((para, index) => {
    const used = index === 0 ? bold : font;
    const lines = wrap(para, 88);
    for (const line of lines) {
      if (y < 60) {
        page = doc.addPage([595, 842]);
        y = 800;
      }
      page.drawText(line, { x: 50, y, size, font: used, color: rgb(0.1, 0.1, 0.1) });
      y -= leading;
    }
    y -= 8;
  });
  const bytes = Buffer.from(await doc.save());
  return { filename, mime: "application/pdf", bytes };
}

async function docx(filename: string, blocks: Array<[string, boolean]>): Promise<SampleFile> {
  const document = new Document({
    sections: [{
      children: blocks.map(([text, heading]) => new Paragraph({
        heading: heading ? HeadingLevel.HEADING_1 : undefined,
        children: [new TextRun(text)],
        spacing: { after: 240 },
      })),
    }],
  });
  const bytes = Buffer.from(await Packer.toBuffer(document));
  return {
    filename,
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes,
  };
}

function xlsx(filename: string): SampleFile {
  const wb = XLSX.utils.book_new();
  const prelim = [
    ["Bill", "Preliminaries"],
    ["Item", "Description", "Unit", "Qty", "Rate", "Amount"],
    ["A.1", "Site establishment", "sum", 1, 42000, 42000],
    ["A.2", "Temporary works and fencing", "sum", 1, 18500, 18500],
  ];
  const measured = [
    ["Bill", "Measured works"],
    ["Item", "Description", "Unit", "Qty", "Rate", "Amount"],
    ["C.1", "Excavate foundations", "m3", 180, 48, 8640],
    ["C.2", "In-situ concrete foundations", "m3", 95, 165, 15675],
    ["F.1", "Facing brickwork", "m2", 640, 92, 58880],
    ["R.1", "Drainage 150mm", "m", 210, 74, 15540],
    ["", "", "", "", "Grand total", 159235],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prelim), "Preliminaries");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(measured), "Measured works");
  const bytes = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  return {
    filename,
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    bytes,
  };
}

function wrap(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}
