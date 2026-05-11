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

type GanttTask = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  priority: "low" | "medium" | "high";
  assignee?: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const INPUT_CLS =
  "w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40";

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
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
        setLoading(false);
        return;
      }
      if (card.card_type !== "gantt") {
        router.replace(`/card/${card.id}/edit`);
        return;
      }

      setCardId(card.id);
      if (card.user_id === user.id) {
        setIsOwner(true);
      } else {
        if (!user.email) {
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
          setForbidden(true);
          setLoading(false);
          return;
        }
      }

      setTitle(card.title ?? "");
      setDescription(card.description ?? "");
      setCategory(card.category ?? "");
      setIsPrivate(card.is_private === true);
      const mapped = (card.gantt_tasks ?? [])
        .slice()
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((task: any) => ({
          id: task.id ?? uid(),
          title: task.title ?? "",
          description: task.description ?? "",
          startDate: task.start_date ?? "",
          endDate: task.end_date ?? "",
          priority: (task.priority ?? "medium") as "low" | "medium" | "high",
          assignee: task.assignee ?? "",
        }));
      setTasks(mapped.length ? mapped : [{
        id: uid(),
        title: "",
        description: "",
        startDate: "",
        endDate: "",
        priority: "medium",
        assignee: "",
      }]);
      setLoading(false);
    };
    load();
  }, [slug, router]);

  function addTask() {
    setTasks((prev) => [...prev, {
      id: uid(),
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      priority: "medium",
      assignee: "",
    }]);
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((task) => task.id !== id));
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

      if (trimmedTasks.length === 0) {
        alert("Добавьте хотя бы одну задачу с названием");
        return;
      }
      const invalidDates = trimmedTasks.find(
        (task) => task.startDate && task.endDate && task.endDate < task.startDate
      );
      if (invalidDates) {
        alert(`Проверьте даты в задаче "${invalidDates.title}"`);
        return;
      }

      const cardPatch: Record<string, unknown> = { title, description, category };
      if (isOwner) cardPatch.is_private = isPrivate;
      const { error: cardError } = await supabase.from("cards").update(cardPatch).eq("id", cardId);
      if (cardError) throw cardError;

      const { error: delTasksErr } = await supabase.from("gantt_tasks").delete().eq("card_id", cardId);
      if (delTasksErr) throw delTasksErr;

      const payload = trimmedTasks.map((task, index) => ({
        card_id: cardId,
        order: index,
        title: task.title,
        description: task.description || null,
        start_date: task.startDate || null,
        end_date: task.endDate || null,
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
                <div className="flex items-center gap-2">{isPrivate ? <Lock className="h-4 w-4 text-amber-400" /> : <Globe className="h-4 w-4 text-slate-400" />}<span className="text-sm">{isPrivate ? t("privacy.privateCard") : t("privacy.publicCard")}</span></div>
                <button type="button" onClick={() => setIsPrivate((v) => !v)} className={`relative inline-flex h-6 w-11 items-center rounded-full ${isPrivate ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPrivate ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Gantt Tasks</h2>
            {tasks.map((task, idx) => (
              <div
                key={task.id}
                id={`gantt-task-${task.id}`}
                className="scroll-mt-24 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Задача {idx + 1}</span>
                  {idx > 0 && (
                    <button type="button" onClick={() => removeTask(task.id)} className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input className={INPUT_CLS} placeholder="Название" value={task.title} onChange={(e) => updateTask(task.id, { title: e.target.value })} required />
                  <select className={INPUT_CLS} value={task.priority} onChange={(e) => updateTask(task.id, { priority: e.target.value as "low" | "medium" | "high" })}>
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                  </select>
                  <input type="date" className={INPUT_CLS} value={task.startDate} onChange={(e) => updateTask(task.id, { startDate: e.target.value })} />
                  <input type="date" className={INPUT_CLS} value={task.endDate} onChange={(e) => updateTask(task.id, { endDate: e.target.value })} />
                </div>
                <textarea className={`${INPUT_CLS} mt-3`} rows={2} placeholder="Описание" value={task.description} onChange={(e) => updateTask(task.id, { description: e.target.value })} />
              </div>
            ))}
            <button type="button" onClick={addTask} className="rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-1 text-sm">
              Добавить задачу
            </button>
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
