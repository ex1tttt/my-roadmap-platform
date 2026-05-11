"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isUUID } from "@/lib/slug";
import { categories } from "@/constants/categories";
import { useTranslation } from "react-i18next";
import { useHasMounted } from "@/hooks/useHasMounted";
import { ArrowLeft, Globe, Lock, Save, Trash2 } from "lucide-react";
import {
  collectDescendantIds,
  dfsOrder,
  inferLinearParents,
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

const INPUT_CLS =
  "w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40";

/** Tasks that can be this row's parent (no self, no descendant — avoids cycles). */
function eligibleParentTasks(all: GanttTask[], taskId: string): GanttTask[] {
  const forbidden = collectDescendantIds(
    all.map((t) => ({ id: t.id, parent_id: t.parentId })),
    taskId
  );
  forbidden.add(taskId);
  return all.filter((t) => !forbidden.has(t.id));
}

export default function EditGanttPage() {
  const params = useParams();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : (rawSlug ?? "");
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const mounted = useHasMounted();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [cardId, setCardId] = useState("");
  const [isOwner, setIsOwner] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  /** Shown after opening editor via «ветка» from карточки — имя родительского шага */
  const [branchHintParentTitle, setBranchHintParentTitle] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    if (!hash) return;
    const id = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => clearTimeout(id);
  }, [loading]);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const branchPendingKey = `gantt-branch:${slug}`;
      const clearBranchPending = () => {
        if (typeof window !== "undefined") sessionStorage.removeItem(branchPendingKey);
      };

      let pendingBranchId: string | null = null;
      if (typeof window !== "undefined") {
        const u = new URL(window.location.href);
        const fromUrl = u.searchParams.get("branch");
        if (fromUrl) {
          sessionStorage.setItem(branchPendingKey, fromUrl);
          u.searchParams.delete("branch");
          window.history.replaceState({}, "", `${u.pathname}${u.search}${u.hash}`);
        }
        pendingBranchId = sessionStorage.getItem(branchPendingKey);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        clearBranchPending();
        router.replace("/login");
        return;
      }

      const isOldFormat = isUUID(slug);
      const cardQuery = isOldFormat
        ? supabase.from("cards").select("*, gantt_tasks(*)").eq("id", slug).maybeSingle()
        : supabase.from("cards").select("*, gantt_tasks(*)").eq("slug", slug).maybeSingle();

      let { data: card, error } = await cardQuery;
      if (error && !isOldFormat) {
        const fallback = await supabase.from("cards").select("*, gantt_tasks(*)").eq("id", slug).maybeSingle();
        card = fallback.data;
        error = fallback.error;
      }

      if (error || !card) {
        clearBranchPending();
        setLoading(false);
        return;
      }
      if (card.card_type !== "gantt") {
        clearBranchPending();
        router.replace(`/card/${card.id}/edit`);
        return;
      }

      setCardId(card.id);
      if (card.user_id === user.id) {
        setIsOwner(true);
      } else {
        if (!user.email) {
          clearBranchPending();
          setForbidden(true);
          setLoading(false);
          return;
        }
        const { data: collabRow } = await supabase
          .from("card_collaborators")
          .select("id, role")
          .eq("card_id", card.id)
          .eq("user_email", user.email)
          .maybeSingle();
        if (!collabRow || collabRow.role !== "editor") {
          clearBranchPending();
          setForbidden(true);
          setLoading(false);
          return;
        }
      }

      setTitle(card.title ?? "");
      setDescription(card.description ?? "");
      setCategory(card.category ?? "");
      setIsPrivate(card.is_private === true);
      const sortedRaw = (card.gantt_tasks ?? [])
        .slice()
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      const mappedFromDb: GanttTask[] = sortedRaw.map((task: any) => ({
        id: task.id ?? newTaskId(),
        parentId:
          task.parent_id != null && task.parent_id !== "" ? String(task.parent_id) : null,
        order: task.order ?? 0,
        title: task.title ?? "",
        description: task.description ?? "",
        startDate: task.start_date ?? "",
        endDate: task.end_date ?? "",
        priority: (task.priority ?? "medium") as "low" | "medium" | "high",
        assignee: task.assignee ?? "",
      }));
      const idSet = new Set(mappedFromDb.map((t) => t.id));
      const withValidParent = mappedFromDb.map((t) => ({
        ...t,
        parentId:
          t.parentId && idSet.has(t.parentId) && t.parentId !== t.id ? t.parentId : null,
      }));
      const allParentsEmpty = withValidParent.length > 0 && withValidParent.every((t) => t.parentId == null);
      let mapped: GanttTask[];
      if (allParentsEmpty) {
        const inferred = inferLinearParents(
          withValidParent.map((t) => ({
            id: t.id,
            parent_id: null as string | null,
            order: t.order,
          }))
        );
        const infById = new Map(inferred.map((x) => [x.id, x]));
        mapped = withValidParent.map((base) => {
          const inf = infById.get(base.id)!;
          return {
            ...base,
            parentId: inf.parent_id ?? null,
            order: inf.order ?? base.order,
          };
        });
      } else {
        mapped = withValidParent;
      }

      let nextTasks: GanttTask[] =
        mapped.length > 0
          ? mapped
          : [
              {
                id: newTaskId(),
                parentId: null,
                order: 0,
                title: "",
                description: "",
                startDate: "",
                endDate: "",
                priority: "medium",
                assignee: "",
              },
            ];

      let branchHintTitle: string | null = null;
      let newBranchTaskId: string | null = null;
      if (pendingBranchId) {
        const parentRow = nextTasks.find((t) => t.id === pendingBranchId);
        if (parentRow) {
          // Новая ветка — первый среди детей (order 0), чтобы в списке шла сразу под родителем, а не после всей старой цепочки.
          nextTasks = nextTasks.map((t) =>
            t.parentId === pendingBranchId ? { ...t, order: (t.order ?? 0) + 1 } : t
          );
          newBranchTaskId = newTaskId();
          nextTasks = [
            ...nextTasks,
            {
              id: newBranchTaskId,
              parentId: pendingBranchId,
              order: 0,
              title: "",
              description: "",
              startDate: "",
              endDate: "",
              priority: "medium" as const,
              assignee: "",
            },
          ];
          branchHintTitle = parentRow.title?.trim() || null;
        }
        clearBranchPending();
      }

      setTasks(sortTasksDfs(nextTasks));
      setBranchHintParentTitle(branchHintTitle);
      setLoading(false);

      if (newBranchTaskId && typeof window !== "undefined") {
        window.setTimeout(() => {
          document.getElementById(`gantt-task-${newBranchTaskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);
      }
    };
    load();
  }, [slug, router]);

  function addTask() {
    setBranchHintParentTitle(null);
    setTasks((prev) => {
      const dfs = dfsOrder(
        prev.map((t) => ({
          id: t.id,
          parent_id: t.parentId,
          order: t.order,
        }))
      );
      const lastId = dfs.length ? dfs[dfs.length - 1]!.id : null;
      const parentId = lastId;
      const nextOrder =
        parentId == null
          ? maxSiblingOrder(
              prev.map((t) => ({ parent_id: t.parentId, order: t.order })),
              null
            ) + 1
          : maxSiblingOrder(
              prev.map((t) => ({ parent_id: t.parentId, order: t.order })),
              parentId
            ) + 1;
      return sortTasksDfs([
        ...prev,
        {
          id: newTaskId(),
          parentId: parentId,
          order: nextOrder,
          title: "",
          description: "",
          startDate: "",
          endDate: "",
          priority: "medium" as const,
          assignee: "",
        },
      ]);
    });
  }

  function removeTask(id: string) {
    setTasks((prev) => {
      if (prev.length <= 1) return prev;
      const flat = prev.map((t) => ({ id: t.id, parent_id: t.parentId }));
      const drop = collectDescendantIds(flat, id);
      drop.add(id);
      return sortTasksDfs(prev.filter((task) => !drop.has(task.id)));
    });
  }

  function updateTask(id: string, patch: Partial<GanttTask>) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const trimmedTasks = tasks
        .map((task) => ({
          ...task,
          title: task.title.trim(),
          description: task.description.trim(),
          assignee: task.assignee?.trim() || "",
        }))
        .filter((task) => task.title.length > 0);

      const idSet = new Set(trimmedTasks.map((x) => x.id));
      let trimmedSafe = trimmedTasks.map((task) => ({
        ...task,
        parentId:
          task.parentId && idSet.has(task.parentId) && task.parentId !== task.id
            ? task.parentId
            : null,
      }));
      trimmedSafe = renumberSiblingOrders(trimmedSafe);

      if (trimmedSafe.length === 0) {
        alert(t("create.errorMinTasks"));
        return;
      }
      const invalidDates = trimmedSafe.find(
        (task) => task.startDate && task.endDate && task.endDate < task.startDate
      );
      if (invalidDates) {
        alert(t("create.errorInvalidDates", { title: invalidDates.title }));
        return;
      }

      const cardPatch: Record<string, unknown> = { title, description, category };
      if (isOwner) cardPatch.is_private = isPrivate;
      const { error: cardError } = await supabase.from("cards").update(cardPatch).eq("id", cardId);
      if (cardError) throw cardError;

      const { error: delTasksErr } = await supabase.from("gantt_tasks").delete().eq("card_id", cardId);
      if (delTasksErr) throw delTasksErr;

      const forTopo = trimmedSafe.map((task) => ({
        id: task.id,
        parent_id: task.parentId,
        order: task.order,
        title: task.title,
        description: task.description || null,
        start_date: task.startDate || null,
        end_date: task.endDate || null,
        priority: task.priority,
        assignee: task.assignee || null,
      }));
      const ordered = topologicalInsertOrder(forTopo);
      const payload = ordered.map((task) => ({
        id: task.id,
        card_id: cardId,
        parent_id: task.parent_id ?? null,
        order: task.order ?? 0,
        title: task.title,
        description: task.description || null,
        start_date: task.start_date || null,
        end_date: task.end_date || null,
        priority: task.priority,
        assignee: task.assignee || null,
      }));
      const { error: insTasksErr } = await supabase.from("gantt_tasks").insert(payload);
      if (insTasksErr) throw insTasksErr;

      router.push(`/card/${cardId}`);
      router.refresh();
    } catch (err: any) {
      alert(t("common.error") + ": " + (err?.message ?? err));
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return <div className="opacity-0" />;
  if (loading) return <div className="min-h-screen bg-white dark:bg-[#020617]" />;
  if (forbidden) return <div className="min-h-screen bg-white dark:bg-[#020617] p-8 text-red-400">Access denied</div>;

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] py-10 px-4 sm:px-6 text-slate-900 dark:text-slate-100">
      <main className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Link href={`/card/${cardId}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400">
            <ArrowLeft className="h-4 w-4" />
            {t("edit.back")}
          </Link>
          <h1 className="text-2xl font-semibold">{t("edit.title")} (Gantt)</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <section className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 p-6 space-y-4">
            <label className="block">
              <div className="mb-1 text-sm font-medium">{t("edit.heading")}</div>
              <input className={INPUT_CLS} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={50} required />
            </label>
            <div>
              <div className="mb-2 text-sm font-medium">{t("edit.category")}</div>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const lang = (i18n.language?.split("-")[0] ?? "en") as "en" | "ru" | "pl" | "uk";
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`rounded-full px-3 py-1 text-sm ${category === cat.id ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}
                    >
                      {cat.translations[lang] || cat.translations.en}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="block">
              <div className="mb-1 text-sm font-medium">{t("edit.description")}</div>
              <textarea className={INPUT_CLS} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            {isOwner && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  {isPrivate ? (
                    <Lock className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Globe className="h-4 w-4 text-slate-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {isPrivate ? t('privacy.privateCard') : t('privacy.publicCard')}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isPrivate ? t('privacy.privateDesc') : t('privacy.publicDesc')}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsPrivate((v) => !v)} className={`relative inline-flex h-6 w-11 items-center rounded-full ${isPrivate ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPrivate ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">{t("create.ganttTasks")}</h2>
            {branchHintParentTitle ? (
              <div className="rounded-lg border border-indigo-400/35 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-950 dark:text-indigo-100">
                {t("gantt.branchEditorBanner", { parent: branchHintParentTitle })}
              </div>
            ) : null}
            {tasks.map((task, idx) => (
              <div
                key={task.id}
                id={`gantt-task-${task.id}`}
                className="scroll-mt-24 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{t("create.taskNumber", { number: idx + 1 })}</span>
                  {tasks.length > 1 && (
                    <button type="button" onClick={() => removeTask(task.id)} className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input className={INPUT_CLS} placeholder={t("create.taskName")} value={task.title} onChange={(e) => updateTask(task.id, { title: e.target.value })} required />
                  <select className={INPUT_CLS} value={task.priority} onChange={(e) => updateTask(task.id, { priority: e.target.value as "low" | "medium" | "high" })}>
                    <option value="low">{t("create.priorityLow")}</option>
                    <option value="medium">{t("create.priorityMedium")}</option>
                    <option value="high">{t("create.priorityHigh")}</option>
                  </select>
                  <input type="date" className={INPUT_CLS} value={task.startDate} onChange={(e) => updateTask(task.id, { startDate: e.target.value })} />
                  <input type="date" className={INPUT_CLS} value={task.endDate} onChange={(e) => updateTask(task.id, { endDate: e.target.value })} />
                </div>
                {tasks.length <= 1 ? (
                  <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{t("gantt.firstStepNoParent")}</p>
                ) : (
                  <div className="mt-3 md:col-span-2">
                    <label className="block">
                      <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t("gantt.parentStep")}
                      </div>
                      <select
                        key={`${task.id}:${task.parentId ?? ""}`}
                        className={INPUT_CLS}
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
                        {eligibleParentTasks(tasks, task.id).map((p) => (
                          <option key={p.id} value={p.id}>
                            {(p.title?.trim() || t("gantt.untitledStep")).slice(0, 80)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t("gantt.parentStepHint")}</p>
                  </div>
                )}
                <textarea className={`${INPUT_CLS} mt-3`} rows={2} placeholder={t("create.description")} value={task.description} onChange={(e) => updateTask(task.id, { description: e.target.value })} />
              </div>
            ))}
            <button id="add-gantt-task" type="button" onClick={addTask} className="rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-1 text-sm">
              {t("gantt.addNextInChain")}
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("gantt.addNextInChainHint")}</p>
          </section>

          <div className="flex justify-end gap-3">
            <Link href={`/card/${cardId}`} className="rounded-md border border-slate-200 dark:border-white/10 px-4 py-2 text-sm">
              {t("common.cancel")}
            </Link>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60">
              <Save className="h-4 w-4" />
              {saving ? t("edit.saving") : t("edit.save")}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
