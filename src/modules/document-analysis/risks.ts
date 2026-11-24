import type { ExtractedFact, RiskItem } from "./types";

export function findRisks(facts: ExtractedFact[]): RiskItem[] {
  const risks: RiskItem[] = [];
  const weather = facts.filter((f) => f.field === "weather_risk" && /deleted|shall not apply|contractor accepts weather|no compensation event.{0,40}weather/i.test(`${f.value} ${f.source.quote}`));
  if (weather.length > 0) {
    risks.push({
      id: "R-weather",
      title: "Weather risk appears to have been transferred or compensation for weather appears to have been removed",
      category: "time",
      evidence: weather,
      note: "This is only a reading of the quoted wording. It is not legal advice and it is not assumed that weather is a compensation event unless a document says so.",
    });
  }
  const damages = facts.filter((f) => f.field === "delay_damages" || f.field === "penalty");
  if (damages.length > 0) {
    risks.push({
      id: "R-damages",
      title: "Delay damages or penalties are stated in the documents",
      category: "cost",
      evidence: damages,
      note: "The rate is reported only as written. Completing after the stated date would expose the contractor to this figure if the clause applies.",
    });
  }
  const eotDeleted = facts.filter((f) => f.category === "amendments" && /extension of time|compensation event|relevant event/i.test(`${f.value} ${f.source.quote}`) && /deleted|shall not apply/i.test(`${f.value} ${f.source.quote}`));
  if (eotDeleted.length > 0) {
    risks.push({
      id: "R-eot",
      title: "An extension of time or compensation-event provision appears to have been deleted or disapplied",
      category: "contract",
      evidence: eotDeleted,
      note: "Time risk on the programme cannot be assumed to follow the unamended standard form.",
    });
  }
  const design = facts.filter((f) => f.field === "design_responsibility" && /contractor/i.test(f.value));
  if (design.length > 0) {
    risks.push({
      id: "R-design",
      title: "Contractor design is mentioned",
      category: "interface",
      evidence: design,
      note: "Design deliverables and approval periods need to sit on the programme. Lead-in is not invented here.",
    });
  }
  const programme = facts.filter((f) => f.field === "programme_obligation");
  if (programme.length > 0) {
    risks.push({
      id: "R-programme",
      title: "A programme submission obligation is stated",
      category: "records",
      evidence: programme,
      note: "Failure to submit an accepted programme is often a condition precedent to later time entitlement under some forms. That legal effect is not assumed beyond the quoted words.",
    });
  }
  return risks;
}
