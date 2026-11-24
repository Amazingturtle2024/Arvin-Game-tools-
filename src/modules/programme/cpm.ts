import type { ActivityLink, LinkType, ProgrammeActivity } from "./types";

type Node = ProgrammeActivity & { es: number; ef: number; ls: number; lf: number; totalFloat: number; freeFloat: number; critical: boolean };

export function runCpm(activities: ProgrammeActivity[]): ProgrammeActivity[] {
  const tasks = activities.filter((a) => a.kind !== "summary");
  const byId = new Map(tasks.map((a) => [a.id, a]));
  const duration = (a: ProgrammeActivity) => Math.max(a.kind === "milestone" ? 0 : a.durationWorkingDays ?? 0, 0);

  const incoming = new Map<string, ActivityLink[]>();
  const outgoing = new Map<string, Array<ActivityLink & { successorId: string }>>();
  for (const task of tasks) {
    incoming.set(task.id, []);
    outgoing.set(task.id, []);
  }
  for (const task of tasks) {
    for (const link of task.predecessors) {
      if (!byId.has(link.predecessorId) || !byId.has(task.id)) continue;
      incoming.get(task.id)!.push(link);
      outgoing.get(link.predecessorId)!.push({ ...link, successorId: task.id });
    }
  }

  const order = topo(tasks.map((t) => t.id), incoming, outgoing);
  if (!order) {
    return activities.map((a) => ({
      ...a,
      es: null, ef: null, ls: null, lf: null, totalFloat: null, freeFloat: null, critical: false,
    }));
  }

  const nodes = new Map<string, Node>();
  for (const id of order) {
    const raw = byId.get(id)!;
    const dur = duration(raw);
    let es = 0;
    if (raw.startConstraint) {
      es = raw.es ?? 0;
    }
    for (const link of incoming.get(id) ?? []) {
      const pred = nodes.get(link.predecessorId);
      if (!pred) continue;
      es = Math.max(es, constraintStart(pred, link, dur));
    }
    const ef = round(es + dur);
    nodes.set(id, { ...raw, es, ef, ls: es, lf: ef, totalFloat: 0, freeFloat: 0, critical: false });
  }

  const projectEnd = Math.max(0, ...[...nodes.values()].map((n) => n.ef));
  for (const id of [...order].reverse()) {
    const node = nodes.get(id)!;
    const succs = outgoing.get(id) ?? [];
    if (succs.length === 0) {
      node.lf = projectEnd;
      node.ls = round(node.lf - duration(node));
    } else {
      let lf = Infinity;
      for (const link of succs) {
        const succ = nodes.get(link.successorId);
        if (!succ) continue;
        lf = Math.min(lf, constraintFinish(node, succ, link));
      }
      node.lf = Number.isFinite(lf) ? lf : projectEnd;
      node.ls = round(node.lf - duration(node));
    }
    node.totalFloat = round(node.ls - node.es);
    let free = node.totalFloat;
    for (const link of succs) {
      const succ = nodes.get(link.successorId);
      if (!succ) continue;
      free = Math.min(free, freeFloat(node, succ, link, duration(succ)));
    }
    node.freeFloat = round(free);
    node.critical = node.totalFloat <= 0.001;
  }

  const computed = new Map(nodes);
  return activities.map((a) => {
    if (a.kind === "summary") {
      const kids = activities.filter((k) => k.parentId === a.id && k.kind !== "summary");
      const childNodes = kids.map((k) => computed.get(k.id)).filter(Boolean) as Node[];
      if (!childNodes.length) return { ...a, es: null, ef: null, ls: null, lf: null, totalFloat: null, freeFloat: null, critical: false };
      const es = Math.min(...childNodes.map((c) => c.es));
      const ef = Math.max(...childNodes.map((c) => c.ef));
      const ls = Math.min(...childNodes.map((c) => c.ls));
      const lf = Math.max(...childNodes.map((c) => c.lf));
      return { ...a, es, ef, ls, lf, totalFloat: round(ls - es), freeFloat: null, critical: childNodes.some((c) => c.critical) };
    }
    const node = computed.get(a.id);
    return node ?? { ...a, es: null, ef: null, ls: null, lf: null, totalFloat: null, freeFloat: null, critical: false };
  });
}

function constraintStart(pred: Node, link: ActivityLink, succDuration: number): number {
  const lag = link.lagWorkingDays;
  switch (link.type as LinkType) {
    case "SS":
      return round(pred.es + lag);
    case "FF":
      return round(pred.ef + lag - succDuration);
    case "SF":
      return round(pred.es + lag - succDuration);
    default:
      return round(pred.ef + lag);
  }
}

function constraintFinish(pred: Node, succ: Node, link: ActivityLink): number {
  const lag = link.lagWorkingDays;
  switch (link.type as LinkType) {
    case "SS":
      return round(succ.ls - lag + (pred.ef - pred.es));
    case "FF":
      return round(succ.lf - lag);
    case "SF":
      return round(succ.lf - lag + (pred.ef - pred.es) - (succ.ef - succ.es));
    default:
      return round(succ.ls - lag);
  }
}

function freeFloat(pred: Node, succ: Node, link: ActivityLink, succDuration: number): number {
  const earliestSucc = constraintStart(pred, { ...link, lagWorkingDays: 0 }, succDuration);
  const needed = constraintStart(pred, link, succDuration);
  return round(succ.es - needed + (needed - earliestSucc));
}

function topo(
  ids: string[],
  incoming: Map<string, ActivityLink[]>,
  outgoing: Map<string, Array<ActivityLink & { successorId: string }>>,
): string[] | null {
  const remaining = new Map(ids.map((id) => [id, (incoming.get(id) ?? []).filter((l) => ids.includes(l.predecessorId)).length]));
  const queue = ids.filter((id) => remaining.get(id) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const link of outgoing.get(id) ?? []) {
      const next = remaining.get(link.successorId);
      if (next == null) continue;
      remaining.set(link.successorId, next - 1);
      if (next - 1 === 0) queue.push(link.successorId);
    }
  }
  return order.length === ids.length ? order : null;
}

export function hasCycle(activities: ProgrammeActivity[]): boolean {
  const tasks = activities.filter((a) => a.kind !== "summary");
  const incoming = new Map<string, ActivityLink[]>();
  const outgoing = new Map<string, Array<ActivityLink & { successorId: string }>>();
  for (const task of tasks) {
    incoming.set(task.id, []);
    outgoing.set(task.id, []);
  }
  for (const task of tasks) {
    for (const link of task.predecessors) {
      incoming.get(task.id)?.push(link);
      outgoing.get(link.predecessorId)?.push({ ...link, successorId: task.id });
    }
  }
  return topo(tasks.map((t) => t.id), incoming, outgoing) == null;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
