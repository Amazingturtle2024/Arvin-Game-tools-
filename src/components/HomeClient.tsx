"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  status: string;
  updated_at: string;
};

export function HomeClient() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState<{ name: string; simulated?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const me = await fetch("/api/me").then((r) => r.json());
    if (!me.signedIn) {
      setError("This desk is signed-in only. Open it from Cursor as a private or team app.");
      return;
    }
    setViewer({ name: me.name, simulated: me.simulated });
    const data = await fetch("/api/projects").then((r) => r.json());
    setProjects(data.projects ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name || "Untitled review" }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.detail || data.error || "Could not create the review.");
      return;
    }
    router.push(`/projects/${data.project.id}`);
  }

  return (
    <div className="space-y-8">
      <section className="border border-rule bg-sheet p-6 shadow-[6px_6px_0_rgba(28,42,36,0.08)]">
        <p className="font-mono text-xs tracking-[0.18em] text-brass uppercase">Before the programme</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight">Tender &amp; Contract Review</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink/80">
          Upload the tender pack, conditions, specifications and bills. Planform reads only what those files say,
          cites the page or clause, and leaves blank what they do not state. It will not guess a contract form.
        </p>
        {viewer ? (
          <p className="mt-4 text-xs text-ink/60">
            Desk for {viewer.name}
            {viewer.simulated ? " · local simulated viewer, not a live sign-in" : ""}
          </p>
        ) : null}
      </section>

      <form onSubmit={create} className="flex flex-col gap-3 border border-dashed border-moss/40 bg-sheet/60 p-5 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="block text-[11px] tracking-widest uppercase text-moss">Project name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Riverside Primary School Extension"
            className="mt-1 w-full border-b border-ink/30 bg-transparent py-2 outline-none focus:border-moss"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="bg-moss px-5 py-2 text-sm text-paper disabled:opacity-60"
        >
          {busy ? "Opening…" : "Open a new review"}
        </button>
      </form>

      {error ? <p className="text-sm text-stamp">{error}</p> : null}

      <section>
        <h2 className="mb-3 font-serif text-2xl">Open reviews</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-ink/60">No reviews yet. Open one, then load a sample pack or your own files.</p>
        ) : (
          <ul className="divide-y divide-rule border border-rule bg-sheet">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  className="flex w-full items-baseline justify-between px-4 py-3 text-left hover:bg-paper"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <span>{project.name}</span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink/50">{project.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
