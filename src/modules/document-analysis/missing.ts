import type { ExtractedFact, MissingItem, ParsedDocument } from "./types";

const REQUIRED: Array<{ field: string; label: string; whyItMatters: string; related?: string[] }> = [
  { field: "contract_family", label: "Contract type and edition", whyItMatters: "Planning obligations, compensation events and float rules differ by form. The type is left blank unless a document names it." },
  { field: "project_name", label: "Project name", whyItMatters: "Needed to title the baseline and reports." },
  { field: "client", label: "Client / Employer", whyItMatters: "Identifies who issues instructions and accepts the programme." },
  { field: "site", label: "Site location", whyItMatters: "Access, logistics and working-hour assumptions depend on the site." },
  { field: "starting_date", label: "Starting / commencement date", whyItMatters: "The data date of the tender programme." },
  { field: "access_date", label: "Possession / access date", whyItMatters: "Work cannot start on site before possession even if the starting date is earlier." },
  { field: "completion_date", label: "Completion date", whyItMatters: "Sets the finish constraint and delay-damages window." },
  { field: "duration", label: "Stated construction period", whyItMatters: "Used to check the completion date and to size the tender programme." },
  { field: "delay_damages", label: "Delay / liquidated damages", whyItMatters: "Tells the planner the time-risk exposure per day of overrun." },
  { field: "eot_mechanism", label: "Extension of time / compensation event rules", whyItMatters: "Without the mechanism, weather, change and delay cannot be modelled or later claimed." },
  { field: "programme_obligation", label: "Programme submission rules", whyItMatters: "Clause 31 / master programme requirements drive the first baseline deliverable." },
  { field: "working_hours", label: "Working hours / calendar", whyItMatters: "Durations are wrong if the calendar is assumed." },
  { field: "scope_statement", label: "Scope of works", whyItMatters: "Activities cannot be identified without a stated scope." },
  { field: "spec_section", label: "Technical specification sections", whyItMatters: "Method and testing constraints sit in the spec." },
  { field: "boq_item_count", label: "Bill of quantities / activity schedule", whyItMatters: "Quantities are the basis for productivity-based durations." },
  { field: "design_responsibility", label: "Design responsibility", whyItMatters: "Design packages and lead-in sit on the critical path only if someone is named as designer." },
  { field: "retention", label: "Retention", whyItMatters: "Cash-flow and completion obligations; listed because it is often in Contract Data." },
  { field: "defects_date", label: "Defects period", whyItMatters: "Affects sectional completion and aftercare planning." },
];

export function findMissing(docs: ParsedDocument[], facts: ExtractedFact[]): MissingItem[] {
  const have = new Set(facts.map((f) => f.field));
  const roles = new Set(docs.map((d) => d.role));
  const missing: MissingItem[] = [];
  for (const item of REQUIRED) {
    if (have.has(item.field)) continue;
    if (item.field === "boq_item_count" && roles.has("boq")) continue;
    if (item.field === "spec_section" && roles.has("specification") && facts.some((f) => f.category === "scope")) continue;
    missing.push({
      field: item.field,
      label: item.label,
      whyItMatters: item.whyItMatters,
      status: "missing",
    });
  }
  if (!docs.some((d) => d.role === "drawings" || /drawing/i.test(d.filename))) {
    missing.push({
      field: "drawings",
      label: "Drawings / drawing register",
      whyItMatters: "Interfaces, quantities and access cannot be checked without the drawing set.",
      status: "missing",
    });
  }
  return missing;
}
