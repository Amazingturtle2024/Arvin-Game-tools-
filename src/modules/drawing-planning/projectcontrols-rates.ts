import type { MasterRate } from "./starter-rates";

const SHIFT = 8;
const SRC = "Quoted from ProjectControls.com Rates, Norms & Durations (member tables). Starting point only — check site conditions. Incomplete workbook cells were not invented.";

function pc(
  family: string,
  label: string,
  unit: string,
  ratePerDay: number,
  notes: string,
  extra: Partial<MasterRate> = {},
): MasterRate {
  const slug = `${label}-${unit}`
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return {
    activity_key: family,
    variant_key: `pc-${slug}`,
    trade: extra.trade ?? `PC · ${family}`,
    label,
    unit,
    rate_per_day: Math.round(ratePerDay * 1000) / 1000,
    workers: extra.workers ?? 1,
    teams: 1,
    plant: extra.plant ?? "",
    notes: `${notes} ${SRC}`,
    is_default: false,
  };
}

function perHour(avePerHour: number): number {
  return avePerHour * SHIFT;
}

/** Ave hrs/tonne → tonnes per 8-hour man-day. */
function tonnesFromHrs(hrsPerTonne: number): number {
  return SHIFT / hrsPerTonne;
}

export const PROJECTCONTROLS_RATES: MasterRate[] = [
  pc("excavation", "Rule of thumb — hydraulic backhoe (Ave)", "m3", 50, "Rule of Thumb table: Ground Excavation, Hydraulic Backhoe Ave 50 m3/day.", { plant: "hydraulic backhoe" }),
  pc("excavation", "Hydraulic excavator 0.4 m³ bucket, sand/soil, bulk (Ave)", "m3", perHour(28.6), "Bulk Excavation table: 0.4 m³ bucket sand/soil Ave 28.6 m3/hr × 8 h.", { plant: "0.4 m3 excavator" }),
  pc("excavation", "Hydraulic excavator 0.4 m³ bucket, sand/soil, trenches (Ave)", "m3", perHour(25), "Ground Excavation table: trenches column, 0.4 m³ bucket sand/soil 25 m3/hr × 8 h.", { plant: "0.4 m3 excavator" }),
  pc("excavation", "Hydraulic excavator 0.4 m³ bucket, sand/soil, small/deep (Ave)", "m3", perHour(10), "Ground Excavation table: small & deep column, 0.4 m³ bucket sand/soil 10 m3/hr × 8 h.", { plant: "0.4 m3 excavator" }),
  pc("excavation", "Hand excavation, trench, sand/soil loose, depth < 1.5 m", "m3", perHour(0.66), "Excavate & Reduce Levels: hand trench sand/soil lose 0.66 m3/hr × 8 h."),
  pc("excavation", "Hand excavation, pits/bases, sand/soil loose, depth < 1.5 m", "m3", perHour(0.5), "Excavate & Reduce Levels: pits or bases ne 2 m2, sand/soil lose 0.50 m3/hr × 8 h."),
  pc("excavation", "Reduce levels, D6 dozer, not exceeding 1 m", "m3", perHour(60), "Excavate & Reduce Levels: D6 dozer not ex 1 m — 60 m3/hr × 8 h.", { plant: "D6 dozer" }),

  pc("compaction", "Vibratory roller, sand", "m2", perHour(31.25), "Compact & Consolidate: sand 31.25 m2/hr × 8 h.", { plant: "vibratory roller" }),
  pc("compaction", "Vibratory roller, soil", "m2", perHour(58.82), "Compact & Consolidate: soil 58.82 m2/hr × 8 h.", { plant: "vibratory roller" }),
  pc("compaction", "Vibratory roller, clay", "m2", perHour(55.56), "Compact & Consolidate: clay 55.56 m2/hr × 8 h.", { plant: "vibratory roller" }),
  pc("compaction", "Hand fill & compact, loose sand/soil, layer < 100 mm", "m3", perHour(0.85), "Hand Fill & Compact: loose sand/soil ne 100 mm 0.85 m3/hr × 8 h."),

  pc("formwork", "Rule of thumb — formwork fixing (Ave)", "m2", 12, "Rule of Thumb table: Formwork Fixing Ave 12 m2/day."),
  pc("formwork", "Pilecaps 0.7–2.5 m² (Ave)", "m2", perHour(2), "Formwork table: Pilecaps 0.7-2.5 m2 Ave 2.0 m2/hr × 8 h."),
  pc("formwork", "Ground beams 0.7–1.5 m² (Ave)", "m2", perHour(1.8), "Formwork table: Ground Beams 0.7-1.5 m2 Ave 1.8 m2/hr × 8 h."),
  pc("formwork", "Ground slabs (Ave)", "m2", perHour(1.5), "Formwork table: Ground Slabs Ave 1.5 m2/hr × 8 h."),
  pc("formwork", "Elevated plain slab soffit (Ave)", "m2", perHour(0.8), "Formwork table: Elevated Plain Slab Soffit Ave 0.8 m2/hr × 8 h."),
  pc("formwork", "Walls, fully framed, 2–5 m (Ave)", "m2", perHour(2.2), "Formwork table: Walls Fully Framed Formwork/Struts 2.0-5.0 m Ave 2.2 m2/hr × 8 h."),
  pc("formwork", "Columns, square timber clamp, CSA 0.1–0.4 m² (Ave)", "m2", perHour(2.1), "Formwork table: Columns Square Sides Timber Clamp/Prop csa 0.1-0.4 m2 Ave 2.1 m2/hr × 8 h."),

  pc("reinforcement", "Rule of thumb — reinforcement fixing (Ave)", "t", 0.7, "Rule of Thumb table: Reinforcement Fixing Ave 0.7 tonnes/day."),
  pc("reinforcement", "Slabs/foundations, 12 mm bar (Ave hrs/t)", "t", tonnesFromHrs(16.3), "Reinforcement table: Slabs/Foundations 12 mm Ave 16.3 hrs/tonne → 8/16.3 t per man-day."),
  pc("reinforcement", "Slabs/foundations, 16 mm bar (Ave hrs/t)", "t", tonnesFromHrs(11.5), "Reinforcement table: Slabs/Foundations 16 mm Ave 11.5 hrs/tonne → 8/11.5 t per man-day."),
  pc("reinforcement", "Slabs/foundations, 20 mm bar (Ave hrs/t)", "t", tonnesFromHrs(8.6), "Reinforcement table: Slabs/Foundations 20 mm Ave 8.6 hrs/tonne → 8/8.6 t per man-day."),
  pc("reinforcement", "Beams/columns, 16 mm bar (Ave hrs/t)", "t", tonnesFromHrs(15.8), "Reinforcement table: Beams/Columns 16 mm Ave 15.8 hrs/tonne → 8/15.8 t per man-day."),
  pc("reinforcement", "Mesh to slabs", "m2", perHour(10.5), "Reinforcement page: mesh to slabs 10.5 m2/hr × 8 h."),
  pc("reinforcement", "Mesh to beams/columns", "m2", perHour(2.5), "Reinforcement page: mesh to beams/columns 2.5 m2/hr × 8 h."),

  pc("concrete", "Rule of thumb — concrete placement (Ave)", "m3", 16, "Rule of Thumb table: Concrete Placement Ave 16 m3/day."),
  pc("concrete", "Lorry-mounted pump (Ave)", "m3", perHour(40), "Place Concrete table: Placing concrete, lorry based pump Ave 40 m3/hr × 8 h.", { plant: "lorry pump" }),
  pc("concrete", "Direct from readymix, ground slab (Ave)", "m3", perHour(2.3), "Place Concrete table: Direct from readymix lorry, ground slab Ave 2.3 m3/hr × 8 h."),
  pc("concrete", "Direct from readymix, pile caps (Ave)", "m3", perHour(1.5), "Place Concrete table: Direct from readymix lorry, pile caps Ave 1.5 m3/hr × 8 h."),
  pc("concrete", "Direct from readymix, 50 mm blinding (Ave)", "m3", perHour(1.3), "Place Concrete table: Direct from readymix lorry, 50 mm blinding Ave 1.3 m3/hr × 8 h."),
  pc("concrete", "Wheelbarrow 1–10 m (Ave)", "m3", perHour(2.3), "Place Concrete table: wheelbarrow 1-10 m Ave 2.3 m3/hr × 8 h."),
  pc("concrete", "Tower crane, slabs over 150 mm (Ave)", "m3", perHour(1.5), "Place Concrete table: tower crane slabs over 150 mm Ave 1.5 m3/hr × 8 h.", { plant: "tower crane" }),
  pc("concrete", "Large pour, 25 m³/hr per pump (stated low)", "m3", perHour(25), "Concrete Pumping page: base slabs 1,200 m3 equalling 25–35 m3/hr per pump. This row uses the stated 25 m3/hr × 8 h.", { plant: "pump" }),
  pc("concrete", "Large pour, 35 m³/hr per pump (stated high)", "m3", perHour(35), "Concrete Pumping page: base slabs 1,200 m3 equalling 25–35 m3/hr per pump. This row uses the stated 35 m3/hr × 8 h.", { plant: "pump" }),

  pc("brickwork", "Rule of thumb — blockwork laying (Ave)", "m2", 7, "Rule of Thumb table: Blockwork Laying Ave 7 m2/day."),
  pc("brickwork", "Rule of thumb — blockwork laying, slower–faster band (Ave)", "m2", 12, "Rule of Thumb table: Blockwork Laying Slow 7 / Ave 12 / Fast 17.5 m2/day. This row is the Ave."),
  pc("brickwork", "Facing brickwork overall", "m2", 25 / 5, "Brickwork page: 25 m2 per man week. Five-day week → 5 m2/man-day."),

  pc("building", "Rule of thumb — plastering and rendering (Ave)", "m2", 12, "Rule of Thumb table: Plastering and Rendering Ave 12 m2/day."),
  pc("building", "Floor screeding (Ave per day table)", "m2", 60, "Rule of Thumb table: Floor Screeding Ave 60 m2/day."),
  pc("building", "Floor screeding (Ave per hour table)", "m2", perHour(4.5), "Rule of Thumb table: Floor Screeding Ave 4.5 m2/hr × 8 h."),
  pc("building", "Ceramic wall tiling (Ave)", "m2", perHour(1.5), "Rule of Thumb table: Ceramic Wall Tiling Ave 1.5 m2/hr × 8 h."),
  pc("building", "Granolithic flooring, 2 layers + labourer", "m2", perHour(3.15), "Granolithic Flooring page: typically 2 layers and a labourer, 3.15 m2/hr × 8 h.", { workers: 3 }),
  pc("building", "Power float finish (Ave)", "m2", perHour(20.8), "Concrete Finishing table: Power Float Ave 20.8 m2/hr × 8 h."),

  pc("pipe", "150 mm uPVC with dig, bed, surround and backfill (comment cap)", "m", 30, "Comment on the Rates, Norms & Durations page (Chris Ellis): drainage table m/hr figures are disputed; 150 mm uPVC with dig/bed/surround/backfill not more than 30–35 m per day. This row uses the stated 30 m/day."),
  pc("pipe", "PVC drainage 100–150 mm, 3 m pipes, runs over 30 m (table Ave)", "m", perHour(18.2), "Drainage, Manholes and Gulleys table: PVC 3 m pipes 100-150 mm dia over 30 m run 18.2 m/hr × 8 h. A comment on the same library says those m/hr figures may exclude dig and backfill."),
  pc("pipe", "Concrete pipes 450 mm, 1.5 m lengths, runs over 30 m", "m", perHour(3.6), "Drainage table: concrete 1.5 m pipes 450 mm dia over 30 m run 3.6 m/hr × 8 h."),
  pc("pipe", "Water supply pipe installation (MEP comment)", "m", 5, "Comment on the Rates, Norms & Durations page (Aravind Govi): plumbing water supply 5 Rm/man/day, inclusive of support fixing."),
  pc("pipe", "Drain pipe installation (MEP comment)", "m", 3, "Comment on the Rates, Norms & Durations page (Aravind Govi): plumbing drain pipe 3 Rm/man/day, inclusive of support fixing."),

  pc("roadworks", "Concrete road surfacing 150 mm thick", "m2", perHour(12.5), "Concrete Road surfacing table: 150 mm thick 12.5 m2/hr × 8 h."),
  pc("roadworks", "Concrete road surfacing 200 mm thick", "m2", perHour(7.7), "Concrete Road surfacing table: 200 mm thick 7.7 m2/hr × 8 h."),
  pc("roadworks", "USA base rate, roadway excavation (8 h day)", "m3", 1529, "Bridge/USA work-activity table: Roadway Excavation metric base rate 1529 m3/day on an 8 hr day. Adjustment factors on that page are not applied."),
  pc("roadworks", "USA base rate, concrete pipe 15 in / ~375 mm", "m", 51, "USA work-activity table: Drainage Conc. Pipe 15 in metric 51 m/day (8 hr day)."),
  pc("roadworks", "USA base rate, concrete pipe 18 in / ~450 mm", "m", 44, "USA work-activity table: Drainage Conc. Pipe 18 in metric 44 m/day (8 hr day)."),

  pc("landscaping", "Chainlink fence, posts at 2.0 m", "m", perHour(4.4), "Fencing Works table: chainlink posts at 2.0 m 4.4 m/hr × 8 h."),
  pc("landscaping", "Site hoarding, timber posts, plywood (Ave)", "m", perHour(1.2), "Fencing Works table: site hoarding Ave 1.2 m/hr × 8 h."),

  pc("building", "Ductwork (MEP comment, stated low)", "m2", 1.2, "Comment (Aravind Govi): duct 1.2–1.5 sqm/man/day inclusive of supports. This row uses the stated 1.2."),
  pc("building", "Ductwork (MEP comment, stated high)", "m2", 1.5, "Comment (Aravind Govi): duct 1.2–1.5 sqm/man/day inclusive of supports. This row uses the stated 1.5."),
  pc("building", "Electrical conduit (MEP comment)", "m", 16, "Comment (Aravind Govi): electrical conduit 16 Rm/man/day."),
  pc("building", "Cable tray (MEP comment, stated low)", "m", 5, "Comment (Aravind Govi): cable tray 5–6 Rm/man/day. This row uses the stated 5."),
  pc("building", "Cable tray (MEP comment, stated high)", "m", 6, "Comment (Aravind Govi): cable tray 5–6 Rm/man/day. This row uses the stated 6."),
];
