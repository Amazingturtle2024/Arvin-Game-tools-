"use client";

import { useMemo, useState } from "react";
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
  const [query, setQuery] = useState("");
  const [trade, setTrade] = useState("all");

  const trades = useMemo(() => [...new Set(rates.map((r) => r.trade).filter(Boolean))], [rates]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rates.filter((row) => {
      if (trade !== "all" && row.trade !== trade) return false;
      if (!q) return true;
      return `${row.label} ${row.activity_key} ${row.unit} ${row.notes}`.toLowerCase().includes(q);
    });
  }, [rates, query, trade]);

  function update(variantKey: string, patch: Partial<ProductionRate>) {
    onChange(rates.map((row) => (row.variant_key === variantKey ? { ...row, ...patch } : row)));
  }

  function useForTakeoff(row: ProductionRate) {
    onChange(rates.map((item) => (
      item.activity_key === row.activity_key
        ? { ...item, is_default: item.variant_key === row.variant_key }
        : item
    )));
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
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule px-4 py-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-brass">Productivity database</p>
          <p className="text-sm text-ink/70">
            Loaded from Production Rates MASTER (8-hour shift). Mark one gang per activity as “use for take-off”. Durations stay blank until that rate is a positive number.
          </p>
        </div>
        <button type="button" onClick={() => void save()} className="bg-moss px-3 py-1 text-sm text-paper" disabled={saving}>
          {saving ? "Saving…" : "Save rates"}
        </button>
      </div>
      {error ? <p className="px-4 py-2 text-sm text-stamp">{error}</p> : null}
      <div className="flex flex-wrap gap-2 border-b border-rule px-4 py-2 text-sm">
        <input
          className="field min-w-56 flex-1"
          placeholder="Search excavation, formwork, 300mm pipe…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="field" value={trade} onChange={(e) => setTrade(e.target.value)}>
          <option value="all">All trades</option>
          {trades.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <p className="self-center text-xs text-ink/55">{visible.length} of {rates.length} gangs</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-paper text-[11px] uppercase tracking-wider text-ink/60">
            <tr>
              {["Use", "Trade", "Activity", "Gang / method", "Unit", "Output / day", "Teams", "Workers", "Hours", "Plant"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.variant_key} className={`border-t border-rule ${row.is_default ? "bg-moss/5" : ""}`}>
                <td className="px-3 py-1">
                  <input
                    type="radio"
                    name={`default-${row.activity_key}`}
                    checked={Boolean(row.is_default)}
                    onChange={() => useForTakeoff(row)}
                    title="Use this gang for take-off and the Gantt"
                  />
                </td>
                <td className="px-3 py-1 font-mono text-[11px] text-brass">{row.trade}</td>
                <td className="px-3 py-1 font-mono text-[11px]">{row.activity_key}</td>
                <td className="px-3 py-1">
                  <p>{row.label}</p>
                  {row.notes ? <p className="text-[11px] text-ink/55">{row.notes}</p> : null}
                </td>
                <td className="px-3 py-1 font-mono">{row.unit}</td>
                <Num value={row.rate_per_day} onChange={(n) => update(row.variant_key, { rate_per_day: n })} />
                <Num value={row.teams} onChange={(n) => update(row.variant_key, { teams: n ?? 1 })} />
                <Num value={row.workers} onChange={(n) => update(row.variant_key, { workers: n ?? 1 })} />
                <Num value={row.hours_per_day} onChange={(n) => update(row.variant_key, { hours_per_day: n ?? 8 })} />
                <td className="px-3 py-1">
                  <input
                    className="w-full border-b border-ink/20 bg-transparent py-1 outline-none"
                    value={row.plant}
                    onChange={(e) => update(row.variant_key, { plant: e.target.value })}
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
