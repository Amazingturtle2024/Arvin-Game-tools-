import Link from "next/link";
import { PLANNER_MODULES } from "@/kernel/modules";

export function AppShell({
  children,
  active = "document-analysis",
}: {
  children: React.ReactNode;
  active?: string;
}) {
  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-rule/80 bg-sheet/80">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-6 px-6 py-5">
          <div>
            <p className="text-[11px] tracking-[0.28em] text-moss uppercase">Construction project planning system</p>
            <Link href="/" className="font-serif text-4xl leading-none text-ink">
              Planform
            </Link>
          </div>
          <div className="stamp text-moss">Module 01 · Review</div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[220px_1fr]">
        <aside className="no-print space-y-1">
          <p className="mb-3 text-[11px] tracking-[0.2em] text-brass uppercase">Programme of modules</p>
          {PLANNER_MODULES.map((mod) => {
            const isActive = mod.id === active;
            return (
              <div
                key={mod.id}
                className={`border-l-2 px-3 py-2 ${isActive ? "border-moss bg-sheet" : "border-transparent text-ink/55"}`}
              >
                <p className="font-mono text-[10px] tracking-widest">{mod.code}</p>
                <p className="text-sm leading-tight">{mod.title}</p>
                {mod.status === "planned" ? (
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-brass">Later</p>
                ) : null}
              </div>
            );
          })}
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
