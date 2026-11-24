export type PlannerModule = {
  id: string;
  code: string;
  title: string;
  status: "ready" | "planned";
  summary: string;
};

export const PLANNER_MODULES: PlannerModule[] = [
  {
    id: "document-analysis",
    code: "01",
    title: "Tender & Contract Review",
    status: "ready",
    summary: "Read uploaded tender, contract, specification and BOQ files. Extract only what the documents state, with page and clause citations.",
  },
  {
    id: "drawing-planning",
    code: "02",
    title: "Drawings, Quantities & Durations",
    status: "ready",
    summary: "Read drawings, take off quantities with formulas, compare them with the BOQ without changing either figure, apply your production rates, and calculate working-day durations.",
  },
  {
    id: "programme",
    code: "03",
    title: "Programme Generation",
    status: "ready",
    summary: "Build an editable WBS, working calendar, Gantt chart and critical path from Modules 01 and 02. Export Excel, PDF and Microsoft Project 2013 XML.",
  },
  {
    id: "ms-project",
    code: "04",
    title: "MS Project Integration",
    status: "planned",
    summary: "Import and export programmes for Microsoft Project 2013 without losing baseline identity.",
  },
  {
    id: "baseline",
    code: "05",
    title: "Baseline Management",
    status: "planned",
    summary: "Accept, freeze and compare the approved programme.",
  },
  {
    id: "updates",
    code: "06",
    title: "Programme Updates",
    status: "planned",
    summary: "Apply remaining duration from quantities, not elapsed time.",
  },
  {
    id: "delay-analysis",
    code: "07",
    title: "Delay Analysis",
    status: "planned",
    summary: "Track events against the contemporaneous programme.",
  },
  {
    id: "progress-reporting",
    code: "08",
    title: "Progress Reporting",
    status: "planned",
    summary: "Weekly look-aheads and monthly narrative from the live programme.",
  },
];
