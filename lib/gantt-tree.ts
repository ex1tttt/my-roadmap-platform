/** Gantt tasks as a tree: parent_id null = root; order = sibling order. */

export type GanttTaskFields = {
  id: string;
  parent_id?: string | null;
  order?: number | null;
};

/** DB uses `parent_id`; editor state uses `parentId` — normalize here. */
export type GanttParentSource = GanttTaskFields & { parentId?: string | null };

export function rowParentId(t: { parent_id?: string | null; parentId?: string | null }): string | null {
  const v = t.parent_id ?? t.parentId;
  if (v == null || v === "") return null;
  return v;
}

export function effectiveParentId(t: GanttParentSource): string | null {
  return rowParentId(t);
}

export function buildChildrenMap<T extends GanttParentSource>(tasks: T[]): Map<string | null, T[]> {
  const m = new Map<string | null, T[]>();
  for (const t of tasks) {
    const p = rowParentId(t);
    if (!m.has(p)) m.set(p, []);
    m.get(p)!.push(t);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return m;
}

/** If no task has a parent, treat flat list (sorted by order) as a linear chain (legacy). */
export function inferLinearParents<T extends GanttParentSource>(tasks: T[]): T[] {
  const withPid = tasks.map((t) => ({ ...t, parent_id: rowParentId(t) }));
  const sorted = [...withPid].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const anyParent = sorted.some((t) => t.parent_id != null);
  if (anyParent) return sorted;
  return sorted.map((t, i) => ({
    ...t,
    parent_id: i === 0 ? null : sorted[i - 1]!.id,
  }));
}

export function dfsOrder<T extends GanttParentSource>(tasks: T[]): T[] {
  const normalized = inferLinearParents(tasks);
  const children = buildChildrenMap(normalized);
  const out: T[] = [];
  const seen = new Set<string>();

  function walk(pid: string | null) {
    for (const c of children.get(pid) ?? []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
      walk(c.id);
    }
  }
  walk(null);

  for (const t of normalized) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}

export function taskDepth(id: string, byId: Map<string, { parent_id?: string | null }>): number {
  let d = 0;
  let cur = byId.get(id);
  const guard = new Set<string>();
  while (cur?.parent_id) {
    if (guard.has(cur.parent_id)) break;
    guard.add(cur.parent_id);
    d += 1;
    cur = byId.get(cur.parent_id);
  }
  return d;
}

/** Insert order: every row appears after its parent (for self-FK batch insert). */
export function topologicalInsertOrder<T extends GanttParentSource>(tasks: T[]): T[] {
  const remaining = new Map(
    tasks.map((t) => [t.id, { ...t, parent_id: rowParentId(t) } as T])
  );
  const out: T[] = [];

  while (remaining.size > 0) {
    const ready: T[] = [];
    for (const t of remaining.values()) {
      const pid = rowParentId(t);
      if (pid == null || !remaining.has(pid)) {
        ready.push(t);
      }
    }
    if (ready.length === 0) {
      for (const t of remaining.values()) out.push(t);
      break;
    }
    ready.sort((a, b) => {
      const ap = rowParentId(a) ?? "";
      const bp = rowParentId(b) ?? "";
      if (ap !== bp) return String(ap).localeCompare(String(bp));
      return (a.order ?? 0) - (b.order ?? 0);
    });
    for (const t of ready) {
      out.push(t);
      remaining.delete(t.id);
    }
  }
  return out;
}

export function collectDescendantIds(tasks: { id: string; parent_id?: string | null; parentId?: string | null }[], rootId: string): Set<string> {
  const children = buildChildrenMap(tasks);
  const out = new Set<string>();
  function walk(id: string) {
    for (const c of children.get(id) ?? []) {
      out.add(c.id);
      walk(c.id);
    }
  }
  walk(rootId);
  return out;
}

export function maxSiblingOrder(
  tasks: { parent_id?: string | null; parentId?: string | null; order?: number | null }[],
  parentId: string | null
): number {
  let m = -1;
  const p = parentId ?? null;
  for (const t of tasks) {
    const tp = rowParentId(t);
    if (tp === p) m = Math.max(m, t.order ?? 0);
  }
  return m;
}

/** Within each sibling group (same parent), set order to 0..n-1 by current order. */
export function renumberSiblingOrders<
  T extends { id: string; order?: number | null } & { parent_id?: string | null; parentId?: string | null },
>(tasks: T[]): T[] {
  if (tasks.length === 0) return [];
  const forMap: GanttParentSource[] = tasks.map((t) => ({
    id: t.id,
    parent_id: rowParentId(t),
    order: t.order ?? 0,
  }));
  const m = buildChildrenMap(forMap);
  const orderById = new Map<string, number>();
  for (const [, sibs] of m) {
    sibs.forEach((s, i) => orderById.set(s.id, i));
  }
  return tasks.map((t) => ({ ...t, order: orderById.get(t.id) ?? 0 }));
}

/** Stable DFS order for editor / display; preserves full row objects. */
export function sortTasksDfs<T extends GanttParentSource>(tasks: T[]): T[] {
  if (tasks.length === 0) return [];
  const forTree = tasks.map((t) => ({ ...t, parent_id: rowParentId(t) }));
  const ordered = dfsOrder(forTree);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return ordered.map((o) => byId.get(o.id)).filter((x): x is T => x != null);
}
