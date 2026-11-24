import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function buildSampleDrawingPack(): Promise<Array<{ filename: string; mime: string; bytes: Buffer }>> {
  const pages = [
    {
      filename: "A-GA-001 General Arrangement.pdf",
      lines: [
        "DRAWING NO. A-GA-001   REV A   SCALE 1:200",
        "TITLE: General arrangement — Riverside Primary School Extension",
        "This drawing is a general arrangement of the classroom wing, link corridor and playground.",
        "FFL = 12.40 m   NGL = 11.85 m",
        "Facing brickwork: 120 m2 to the classroom wing (this sheet). Remaining brickwork is on architectural elevations not in this pack.",
        "Concrete note: C30/37 to foundations. See structural drawings for sizes.",
      ],
    },
    {
      filename: "S-FDN-101 Foundation Plan.pdf",
      lines: [
        "DRAWING NO. S-FDN-101   REV B   SCALE 1:100",
        "TITLE: Foundation plan — pad footings",
        "Foundation pads: 12 nr 2.5 m x 2.5 m x 0.8 m deep.",
        "Working space 0.5 m each side.",
        "Excavate to 1.0 m below NGL.",
        "Ground beams: 300 mm x 600 mm length 48 m.",
        "Reinforcement density: 120 kg/m3 to ground beams. Pad bar schedule is not on this sheet.",
        "Concrete C30/37.",
      ],
    },
    {
      filename: "C-DRN-201 Drainage Layout.pdf",
      lines: [
        "DRAWING NO. C-DRN-201   REV A   SCALE 1:200",
        "TITLE: Drainage layout — foul and surface water",
        "150 mm dia pipe 210 m.",
        "450 mm dia pipe 40 m.",
        "Trench width 0.6 m depth 1.2 m.",
        "Invert level IL = 10.90 m at MH1.",
        "Gabions: 8 nr 2.0 x 1.0 x 1.0 m at the outfall.",
      ],
    },
    {
      filename: "C-RD-301 Roadworks.pdf",
      lines: [
        "DRAWING NO. C-RD-301   REV A   SCALE 1:200",
        "TITLE: Roadworks — access road wearing course",
        "Carriageway: 85 m long 5.5 m wide 40 mm thick wearing course.",
        "Sub-base quantities are not stated on this sheet.",
      ],
    },
    {
      filename: "S-DET-401 Wall Footing Detail.pdf",
      lines: [
        "DRAWING NO. S-DET-401   REV A   SCALE 1:20",
        "TITLE: Detail — link-corridor wall footing",
        "Wall footing length 18 m width 0.9 m.",
        "Depth not stated on this detail. Do not assume a depth.",
        "Link to S-FDN-101 for pad foundations. This wall footing is additional.",
      ],
    },
  ];
  const files = [];
  for (const page of pages) {
    files.push({
      filename: page.filename,
      mime: "application/pdf",
      bytes: await pdf(page.lines),
    });
  }
  return files;
}

async function pdf(paragraphs: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const sheet = doc.addPage([842, 595]);
  let y = 560;
  paragraphs.forEach((para, i) => {
    sheet.drawText(para, {
      x: 40,
      y,
      size: i === 0 || i === 1 ? 12 : 11,
      font: i < 2 ? bold : font,
      color: rgb(0.05, 0.1, 0.08),
      maxWidth: 760,
    });
    y -= i < 2 ? 22 : 18;
  });
  return Buffer.from(await doc.save());
}
