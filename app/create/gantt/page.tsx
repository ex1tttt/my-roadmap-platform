"use client";

import React, { useState } from "react";
import { categories } from "@/constants/categories";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { useTranslation } from "react-i18next";
import { pushNewGantt } from "@/lib/push-notify";
import { useHasMounted } from "@/hooks/useHasMounted";
import { Lock, Globe, Trash2 } from "lucide-react";
import Toast from "@/components/Toast";
import { checkAndAwardBadges } from "@/lib/badges";
import {
  collectDescendantIds,
  dfsOrder,
  maxSiblingOrder,
  renumberSiblingOrders,
  sortTasksDfs,
  topologicalInsertOrder,
} from "@/lib/gantt-tree";

type GanttTask = {
  id: string;
  parentId: string | null;
  order: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  priority: "low" | "medium" | "high";
  assignee?: string;
};

function newTaskId() {
  return crypto.randomUUID();
}

function eligibleParentTasksCreate(all: GanttTask[], taskId: string): GanttTask[] {
  const forbidden = collectDescendantIds(
    all.map((t) => ({ id: t.id, parent_id: t.parentId })),
    taskId
  );
  forbidden.add(taskId);
  return all.filter((t) => !forbidden.has(t.id));
}

export default function CreateGanttPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { getToken: getRecaptchaToken } = useRecaptcha();
  const mounted = useHasMounted();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tasks, setTasks] = useState<GanttTask[]>([
    {
      id: newTaskId(),
      parentId: null,
      order: 0,
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      priority: "medium",
    },
  ]);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  function addTask() {
    setTasks((prev) => {
      const dfs = dfsOrder(
        prev.map((x) => ({
          id: x.id,
          parent_id: x.parentId,
          order: x.order,
        }))
      );
      const lastId = dfs.length ? dfs[dfs.length - 1]!.id : null;
      const parentId = lastId;
      const nextOrder =
        parentId == null
          ? maxSiblingOrder(
              prev.map((x) => ({ parent_id: x.parentId, order: x.order })),
              null
            ) + 1
          : maxSiblingOrder(
              prev.map((x) => ({ parent_id: x.parentId, order: x.order })),
              parentId
            ) + 1;
      return [
        ...prev,
        {
          id: newTaskId(),
          parentId,
          order: nextOrder,
          title: "",
          description: "",
          startDate: "",
          endDate: "",
          priority: "medium" as const,
        },
      ];
    });
  }

  function removeTask(id: string) {
    setTasks((prev) => {
      if (prev.length <= 1) return prev;
      const flat = prev.map((t) => ({ id: t.id, parent_id: t.parentId }));
      const drop = collectDescendantIds(flat, id);
      drop.add(id);
      return prev.filter((task) => !drop.has(task.id));
    });
  }

  function updateTask(id: string, patch: Partial<GanttTask>) {
    setTasks((t) => t.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const recaptchaToken = await getRecaptchaToken("create");
      if (!recaptchaToken) {
        setToast({
          message: t("auth.recaptchaFailed"),
          type: "error",
        });
        setSaving(false);
        return;
      }

      if (!title.trim()) {
        setToast({ message: t("create.errorTitleRequired"), type: "error" });
        setSaving(false);
        return;
      }

      if (!category) {
        setToast({ message: t("create.errorCategoryRequired"), type: "error" });
        setSaving(false);
        return;
      }

      const normalizedTasks = tasks
        .map((task) => ({
          ...task,
          title: task.title.trim(),
          description: task.description.trim(),
          assignee: task.assignee?.trim() || "",
        }))
        .filter((task) => task.title.length > 0);

      if (normalizedTasks.length === 0) {
        setToast({ message: t("create.errorMinTasks"), type: "error" });
        setSaving(false);
        return;
      }

      const invalidDatesTask = normalizedTasks.find(
        (task) => task.startDate && task.endDate && task.endDate < task.startDate
      );
      if (invalidDatesTask) {
        setToast({
          message: t("create.errorInvalidDates", { title: invalidDatesTask.title }),
          type: "error",
        });
        setSaving(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert(t("edit.errorNotAuth"));
        setSaving(false);
        return;
      }

      const idSet = new Set(normalizedTasks.map((x) => x.id));
      const normalizedSafe = renumberSiblingOrders(
        normalizedTasks.map((task) => ({
          ...task,
          parentId:
            task.parentId && idSet.has(task.parentId) && task.parentId !== task.id
              ? task.parentId
              : null,
        }))
      );
      const rows = normalizedSafe.map((task) => ({
        id: task.id,
        parent_id: task.parentId,
        order: task.order,
        title: task.title,
        description: task.description,
        start_date: task.startDate || null,
        end_date: task.endDate || null,
        priority: task.priority,
        assignee: task.assignee || null,
      }));
      const ordered = topologicalInsertOrder(rows);
      const tasksPayload = ordered.map((task) => ({
        id: task.id,
        parent_id: task.parent_id ?? null,
        order: task.order ?? 0,
        title: task.title,
        description: task.description,
        start_date: task.start_date || null,
        end_date: task.end_date || null,
        priority: task.priority,
        assignee: task.assignee || null,
      }));

      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          description,
          is_private: isPrivate,
          card_type: "gantt",
          tasks: tasksPayload,
          resources: [],
          recaptchaToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create card");
      }

      const cardData = await response.json();
      const cardId = cardData.id;

      await checkAndAwardBadges(user.id, "first_card");

      let followers: any[] | null = null;
      const { data: followersWithBell } = await supabase
        .from("follows")
        .select("follower_id, notify_new_cards")
        .eq("following_id", user.id);
      followers = followersWithBell;

      if (followers && followers.length > 0) {
        const pushIds = followers
          .filter((f: any) => f.notify_new_cards === true)
          .map((f: any) => f.follower_id);
        if (pushIds.length > 0) {
          const push = pushNewGantt(cardId, title);
          fetch("/api/send-push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userIds: pushIds,
              actor_id: user.id,
              notificationType: "new_card",
              ...push,
            }),
          }).catch(() => {});
        }
      }

      setTitle("");
      setDescription("");
      setCategory("");
      setIsPrivate(false);
      setTasks([
        {
          id: newTaskId(),
          parentId: null,
          order: 0,
          title: "",
          description: "",
          startDate: "",
          endDate: "",
          priority: "medium",
        },
      ]);
      setToast({ message: t("createPrivacy.successPublished"), type: "success" });
      setTimeout(() => router.push("/"), 1500);
    } catch (err: any) {
      console.error("[CREATE GANTT] Error:", err);
      setToast({
        message: t("common.error") + ": " + (err?.message ?? err),
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return <div className="opacity-0" />;

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-white">
          {t("create.title")} - {t("create.ganttDiagram")}
        </h1>

        <form onSubmit={handlePublish} className="space-y-6">
          <section className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-md p-6">
            <label className="block">
              <div className="mb-1 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-slate-200">
                <span>{t("create.cardTitle")}</span>
                <span
                  className={`text-xs tabular-nums ${
                    title.length >= 35 ? "text-red-400" : "text-slate-500"
                  }`}
                >
                  {title.length}/40
                </span>
              </div>
              <input
                className="w-full rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={40}
                required
              />
            </label>

            <div className="mt-4">
              <div className="mb-2 text-sm font-medium text-gray-700 dark:text-slate-200">
                {t("create.category")}
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const lang = (i18n.language?.split("-")[0] ?? "en") as
                    | "en"
                    | "ru"
                    | "pl"
                    | "uk";
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`rounded-full px-3 py-1 text-sm transition-colors ${
                        category === cat.id
                          ? "bg-indigo-600 text-white"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-800"
                      }`}
                    >
                      {cat.translations[lang] || cat.translations["en"]}
                    </button>
                  );
                })}
              </div>
              {!category && (
                <p className="mt-1.5 text-xs text-slate-500">
                  {t("create.selectCategory")}
                </p>
              )}
            </div>

            <label className="mt-4 block">
              <div className="mb-1 text-sm font-medium text-gray-700 dark:text-slate-200">
                {t("create.description")}
              </div>
              <textarea
                className="w-full rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            {/* Privacy toggle */}
            <div className="mt-5 flex items-center justify-between rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 px-4 py-3">
              <div className="flex items-center gap-3">
                {isPrivate ? (
                  <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Globe className="h-4 w-4 text-gray-400 dark:text-slate-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                    {t("createPrivacy.privateTitle")}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {t("createPrivacy.privateDesc")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivate((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                  isPrivate ? "bg-blue-600" : "bg-slate-700"
                }`}
                role="switch"
                aria-checked={isPrivate}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isPrivate ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Gantt Tasks Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-800 dark:text-slate-200">
                {t("create.ganttTasks") || "Задачи"}
              </h2>
            </div>

            <div className="space-y-3">
              {tasks.map((task, idx) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900/50 shadow-sm p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">
                      {t("create.taskNumber", { number: idx + 1 })}
                    </span>
                    {tasks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTask(task.id)}
                        className="text-red-600 hover:text-red-800 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-1 text-sm font-medium text-gray-700 dark:text-slate-200">
                        {t("create.taskName")}
                      </div>
                      <input
                        type="text"
                        className="w-full rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={task.title}
                        onChange={(e) => updateTask(task.id, { title: e.target.value })}
                        required
                      />
                    </label>

                    <label className="block">
                      <div className="mb-1 text-sm font-medium text-gray-700 dark:text-slate-200">
                        {t("create.priority")}
                      </div>
                      <select
                        className="w-full rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={task.priority}
                        onChange={(e) =>
                          updateTask(task.id, {
                            priority: e.target.value as "low" | "medium" | "high",
                          })
                        }
                      >
                        <option value="low">{t("create.priorityLow")}</option>
                        <option value="medium">{t("create.priorityMedium")}</option>
                        <option value="high">{t("create.priorityHigh")}</option>
                      </select>
                    </label>

                    <label className="block">
                      <div className="mb-1 text-sm font-medium text-gray-700 dark:text-slate-200">
                        {t("create.startDate")}
                      </div>
                      <input
                        type="date"
                        className="w-full rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={task.startDate}
                        onChange={(e) =>
                          updateTask(task.id, { startDate: e.target.value })
                        }
                      />
                    </label>

                    <label className="block">
                      <div className="mb-1 text-sm font-medium text-gray-700 dark:text-slate-200">
                        {t("create.endDate")}
                      </div>
                      <input
                        type="date"
                        className="w-full rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={task.endDate}
                        onChange={(e) =>
                          updateTask(task.id, { endDate: e.target.value })
                        }
                      />
                    </label>
                  </div>

                  {tasks.length <= 1 ? (
                    <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                      {t("gantt.firstStepNoParent")}
                    </p>
                  ) : (
                    <div className="mt-3">
                      <label className="block">
                        <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {t("gantt.parentStep")}
                        </div>
                        <select
                          key={`${task.id}:${task.parentId ?? ""}`}
                          className="w-full rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={task.parentId ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? null : e.target.value;
                            setTasks((prev) => {
                              const cur = prev.find((x) => x.id === task.id);
                              if (!cur) return prev;
                              if ((cur.parentId ?? null) === v) return prev;
                              const next = prev.map((x) => (x.id === task.id ? { ...x, parentId: v } : x));
                              return sortTasksDfs(renumberSiblingOrders(next));
                            });
                          }}
                        >
                          <option value="">{t("gantt.parentRoot")}</option>
                          {eligibleParentTasksCreate(tasks, task.id).map((p) => (
                            <option key={p.id} value={p.id}>
                              {(p.title?.trim() || t("gantt.untitledStep")).slice(0, 80)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {t("gantt.parentStepHint")}
                      </p>
                    </div>
                  )}

                  <label className="mt-3 block">
                    <div className="mb-1 text-sm font-medium text-gray-700 dark:text-slate-200">
                      {t("create.description")}
                    </div>
                    <textarea
                      className="w-full rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      value={task.description}
                      onChange={(e) =>
                        updateTask(task.id, { description: e.target.value })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addTask}
              className="rounded-md bg-gray-100 dark:bg-slate-800 px-3 py-1 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
            >
              {t("create.addTask") || "Добавить задачу"}
            </button>
          </section>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-gray-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              {t("common.cancel") || "Отмена"}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? t("create.publishing") : t("create.publish")}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
