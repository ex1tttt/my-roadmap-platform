"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  collectDescendantIds,
  dfsOrder,
  inferLinearParents,
  taskDepth,
} from "@/lib/gantt-tree";

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
  /** Человекочитаемый slug для URL редактора (если нет — используется cardId) */
  cardSlug?: string | null;
  tasks: GanttTaskRow[];
  canConfigure: boolean;
};

export default function GanttCardView({ cardId, cardSlug, tasks, canConfigure }: Props) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState<GanttTaskRow[]>(tasks);
  const tasksById = useMemo(() => new Map(localTasks.map((x) => [x.id, x])), [localTasks]);
  const confirmToastRef = useRef<string | number | null>(null);

  const displayRows = useMemo(() => {
    const rows = localTasks.map((x) => ({
      ...x,
      parent_id: x.parent_id ?? null,
      order: x.order ?? 0,
    }));
    return dfsOrder(inferLinearParents(rows));
  }, [localTasks]);

  const displayById = useMemo(() => new Map(displayRows.map((x) => [x.id, x])), [displayRows]);

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

    // optimistic UI
    setLocalTasks((prev) => prev.map((t2) => (t2.id === taskId ? { ...t2, is_done: nextDone } : t2)));

    const { error } = await supabase.from("gantt_tasks").update({ is_done: nextDone }).eq("id", taskId);
    if (error) {
      // rollback
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
  const depthOffset = (depth: number) => Math.min(depth * 56, 224);

  return (
    <div className="space-y-3">
      {displayRows.map((task, idx) => {
        const depth = taskDepth(task.id, displayById);
        const offset = depthOffset(depth);
        const prevTask = idx > 0 ? displayRows[idx - 1]! : null;
        const prevDepth = prevTask ? taskDepth(prevTask.id, displayById) : 0;
        const prevOffset = prevTask ? depthOffset(prevDepth) : 0;
        const lineStart = Math.min(prevOffset, offset) + 24;
        const lineWidth = Math.abs(offset - prevOffset);
        const isDone = !!task.is_done;
        const dateLine =
          task.start_date && task.end_date ? `${task.start_date} — ${task.end_date}` : t("gantt.noDates");

        return (
          <div
            key={task.id}
            className={`relative pt-3 ${openMenuId === task.id ? "z-50" : ""}`}
          >
            {idx > 0 && (
              <>
                <div
                  className="absolute top-0 hidden h-3 border-l border-dashed border-slate-500/40 md:block"
                  style={{ left: `${prevOffset + 24}px` }}
                />
                <div
                  className="absolute top-3 hidden border-t border-dashed border-slate-500/40 md:block"
                  style={{ left: `${lineStart}px`, width: `${lineWidth}px` }}
                />
              </>
            )}
            <article
              className="w-full overflow-visible rounded-md border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 md:w-[min(100%,320px)]"
              style={{ marginLeft: `${offset}px` }}
              id={`gantt-task-${task.id}`}
            >
              <div className="flex min-h-[48px] items-stretch">
                <button
                  type="button"
                  onClick={() => toggleDone(task.id)}
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
                          <button
                            role="menuitem"
                            type="button"
                            className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                            onClick={() => requestDeleteTask(task)}
                          >
                            Delete
                          </button>
                          <Link
                            role="menuitem"
                            href={`/card/${editPathSegment}/edit-gantt#gantt-task-${task.id}`}
                            className="block px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setOpenMenuId(null)}
                          >
                            Settings
                          </Link>
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
          </div>
        );
      })}
    </div>
  );
}
