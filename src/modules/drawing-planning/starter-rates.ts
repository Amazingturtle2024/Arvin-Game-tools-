export const STARTER_RATES = [
  { activity_key: "excavation", label: "Excavation", unit: "m3", rate_per_day: 150, plant: "1 tracked excavator", notes: "Starter rate — edit to site output." },
  { activity_key: "concrete", label: "Concrete placement", unit: "m3", rate_per_day: 40, plant: "pump or skip", notes: "Starter rate — edit to site output." },
  { activity_key: "formwork", label: "Formwork", unit: "m2", rate_per_day: 50, plant: "", notes: "Starter rate — edit to site output." },
  { activity_key: "reinforcement", label: "Reinforcement fixing", unit: "t", rate_per_day: 1.2, plant: "", notes: "Starter rate — edit to site output." },
  { activity_key: "brickwork", label: "Brickwork", unit: "m2", rate_per_day: 25, plant: "", notes: "Starter rate — edit to site output." },
  { activity_key: "pipe", label: "Pipe installation", unit: "m", rate_per_day: 40, plant: "", notes: "Starter rate — edit to site output." },
  { activity_key: "backfill", label: "Backfilling", unit: "m3", rate_per_day: 80, plant: "", notes: "Starter rate — edit to site output." },
  { activity_key: "compaction", label: "Compaction", unit: "m3", rate_per_day: 100, plant: "roller / plate", notes: "Starter rate — edit to site output." },
  { activity_key: "roadworks", label: "Roadworks", unit: "m3", rate_per_day: 80, plant: "", notes: "Starter rate — edit to site output." },
  { activity_key: "gabion", label: "Gabions / Reno mattress", unit: "m3", rate_per_day: 15, plant: "", notes: "Starter rate — edit to site output." },
] as const;
