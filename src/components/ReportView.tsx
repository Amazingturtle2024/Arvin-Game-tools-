"use client";

import { useState } from "react";
import { EmptyNote, FactCard } from "./FactCard";
import type { TenderReviewReport } from "@/modules/document-analysis/types";

const TABS = [
  "Overview",
  "Contract",
  "Time & money",
  "Scope",
  "BOQ",
  "Clauses",
  "Gaps",
  "Risks",
] as const;

type Tab = (typeof TABS)[number];

export function ReportView({ report }: { report: TenderReviewReport }) {
  const [tab, setTab] = useState<Tab>("Overview");
  return (
    <div className="print-sheet space-y-6 border border-rule bg-sheet p-6 shadow-[8px_8px_0_rgba(28,42,36,0.08)]">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-brass">Tender and contract review report</p>
          <h2 className="font-serif text-3xl">{report.projectName}</h2>
          <p className="mt-1 text-xs text-ink/60">
            Generated {new Date(report.generatedAt).toLocaleString()} · {report.documents.length} file
            {report.documents.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <button className="border border-ink/30 px-3 py-1 text-sm" onClick={() => window.print()}>Print</button>
          <button className="border border-ink/30 px-3 py-1 text-sm" onClick={() => downloadJson(report)}>Export JSON</button>
        </div>
      </header>
      <ContractBanner report={report} />
      <div className="no-print sticky top-0 z-10 mb-4 flex flex-wrap gap-1 border-b border-rule bg-sheet">
        {TABS.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-3 py-2 text-sm ${tab === item ? "border-b-2 border-moss font-medium" : "text-ink/55"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <Panel show={tab === "Overview"}>
        <h3 className="font-serif text-xl">How this report was made</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
          {report.methodology.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <h3 className="font-serif text-xl">Files read</h3>
        <ul className="divide-y divide-rule border border-rule">
          {report.documents.map((doc) => (
            <li key={doc.documentId} className="px-3 py-2 text-sm">
              <span className="font-medium">{doc.filename}</span>
              <span className="citation ml-2">{roleLabel(doc.role)}{doc.pageCount ? ` · ${doc.pageCount} pp` : ""}</span>
              <p className="text-ink/60">{doc.roleReason}</p>
              {doc.warnings.map((w) => <p key={w} className="text-xs text-stamp">{w}</p>)}
            </li>
          ))}
        </ul>
        <Counts report={report} />
      </Panel>
      <Panel show={tab === "Contract"}>
        <h3 className="font-serif text-xl">Contract identity</h3>
        {report.contract.facts.length === 0 ? <EmptyNote>No contract family is named in the files.</EmptyNote> : report.contract.facts.map((f) => <FactCard key={f.id} fact={f} />)}
        <h3 className="mt-6 font-serif text-xl">Project details</h3>
        {report.projectDetails.length === 0 ? <EmptyNote>No project particulars were extracted.</EmptyNote> : report.projectDetails.map((f) => <FactCard key={f.id} fact={f} />)}
      </Panel>
      <Panel show={tab === "Time & money"}>
        <h3 className="font-serif text-xl">Time</h3>
        {report.timeProvisions.length === 0 ? <EmptyNote>No dates or periods were found.</EmptyNote> : report.timeProvisions.map((f) => <FactCard key={f.id} fact={f} />)}
        <h3 className="mt-6 font-serif text-xl">Money</h3>
        {report.money.length === 0 ? <EmptyNote>No retention or payment wording was found.</EmptyNote> : report.money.map((f) => <FactCard key={f.id} fact={f} />)}
        <h3 className="mt-6 font-serif text-xl">Delay damages and penalties</h3>
        {report.penalties.length === 0 ? <EmptyNote>No delay damages or penalties were found. That does not mean none exist in unread pages or drawings.</EmptyNote> : report.penalties.map((f) => <FactCard key={f.id} fact={f} />)}
        <h3 className="mt-6 font-serif text-xl">Extension of time / compensation events</h3>
        {report.eot.length === 0 ? <EmptyNote>No extension of time or compensation-event wording was found.</EmptyNote> : report.eot.map((f) => <FactCard key={f.id} fact={f} />)}
        <h3 className="mt-6 font-serif text-xl">Obligations</h3>
        {report.obligations.length === 0 ? <EmptyNote>No programme, insurance, design or dispute wording was extracted.</EmptyNote> : report.obligations.map((f) => <FactCard key={f.id} fact={f} />)}
      </Panel>
      <Panel show={tab === "Scope"}>
        <h3 className="font-serif text-xl">Scope of works</h3>
        {report.scopeOfWorks.length === 0 ? <EmptyNote>No scope statement was extracted.</EmptyNote> : report.scopeOfWorks.map((f) => <FactCard key={f.id} fact={f} />)}
        <h3 className="mt-6 font-serif text-xl">Specification sections</h3>
        {report.specifications.length === 0 ? <EmptyNote>No specification headings were extracted.</EmptyNote> : report.specifications.map((f) => <FactCard key={f.id} fact={f} />)}
      </Panel>
      <Panel show={tab === "BOQ"}>
        <h3 className="font-serif text-xl">Bill of quantities</h3>
        {!report.boq.found ? (
          <EmptyNote>{report.boq.notes[0] || "No bill was identified."}</EmptyNote>
        ) : (
          <div className="text-sm leading-relaxed">
            <p>Sheets counted: {report.boq.sheetCount || "not counted as sheets"}</p>
            <p>Item-like rows counted: {report.boq.itemCount ?? "not counted"}</p>
            {report.boq.sections.length > 0 ? <p>Sections: {report.boq.sections.join("; ")}</p> : null}
            {report.boq.totals.map((t) => (
              <p key={t.value}>{t.label}: {t.value}<span className="citation ml-2">{t.source.documentName} · {t.source.locationLabel}</span></p>
            ))}
          </div>
        )}
      </Panel>
      <Panel show={tab === "Clauses"}>
        <h3 className="font-serif text-xl">Project-specific amendments</h3>
        {report.amendments.length === 0 ? <EmptyNote>No Z clauses or “deleted / replaced” wording was extracted.</EmptyNote> : report.amendments.map((f) => <FactCard key={f.id} fact={f} />)}
        <h3 className="mt-6 font-serif text-xl">Other clause references</h3>
        {report.clauses.length === 0 ? <EmptyNote>No additional clause citations were extracted.</EmptyNote> : report.clauses.map((f) => <FactCard key={f.id} fact={f} />)}
      </Panel>
      <Panel show={tab === "Gaps"}>
        <h3 className="font-serif text-xl">Conflicts</h3>
        {report.conflicts.length === 0 ? (
          <EmptyNote>No contradictory statements were matched on the compared fields.</EmptyNote>
        ) : report.conflicts.map((conflict) => (
          <div key={conflict.field} className="border border-stamp/40 bg-stamp/5 p-3">
            <p className="font-medium">{conflict.label}</p>
            <p className="text-sm text-ink/70">{conflict.note}</p>
            {conflict.facts.map((f) => <FactCard key={f.id} fact={f} />)}
          </div>
        ))}
        <h3 className="mt-4 font-serif text-xl">Missing information</h3>
        {report.missingInformation.length === 0 ? (
          <EmptyNote>The planner checklist items that this module looks for were all present in some form.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {report.missingInformation.map((item) => (
              <li key={item.field} className="border-l-2 border-flag pl-3">
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-ink/70">{item.whyItMatters}</p>
              </li>
            ))}
          </ul>
        )}
        {report.discardedUncitedModelClaims > 0 ? (
          <p className="text-sm text-ink/60">
            {report.discardedUncitedModelClaims} model suggestion{report.discardedUncitedModelClaims === 1 ? "" : "s"} discarded because the quote was not found in the files.
          </p>
        ) : null}
      </Panel>
      <Panel show={tab === "Risks"}>
        <h3 className="font-serif text-xl">Risks taken from the wording</h3>
        {report.risks.length === 0 ? (
          <EmptyNote>No risk wording was strong enough to list. Absence of a list is not a clean bill of health.</EmptyNote>
        ) : report.risks.map((risk) => (
          <div key={risk.id} className="border border-ink/15 p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-stamp">{risk.category}</p>
            <p className="font-medium">{risk.title}</p>
            <p className="text-sm text-ink/70">{risk.note}</p>
            {risk.evidence.map((f) => <FactCard key={f.id} fact={f} />)}
          </div>
        ))}
      </Panel>
    </div>
  );
}

function Panel({ show, children }: { show: boolean; children: React.ReactNode }) {
  return <section className={show ? "space-y-3" : "hidden print:block print:space-y-3 print:mt-8"}>{children}</section>;
}

function ContractBanner({ report }: { report: TenderReviewReport }) {
  const { contract } = report;
  const tone =
    contract.status === "identified"
      ? "border-ok text-ok"
      : contract.status === "conflicting"
        ? "border-stamp text-stamp"
        : "border-flag text-ink";
  return (
    <div className={`border-2 px-4 py-3 ${tone}`}>
      <p className="font-mono text-[10px] tracking-[0.18em] uppercase">Contract type</p>
      <p className="font-serif text-2xl">
        {contract.status === "identified" && contract.family
          ? `${contract.family}${contract.edition ? ` · ${contract.edition}` : ""}${contract.option ? ` · ${contract.option}` : ""}`
          : contract.status === "conflicting"
            ? "Not selected — files name more than one family"
            : "Not stated in the uploaded files"}
      </p>
      <p className="mt-1 text-sm text-ink/80">{contract.note}</p>
    </div>
  );
}

function Counts({ report }: { report: TenderReviewReport }) {
  const items = [
    ["Conflicts", report.conflicts.length],
    ["Missing items", report.missingInformation.length],
    ["Risks from wording", report.risks.length],
    ["Amendments", report.amendments.length],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([label, n]) => (
        <div key={label} className="border border-rule p-3">
          <p className="font-serif text-3xl">{n}</p>
          <p className="text-[11px] uppercase tracking-wider text-ink/55">{label}</p>
        </div>
      ))}
    </div>
  );
}

function roleLabel(role: string): string {
  return role.replace(/_/g, " ");
}

function downloadJson(report: TenderReviewReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.projectName.replace(/\s+/g, "-").toLowerCase()}-tender-review.json`;
  a.click();
  URL.revokeObjectURL(url);
}
