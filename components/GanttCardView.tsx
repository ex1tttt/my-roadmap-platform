"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, MoreVertical } from "lucide-react";

export type GanttTaskRow = {
  id: string;
  title: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
  priority?: "low" | "medium" | "high";
};

type Props = {
  cardId: string;
  tasks: GanttTaskRow[];
  canConfigure: boolean;
  /** Used to separate progress per viewer in localStorage */
  viewerKey?: string;
};

function doneStorageKey(cardId: string, viewerKey: string) {
  return `gantt_task_done_${cardId}_${viewerKey}`;
}

export default function GanttCardView({ cardId, tasks, canConfigure, viewerKey = "guest" }: Props) {
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(doneStorageKey(cardId, viewerKey));
      if (raw) setDoneMap(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* ignore */
    }
  }, [cardId, viewerKey]);

  const persistDone = useCallback(
    (next: Record<string, boolean>) => {
      setDoneMap(next);
      try {
        localStorage.setItem(doneStorageKey(cardId, viewerKey), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [cardId, viewerKey]
  );

  const toggleDone = (taskId: string) => {
    persistDone({ ...doneMap, [taskId]: !doneMap[taskId] });
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

  const desktopOffsets = [0, 120, 240, 120];

  return (
    <div className="space-y-3">
      {tasks.map((task, idx) => {
        const offset = desktopOffsets[idx % desktopOffsets.length];
        const prevOffset = idx > 0 ? desktopOffsets[(idx - 1) % desktopOffsets.length] : 0;
        const lineStart = Math.min(prevOffset, offset) + 24;
        const lineWidth = Math.abs(offset - prevOffset);
        const isDone = !!doneMap[task.id];
        const dateLine =
          task.start_date && task.end_date ? `${task.start_date} — ${task.end_date}` : "Без дат";

        return (
          <div key={task.id} className="relative pt-3">
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
              className="w-full overflow-hidden rounded-md border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 md:w-[min(100%,320px)]"
              style={{ marginLeft: `${offset}px` }}
              id={`gantt-task-${task.id}`}
            >
              <div className="flex min-h-[48px] items-stretch">
                <button
                  type="button"
                  onClick={() => toggleDone(task.id)}
                  className="flex w-11 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-100/80 transition-colors hover:bg-slate-200/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  aria-pressed={isDone}
                  aria-label={isDone ? "Отметить как невыполненное" : "Отметить как выполненное"}
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
                        aria-label="Меню задачи"
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
                            href={`/card/${cardId}/edit-gantt#gantt-task-${task.id}`}
                            className="block px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                            onClick={() => setOpenMenuId(null)}
                          >
                            Настроить шаг
                          </Link>
                        </div>
                      )}
                    </>
                  ) : (
                    <span
                      className="flex w-full items-center justify-center text-slate-400/50 dark:text-slate-600"
                      title="Настройка доступна автору или редактору"
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
