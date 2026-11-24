"use client";

import { useState } from "react";
import type { ProductionRate } from "@/modules/drawing-planning/types";

export function RatesEditor({
  rates,
  onChange,
}: {
  rates: ProductionRate[];
  onChange: (rates: ProductionRate[]) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(index: number, patch: Partial<ProductionRate>) {
    onChange(rates.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function save() {
    setSaving(true);
    setError("");
    const response = await fetch("/api/rates", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rates }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data.detail || "Could not save rates.");
      return;
    }
    onChange(data.rates);
  }

  return (
    <section className="no-print border border-rule bg-sheet">
      <div className="flex items-baseline justify-between border-b border-rule px-4 py-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-brass">Productivity database</p>
          <p className="text-sm text-ink/70">Starter rates are labelled. Edit them to your gangs before you trust a duration.</p>
        </div>
        <button type="button" onClick={() => void save()} className="bg-moss px-3 py-1 text-sm text-paper" disabled={saving}>
          {saving ? "Saving…" : "Save rates"}
        </button>
      </div>
      {error ? <p className="px-4 py-2 text-sm text-stamp">{error}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-paper text-[11px] uppercase tracking-wider text-ink/60">
            <tr>
              {["Activity", "Unit", "Rate / day", "Teams", "Workers", "Hours", "Days/wk", "Weather %", "Plant"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rates.map((row, i) => (
              <tr key={row.activity_key} className="border-t border-rule">
                <td className="px-3 py-1">{row.label}</td>
                <td className="px-3 py-1 font-mono">{row.unit}</td>
                <Num value={row.rate_per_day} onChange={(n) => update(i, { rate_per_day: n })} />
                <Num value={row.teams} onChange={(n) => update(i, { teams: n ?? 1 })} />
                <Num value={row.workers} onChange={(n) => update(i, { workers: n ?? 1 })} />
                <Num value={row.hours_per_day} onChange={(n) => update(i, { hours_per_day: n ?? 8 })} />
                <Num value={row.days_per_week} onChange={(n) => update(i, { days_per_week: n ?? 5 })} />
                <Num value={row.weather_allowance_pct} onChange={(n) => update(i, { weather_allowance_pct: n ?? 0 })} />
                <td className="px-3 py-1">
                  <input
                    className="w-full border-b border-ink/20 bg-transparent py-1 outline-none"
                    value={row.plant}
                    onChange={(e) => update(i, { plant: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Num({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  return (
    <td className="px-3 py-1">
      <input
        type="number"
        step="any"
        className="w-24 border-b border-ink/20 bg-transparent py-1 outline-none"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </td>
  );
}
