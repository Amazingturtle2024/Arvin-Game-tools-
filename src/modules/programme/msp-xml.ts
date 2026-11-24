import { weekdayFlags } from "./calendar";
import type { ConstructionProgramme, LinkType, ProgrammeActivity } from "./types";
import { depthOf } from "./wbs";

const NS = "http://schemas.microsoft.com/project";
const TYPE: Record<LinkType, number> = { FF: 0, FS: 1, SF: 2, SS: 3 };

export function programmeMspXml(programme: ConstructionProgramme): string {
  const setup = programme.setup;
  const hours = setup.hoursPerDay.value || 8;
  const minutes = Math.round(hours * 60);
  const start = setup.commencementDate.value || programme.activities.find((a) => a.plannedStart)?.plannedStart || "2026-01-01";
  const finish = programme.plannedCompletion || setup.completionDate.value || start;
  const tasks = programme.activities;
  const uid = new Map(tasks.map((a, i) => [a.id, i + 1]));
  const flags = weekdayFlags(setup);

  const taskXml = tasks.map((activity, index) => {
    const isSummary = activity.kind === "summary";
    const outline = depthOf(activity, tasks) + 1;
    const durationDays = activity.durationWorkingDays ?? 0;
    const duration = `PT${Math.round(durationDays * hours)}H0M0S`;
    const links = activity.predecessors
      .map((p) => {
        const pred = uid.get(p.predecessorId);
        if (!pred) return "";
        const lag = Math.round(p.lagWorkingDays * minutes * 10);
        return `<PredecessorLink><PredecessorUID>${pred}</PredecessorUID><Type>${TYPE[p.type]}</Type><LinkLag>${lag}</LinkLag></PredecessorLink>`;
      })
      .join("");
    return `<Task>
      <UID>${uid.get(activity.id)}</UID>
      <ID>${index + 1}</ID>
      <Name>${esc(activity.name)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <WBS>${esc(activity.wbs)}</WBS>
      <OutlineNumber>${esc(activity.wbs)}</OutlineNumber>
      <OutlineLevel>${outline}</OutlineLevel>
      <Priority>500</Priority>
      <Start>${isoDateTime(activity.plannedStart || start)}</Start>
      <Finish>${isoDateTime(activity.plannedFinish || activity.plannedStart || start)}</Finish>
      <Duration>${duration}</Duration>
      <DurationFormat>7</DurationFormat>
      <Milestone>${activity.kind === "milestone" ? 1 : 0}</Milestone>
      <Summary>${isSummary ? 1 : 0}</Summary>
      <Critical>${activity.critical ? 1 : 0}</Critical>
      <ConstraintType>${activity.startConstraint ? 4 : 0}</ConstraintType>
      ${activity.startConstraint ? `<ConstraintDate>${isoDateTime(activity.startConstraint)}</ConstraintDate>` : ""}
      <Notes>${esc(activity.durationFormula)}</Notes>
      ${links}
    </Task>`;
  }).join("\n");

  const weekDays = flags.map((on, day) => `<WeekDay><DayType>${day + 1}</DayType><DayWorking>${on ? 1 : 0}</DayWorking>${on ? `<WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>${endTime(hours)}</ToTime></WorkingTime></WorkingTimes>` : ""}</WeekDay>`).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="${NS}">
  <SaveVersion>14</SaveVersion>
  <Name>${esc(setup.projectName.value || "Programme")}</Name>
  <Title>${esc(setup.projectName.value)}</Title>
  <Company>${esc(setup.mainContractor.value)}</Company>
  <Manager>${esc(setup.consultant.value)}</Manager>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>${isoDateTime(start)}</StartDate>
  <FinishDate>${isoDateTime(finish)}</FinishDate>
  <CalendarUID>1</CalendarUID>
  <MinutesPerDay>${minutes}</MinutesPerDay>
  <MinutesPerWeek>${minutes * flags.filter(Boolean).length}</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Standard</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <BaseCalendarUID>-1</BaseCalendarUID>
      <WeekDays>${weekDays}</WeekDays>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>${esc(setup.projectName.value || "Programme")}</Name>
      <Type>1</Type>
      <OutlineLevel>0</OutlineLevel>
      <Summary>1</Summary>
    </Task>
    ${taskXml}
  </Tasks>
  <Resources></Resources>
  <Assignments></Assignments>
</Project>`;
}

function isoDateTime(day: string): string {
  return `${day}T08:00:00`;
}

function endTime(hours: number): string {
  const mins = Math.round(8 * 60 + hours * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function activityUidMap(activities: ProgrammeActivity[]): Map<string, number> {
  return new Map(activities.map((a, i) => [a.id, i + 1]));
}
