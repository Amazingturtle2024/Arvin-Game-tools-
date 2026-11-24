import type { ExtractedFact } from "@/modules/document-analysis/types";

export function FactCard({ fact }: { fact: ExtractedFact }) {
  return (
    <article className="border-b border-rule/70 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{fact.label}</h3>
        <span className="citation">
          {fact.source.documentName} · {fact.source.locationLabel}
          {fact.origin === "model_assisted" ? " · model, quote-checked" : ""}
        </span>
      </div>
      <p className="mt-1 text-[15px] leading-snug">{fact.value}</p>
      <blockquote className="mt-2 border-l-2 border-brass pl-3 text-sm italic text-ink/75">
        “{fact.source.quote}”
      </blockquote>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-ink/45">
        {layerLabel(fact.layer)}
        {fact.source.clause ? ` · clause ${fact.source.clause}` : ""}
      </p>
    </article>
  );
}

function layerLabel(layer: ExtractedFact["layer"]): string {
  if (layer === "general_conditions") return "General conditions";
  if (layer === "project_specific") return "Project-specific";
  return "Layer not clear from the wording";
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-ink/55">{children}</p>;
}
