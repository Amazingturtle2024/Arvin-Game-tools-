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
    id: "boq-analysis",
    code: "02",
    title: "BOQ Analysis",
    status: "planned",
    summary: "Normalise bill items, quantities and measurement rules for later duration calculations.",
  },
  {
    id: "activity-identification",
    code: "03",
    title: "Activity Identification",
    status: "planned",
    summary: "Turn scope, specs and BOQ into a measurable activity list.",
  },
  {
    id: "durations",
    code: "04",
    title: "Productivity & Durations",
    status: "planned",
    summary: "Convert quantities and crew outputs into activity durations.",
  },
  {
    id: "programme",
    code: "05",
    title: "Programme Generation",
    status: "planned",
    summary: "Build logic, calendars and a critical path from the activity list.",
  },
  {
    id: "ms-project",
    code: "06",
    title: "MS Project Integration",
    status: "planned",
    summary: "Import and export programmes without losing baseline identity.",
  },
  {
    id: "baseline",
    code: "07",
    title: "Baseline Management",
    status: "planned",
    summary: "Accept, freeze and compare the approved programme.",
  },
  {
    id: "updates",
    code: "08",
    title: "Programme Updates",
    status: "planned",
    summary: "Apply remaining duration from quantities, not elapsed time.",
  },
  {
    id: "delay-analysis",
    code: "09",
    title: "Delay Analysis",
    status: "planned",
    summary: "Track events against the contemporaneous programme.",
  },
  {
    id: "progress-reporting",
    code: "10",
    title: "Progress Reporting",
    status: "planned",
    summary: "Weekly look-aheads and monthly narrative from the live programme.",
  },
];
