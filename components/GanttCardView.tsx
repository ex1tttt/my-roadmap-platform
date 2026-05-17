"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { buildChildrenMap, collectDescendantIds, inferLinearParents } from "@/lib/gantt-tree";

export type GanttTaskRow = {
  id: string;
  title: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
  priority?: "low" | "medium" | "high";
  is_done?: boolean;
  parent_id?: string | null;
  order?: number | null;
};

type Props = {
  cardId: string;
  cardSlug?: string | null;
  tasks: GanttTaskRow[];
  canConfigure: boolean;
};

function canStartGanttPan(target: EventTarget | null, viewport: HTMLElement): boolean {
  if (!(target instanceof Element)) return false;
  if (!viewport.contains(target)) return false;
  if (target.closest("button, a, input, select, textarea, [role='menu'], [role='menuitem']")) return false;
  if (target.closest("[data-gantt-card-root], [data-gantt-menu]")) return false;
  return true;
}

/** Прокрутка диаграммы перетаскиванием по пустому месту (как лист на столе). */
function GanttPanViewport({ children, panHint }: { children: ReactNode; panHint: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const panState = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [isPanning, setIsPanning] = useState(false);

  const endPan = useCallback((pointerId?: number) => {
    const el = viewportRef.current;
    const st = panState.current;
    if (!st.active) return;
    if (el && pointerId !== undefined && st.pointerId === pointerId) {
      try {
        el.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
    }
    st.active = false;
    st.pointerId = -1;
    setIsPanning(false);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = viewportRef.current;
    if (!el || !canStartGanttPan(e.target, el)) return;

    panState.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    setIsPanning(true);
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const st = panState.current;
    if (!st.active || e.pointerId !== st.pointerId) return;
    const el = viewportRef.current;
    if (!el) return;
    el.scrollLeft = st.scrollLeft - (e.clientX - st.startX);
    el.scrollTop = st.scrollTop - (e.clientY - st.startY);
    e.preventDefault();
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId === panState.current.pointerId) endPan(e.pointerId);
    },
    [endPan]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId === panState.current.pointerId) endPan(e.pointerId);
    },
    [endPan]
  );

  useEffect(() => {
    const onBlur = () => endPan();
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [endPan]);

  return (
    <div
      ref={viewportRef}
      data-gantt-pan-viewport
      title={panHint}
      className={`gantt-pan-viewport scrollbar-subtle min-h-72 max-h-[min(70vh,36rem)] overflow-x-auto overflow-y-auto overscroll-x-contain overscroll-y-contain p-4 md:min-h-80 md:p-5 ${
        isPanning ? "gantt-pan-active" : ""
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {children}
    </div>
  );
}

/** Вертикальная «шина» только между мостом и центрами карточек детей — без хвостов на всю высоту строк с поддеревьями. При одном ребёнке вертикаль не рисуется. */
function GanttBusConnectorPanel({
  kids,
  kidIds,
  colLayout,
  renderChildRow,
}: {
  kids: GanttTaskRow[];
  kidIds: string;
  colLayout: string;
  renderChildRow: (k: GanttTaskRow) => ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [spine, setSpine] = useState<{ top: number; height: number } | null>(null);
  const showSpine = kids.length >= 2;

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !showSpine) {
      setSpine(null);
      return;
    }

    const measure = () => {
      const h = hostRef.current;
      if (!h) return;
      const hostR = h.getBoundingClientRect();

      const rows = Array.from(
        h.querySelectorAll<HTMLElement>(":scope > .gantt-bus-children-col > .gantt-bus-row")
      );
      const mids: number[] = [];
      for (const row of rows) {
        const card = row.querySelector<HTMLElement>("[data-gantt-card-root]");
        if (!card) continue;
        const r = card.getBoundingClientRect();
        mids.push(r.top + r.height / 2);
      }
      if (mids.length === 0) {
        setSpine(null);
        return;
      }
      const lo = Math.min(...mids);
      const hi = Math.max(...mids);
      /** Только между центрами карточек; центр моста в высокой колонке тянул бы шину «в никуда». */
      const topY = lo;
      const botY = hi;
      const height = Math.max(0, botY - topY);
      setSpine({ top: topY - hostR.top, height: Math.max(height, 2) });
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(host);

    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [showSpine, kidIds]);

  const isBranching = kids.length >= 2;
  const bridgeColClass = isBranching ? "w-6" : "w-3";
  const spineLeftClass = isBranching ? "left-6" : "left-3";
  const childrenPad = isBranching ? "md:pl-1" : "md:pl-0";

  return (
    <div ref={hostRef} className="relative flex w-max shrink-0 min-h-0 flex-col gap-2 md:flex-row md:items-stretch md:gap-0">
      <div className="gantt-dash-h mx-auto w-[min(92vw,20rem)] shrink-0 md:hidden" aria-hidden />

      <div
        className={`gantt-bus-bridge-col hidden shrink-0 self-stretch md:flex md:flex-col md:items-stretch md:justify-center ${bridgeColClass}`}
        aria-hidden
      >
        <div className="gantt-bus-bridge-line gantt-dash-h w-full" aria-hidden />
      </div>

      {showSpine && spine && spine.height > 0 ? (
        <div
          className={`gantt-dash-v pointer-events-none absolute z-0 hidden shrink-0 md:block ${spineLeftClass}`}
          style={{ top: spine.top, height: spine.height }}
          aria-hidden
        />
      ) : null}

      <div className={`gantt-bus-children-col flex w-max shrink-0 min-h-0 flex-col ${childrenPad} ${colLayout}`}>
        {kids.map((k) => (
          <div key={k.id} className="gantt-bus-row flex w-max flex-row items-start">
            {renderChildRow(k)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GanttCardView({ cardId, cardSlug, tasks, canConfigure }: Props) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState<GanttTaskRow[]>(tasks);
  const tasksById = useMemo(() => new Map(localTasks.map((x) => [x.id, x])), [localTasks]);
  const confirmToastRef = useRef<string | number | null>(null);

  const treeRows = useMemo(() => {
    const rows = localTasks.map((x) => ({
      ...x,
      parent_id: x.parent_id ?? null,
      order: x.order ?? 0,
    }));
    return inferLinearParents(rows);
  }, [localTasks]);

  const childrenMap = useMemo(() => buildChildrenMap(treeRows), [treeRows]);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    return () => {
      if (confirmToastRef.current !== null) toast.dismiss(confirmToastRef.current);
    };
  }, [pathname]);

  const toggleDone = async (taskId: string) => {
    const cur = tasksById.get(taskId);
    if (!cur) return;
    const nextDone = !cur.is_done;
    setLocalTasks((prev) => prev.map((t2) => (t2.id === taskId ? { ...t2, is_done: nextDone } : t2)));
    const { error } = await supabase.from("gantt_tasks").update({ is_done: nextDone }).eq("id", taskId);
    if (error) {
      setLocalTasks((prev) => prev.map((t2) => (t2.id === taskId ? { ...t2, is_done: cur.is_done } : t2)));
      alert(t("common.error") + ": " + error.message);
    }
  };

  useEffect(() => {
    if (!openMenuId) return;
    const onDoc = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest(`[data-gantt-menu="${openMenuId}"]`)) setOpenMenuId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openMenuId]);

  const requestDeleteTask = (task: GanttTaskRow) => {
    setOpenMenuId(null);
    const titleLabel = task.title?.trim() ? task.title.trim() : t("gantt.untitledStep");
    const tId = toast(
      <div className="flex w-full flex-col items-center gap-2.5" style={{ maxWidth: 300 }}>
        <span className="block w-full text-center text-[13px] leading-snug text-slate-900 dark:text-white">
          {t("gantt.confirmDelete", { title: titleLabel })}
        </span>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="rounded-md bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
            onClick={async () => {
              toast.dismiss(tId);
              confirmToastRef.current = null;
              const { error } = await supabase.from("gantt_tasks").delete().eq("id", task.id);
              if (error) {
                toast.error(`${t("common.error")}: ${error.message}`);
                return;
              }
              setLocalTasks((prev) => {
                const drop = collectDescendantIds(
                  prev.map((x) => ({ id: x.id, parent_id: x.parent_id ?? null })),
                  task.id
                );
                drop.add(task.id);
                return prev.filter((x) => !drop.has(x.id));
              });
              toast.success(t("gantt.taskDeleted"));
            }}
          >
            {t("actions.delete")}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-slate-100 px-3.5 py-1.5 text-xs font-medium text-slate-800 transition hover:bg-slate-200 dark:border-slate-500/60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={() => {
              toast.dismiss(tId);
              confirmToastRef.current = null;
            }}
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>,
      {
        duration: 12000,
        id: "gantt-delete-confirm",
        position: "top-center",
        closeButton: false,
        style: { padding: "14px 18px", minWidth: 0, width: "auto", maxWidth: 320 },
      }
    );
    confirmToastRef.current = tId;
  };

  const editPathSegment = cardSlug?.trim() || cardId;

  const renderCard = (task: GanttTaskRow): ReactNode => {
    const isDone = !!task.is_done;
    const dateLine =
      task.start_date && task.end_date ? `${task.start_date} — ${task.end_date}` : t("gantt.noDates");

    return (
      <article
        data-gantt-card-root
        className="w-full max-w-[min(100%,20rem)] shrink-0 overflow-visible rounded-md border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5"
        id={`gantt-task-${task.id}`}
      >
        <div className="flex min-h-[48px] items-stretch">
          <button
            type="button"
            onClick={() => void toggleDone(task.id)}
            className="flex w-11 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-100/80 transition-colors hover:bg-slate-200/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            aria-pressed={isDone}
            aria-label={isDone ? t("gantt.markUndone") : t("gantt.markDone")}
          >
            {isDone ? (
              <Check className="h-5 w-5 text-emerald-500" strokeWidth={2.5} />
            ) : (
              <span className="text-lg leading-none text-slate-400 dark:text-slate-500">○</span>
            )}
          </button>

          <div className="min-w-0 flex-1 px-3 py-2">
            <h3
              className={`truncate text-sm font-semibold uppercase tracking-wide ${
                isDone ? "text-slate-500 line-through dark:text-slate-400" : "text-slate-900 dark:text-slate-100"
              }`}
            >
              {task.title}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{dateLine}</p>
            {task.description?.trim() ? (
              <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{task.description}</p>
            ) : null}
          </div>

          <div
            data-gantt-menu={canConfigure ? task.id : undefined}
            className="relative flex w-11 shrink-0 items-stretch border-l border-slate-200 dark:border-white/10"
          >
            {canConfigure ? (
              <>
                <button
                  type="button"
                  onClick={() => setOpenMenuId((id) => (id === task.id ? null : task.id))}
                  className="flex w-full items-center justify-center text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-slate-200"
                  aria-expanded={openMenuId === task.id}
                  aria-haspopup="menu"
                  aria-label={t("gantt.taskMenu")}
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
                {openMenuId === task.id && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-30 mt-1 min-w-44 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-white/10 dark:bg-slate-900"
                  >
                    <Link
                      role="menuitem"
                      href={`/card/${editPathSegment}/edit-gantt?branch=${encodeURIComponent(task.id)}#add-gantt-task`}
                      className="block px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                      onClick={() => setOpenMenuId(null)}
                    >
                      {t("gantt.addBranch")}
                    </Link>
                    <Link
                      role="menuitem"
                      href={`/card/${editPathSegment}/edit-gantt#gantt-task-${task.id}`}
                      className="block px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                      onClick={() => setOpenMenuId(null)}
                    >
                      {t("gantt.taskSettings")}
                    </Link>
                    <button
                      role="menuitem"
                      type="button"
                      className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                      onClick={() => requestDeleteTask(task)}
                    >
                      {t("gantt.deleteTask")}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <span
                className="flex w-full items-center justify-center text-slate-400/50 dark:text-slate-600"
                title={t("gantt.configureHint")}
              >
                <MoreVertical className="h-5 w-5" />
              </span>
            )}
          </div>
        </div>
      </article>
    );
  };

  /** Горизонтальное дерево: карточка слева, дети в колонке справа (как на схеме). */
  function renderNode(task: GanttTaskRow): ReactNode {
    const kids = (childrenMap.get(task.id) ?? []) as GanttTaskRow[];
    const wrapZ = openMenuId === task.id ? "relative z-50" : "relative";

    if (kids.length === 0) {
      return <div className={`shrink-0 ${wrapZ}`}>{renderCard(task)}</div>;
    }

    /** Без min-height / justify-between — иначе вертикальная шина тянется выше/ниже карточек. */
    const colLayout =
      kids.length === 1 ? "gap-y-0 py-0" : "gap-y-5 py-0 md:gap-y-6";

    const kidIds = kids.map((x) => x.id).join("\n");
    const linearOnly = kids.length === 1;

    return (
      <div
        className={`flex w-max shrink-0 max-w-none flex-col md:flex-row md:items-stretch md:gap-0 ${linearOnly ? "gap-1" : "gap-2"}`}
      >
        <div className={`flex shrink-0 items-center md:self-center ${wrapZ}`}>{renderCard(task)}</div>

        <GanttBusConnectorPanel
          kids={kids}
          kidIds={kidIds}
          colLayout={colLayout}
          renderChildRow={(k) => (
            <>
              <div
                className={`hidden shrink-0 self-center md:flex md:flex-col md:items-center md:justify-center ${linearOnly ? "w-3" : "w-5"}`}
                aria-hidden
              >
                <div className="gantt-dash-h w-full" aria-hidden />
              </div>
              <div className="shrink-0">{renderNode(k)}</div>
            </>
          )}
        />
      </div>
    );
  }

  const roots = (childrenMap.get(null) ?? []) as GanttTaskRow[];

  return (
    <GanttPanViewport panHint={t("gantt.panHint")}>
      <div className="flex min-h-64 w-max min-w-full shrink-0 flex-col items-start justify-center gap-8 pb-1 md:min-h-70 md:gap-10">
      {roots.map((r) => (
        <div key={r.id}>{renderNode(r)}</div>
      ))}
      </div>
    </GanttPanViewport>
  );
}
