import type { DurationResult, SequenceItem } from "./types";

const ORDER: Array<{ key: string; name: string; after: string[]; concurrent: string[]; why: string }> = [
  { key: "excavation", name: "Excavation", after: [], concurrent: [], why: "Formation has to be opened before pads, trenches or beams can be built." },
  { key: "pipe", name: "Pipe installation", after: ["excavation"], concurrent: ["formwork", "reinforcement"], why: "Pipes go in after trench excavation. They can run beside superstructure work if the trenches are in a separate zone." },
  { key: "formwork", name: "Formwork", after: ["excavation"], concurrent: ["reinforcement"], why: "Shutters and steel can proceed together on the same pour once the formation is ready." },
  { key: "reinforcement", name: "Reinforcement fixing", after: ["excavation"], concurrent: ["formwork"], why: "Fixing proceeds with formwork; the pour waits on both." },
  { key: "concrete", name: "Concrete placement", after: ["formwork", "reinforcement", "excavation"], concurrent: [], why: "Concrete follows a made-ready pour. It is not shown starting before shutters or steel unless those activities are absent from the take-off." },
  { key: "backfill", name: "Backfilling", after: ["concrete", "pipe"], concurrent: ["compaction"], why: "Backfill waits on the thing occupying the excavation — pads or pipes." },
  { key: "compaction", name: "Compaction", after: ["backfill"], concurrent: [], why: "Compaction is the finishing pass on placed fill." },
  { key: "brickwork", name: "Brickwork", after: ["concrete"], concurrent: ["pipe"], why: "Walls sit on the structure. Drainage in other zones can continue." },
  { key: "roadworks", name: "Roadworks", after: ["backfill", "pipe"], concurrent: [], why: "Pavement follows buried services and filled trenches." },
  { key: "gabion", name: "Gabions", after: ["excavation"], concurrent: ["pipe"], why: "Cages can be filled once the formation is prepared, beside other groundworks." },
];

export function buildSequence(durations: DurationResult[]): SequenceItem[] {
  const present = new Set(durations.filter((d) => d.durationWorkingDays != null).map((d) => d.activityKey));
  return ORDER.filter((row) => present.has(row.key)).map((row) => ({
    activityKey: row.key,
    name: row.name,
    predecessors: row.after.filter((k) => present.has(k)),
    concurrentWith: row.concurrent.filter((k) => present.has(k)),
    why: row.why,
  }));
}

export function methodologyNarrative(sequence: SequenceItem[], durations: DurationResult[]): string[] {
  const lines = [
    "Sequence is a planner reading of typical civil / building method. Module 03 turns it into an editable Gantt chart with calendars and a critical path.",
  ];
  for (const item of sequence) {
    const d = durations.find((x) => x.activityKey === item.activityKey);
    const days = d?.durationWorkingDays != null ? `${d.durationWorkingDays} working days` : "duration not calculated";
    const pred = item.predecessors.length ? `follows ${item.predecessors.join(", ")}` : "can start after possession of the relevant area";
    const conc = item.concurrentWith.length ? ` Can run with ${item.concurrentWith.join(", ")} if zones and plant allow.` : "";
    lines.push(`${item.name}: ${days}; ${pred}.${conc} ${item.why}`);
  }
  const longLead = durations.filter((d) => /reinforcement|pipe|brickwork|gabion/.test(d.activityKey));
  if (longLead.length) {
    lines.push("Procurement: reinforcement, pipes, brick and gabion baskets are treated as long-lead until the tender documents say otherwise. No lead-in days have been invented; they must be confirmed before the programme is baselined.");
  }
  return lines;
}
