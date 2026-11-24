import { locateQuote } from "./extract-facts";
import { locationLabel } from "./parse";
import type { ExtractedFact, ParsedDocument } from "./types";

type ModelClaim = {
  field: string;
  label: string;
  category: ExtractedFact["category"];
  value: string;
  documentName: string;
  quote: string;
  page: number | null;
  sheet: string | null;
  row: number | null;
  clause: string | null;
  layer: ExtractedFact["layer"];
};

export async function enrichWithModel(docs: ParsedDocument[]): Promise<{
  facts: ExtractedFact[];
  discarded: number;
  usedModel: boolean;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (apiKey === "") {
    return { facts: [], discarded: 0, usedModel: false };
  }
  const corpus = docs.map((doc) => {
    const units = doc.units.slice(0, 80).map((u) => {
      const loc = locationLabel(u);
      return `[${loc}] ${u.text.slice(0, 700)}`;
    });
    return `FILE: ${doc.filename}\n${units.join("\n")}`;
  }).join("\n\n").slice(0, 24000);

  const prompt = `You extract facts from construction tender documents.
Rules:
- Use only the text provided.
- Never guess a contract type. If the family is not named, omit it.
- Never invent clauses, dates, rates or parties.
- Every item must include a quote copied from the text.
- Distinguish general conditions from project-specific amendments when the text does.
Return JSON: {"items":[{"field":"string","label":"string","category":"contract_identity|project_details|scope|specifications|boq|time|money|obligations|clauses|amendments|eot|penalties","value":"string","documentName":"string","quote":"string","page":null,"sheet":null,"row":null,"clause":null,"layer":"general_conditions|project_specific|unclear"}]}

TEXT:
${corpus}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a construction contract reviewer who refuses to guess." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) {
      return { facts: [], discarded: 0, usedModel: true };
    }
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { items?: ModelClaim[] };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const facts: ExtractedFact[] = [];
    let discarded = 0;
    let i = 0;
    for (const item of items) {
      if (!item?.quote || !item.value || !item.field) {
        discarded += 1;
        continue;
      }
      const located = locateQuote(item.quote, docs);
      if (!located) {
        discarded += 1;
        continue;
      }
      const { doc, unit } = located;
      const clauseFromQuote = item.clause && item.quote.toLowerCase().includes(String(item.clause).toLowerCase())
        ? item.clause
        : null;
      i += 1;
      facts.push({
        id: `M${String(i).padStart(4, "0")}`,
        field: String(item.field).slice(0, 80),
        label: String(item.label || item.field).slice(0, 120),
        category: item.category || "project_details",
        value: String(item.value).slice(0, 500),
        source: {
          documentId: doc.documentId,
          documentName: doc.filename,
          page: unit.page,
          sheet: unit.sheet,
          row: unit.row,
          heading: unit.heading,
          clause: clauseFromQuote,
          quote: item.quote.slice(0, 400),
          locationLabel: locationLabel(unit, clauseFromQuote),
        },
        layer: item.layer || "unclear",
        verification: "extracted",
        origin: "model_assisted",
      });
    }
    return { facts, discarded, usedModel: true };
  } catch {
    return { facts: [], discarded: 0, usedModel: true };
  }
}
