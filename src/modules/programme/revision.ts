import type { ConstructionProgramme } from "./types";

export function nextSaveMeta(
  previous: ConstructionProgramme | null,
  incoming: ConstructionProgramme,
): Pick<ConstructionProgramme, "revision" | "status" | "baselineOf"> {
  if (previous?.status === "baseline") {
    return {
      revision: previous.revision + 1,
      status: "draft",
      baselineOf: previous.revision,
    };
  }
  return {
    revision: previous?.revision ?? incoming.revision ?? 1,
    status: incoming.status === "baseline" ? previous?.status ?? "draft" : incoming.status,
    baselineOf: incoming.baselineOf ?? previous?.baselineOf ?? null,
  };
}
