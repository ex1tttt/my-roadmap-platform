"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Save } from "lucide-react";

type Step = { id: string; title: string; content: string; link?: string; media_url?: string };
type Resource = { id: string; label: string; url: string };

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const INPUT_CLS =
  "w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40";

export default function EditPage() {
  const params = useParams();
  const rawId = params?.id;
  const cardId = Array.isArray(rawId) ? rawId[0] : (rawId ?? "");
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  // Загрузка данных и проверка прав
  useEffect(() => {
    if (!cardId) return;

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const { data: card, error } = await supabase
        .from("cards")
        .select("*, steps(*), resources(*)")
        .eq("id", cardId)
        .maybeSingle();

      if (error) { console.error("Fetch error:", error); setLoading(false); return; }
      if (!card) { setLoading(false); return; }

      // Проверка прав
      if (card.user_id !== user.id) { setForbidden(true); setLoading(false); return; }

      setTitle(card.title ?? "");
      setDescription(card.description ?? "");
      setCategory(card.category ?? "");

      const sortedSteps = (card.steps ?? [])
        .slice()
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((s: any) => ({
          id: s.id ?? uid(),
          title: s.title ?? "",
          content: s.content ?? "",
          link: s.link ?? "",
          media_url: s.media_url ?? undefined,
        }));
      setSteps(sortedSteps.length ? sortedSteps : [{ id: uid(), title: "", content: "", link: "" }]);

      const mappedResources = (card.resources ?? []).map((r: any) => ({
        id: r.id ?? uid(),
        label: r.label ?? "",
        url: r.url ?? "",
      }));
      setResources(mappedResources);

      setLoading(false);
    };

    load();
  }, [cardId, router]);

  // Загрузка медиафайла
  async function handleFileUpload(file: File, stepId: string) {
    try {
      setUploadingStepId(stepId);
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("images").getPublicUrl(fileName);
      const publicUrl = publicData.publicUrl;

      setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, media_url: publicUrl } : s)));
    } catch (err) {
      console.error("Upload error:", err);
      alert("Ошибка загрузки файла: " + (err as any)?.message);
    } finally {
      setUploadingStepId(null);
    }
  }

  // Управление шагами
  const addStep = () => setSteps((s) => [...s, { id: uid(), title: "", content: "", link: "" }]);
  const removeStep = (id: string) => setSteps((s) => s.filter((st) => st.id !== id));
  const updateStep = (id: string, patch: Partial<Step>) =>
    setSteps((s) => s.map((st) => (st.id === id ? { ...st, ...patch } : st)));

  // Управление ресурсами
  const addResource = () => setResources((r) => [...r, { id: crypto.randomUUID(), label: "", url: "" }]);
  const removeResource = (id: string) => setResources((r) => r.filter((res) => res.id !== id));
  const updateResource = (id: string, patch: Partial<Resource>) =>
    setResources((r) => r.map((res) => (res.id === id ? { ...res, ...patch } : res)));

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert("Вы не авторизованы"); return; }

      // 1) Обновляем карточку
      const { error: cardError } = await supabase
        .from("cards")
        .update({ title, description, category })
        .eq("id", cardId)
        .eq("user_id", user.id); // дополнительная защита на уровне запроса

      if (cardError) {
        console.error("Card update error:", cardError);
        alert("Ошибка: " + cardError.message);
        return;
      }

      // 2) Синхронизируем шаги: удаляем старые → вставляем новые
      const { error: delStepsErr } = await supabase.from("steps").delete().eq("card_id", cardId);
      if (delStepsErr) { console.error(delStepsErr); alert("Ошибка при удалении шагов: " + delStepsErr.message); return; }

      if (steps.length > 0) {
        const stepsPayload = steps.map((s, idx) => ({
          card_id: cardId,
          order: idx + 1,
          title: s.title,
          content: s.content,
          link: s.link ?? null,
          media_url: s.media_url ?? null,
        }));
        const { error: insStepsErr } = await supabase.from("steps").insert(stepsPayload);
        if (insStepsErr) { console.error(insStepsErr); alert("Ошибка при сохранении шагов: " + insStepsErr.message); return; }
      }

      // 3) Синхронизируем ресурсы: удаляем старые → вставляем новые
      const { error: delResErr } = await supabase.from("resources").delete().eq("card_id", cardId);
      if (delResErr) { console.error(delResErr); alert("Ошибка при удалении ресурсов: " + delResErr.message); return; }

      const validResources = resources.filter((r) => r.url.trim());
      if (validResources.length > 0) {
        const resPayload = validResources.map((r) => ({ card_id: cardId, label: r.label, url: r.url }));
        const { error: insResErr } = await supabase.from("resources").insert(resPayload);
        if (insResErr) { console.error(insResErr); alert("Ошибка при сохранении ресурсов: " + insResErr.message); return; }
      }

      router.refresh();
      router.push(`/card/${cardId}`);
    } catch (err: any) {
      console.error("Update error:", err);
      alert("Ошибка: " + (err?.message ?? "Неизвестная ошибка"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-8 py-10 text-center">
          <p className="text-lg font-semibold text-red-400">Доступ запрещён</p>
          <p className="mt-1 text-sm text-red-300">Вы не являетесь автором этой карточки.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-slate-400 hover:text-slate-200 underline">
            На главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 py-12 px-6 text-slate-100">
      <main className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={`/card/${cardId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            К карточке
          </Link>
          <h1 className="text-2xl font-semibold text-slate-100">Редактировать карточку</h1>
        </div>

        <form onSubmit={handleUpdate} className="space-y-6">
          {/* Основная информация */}
          <section className="rounded-lg border border-white/10 bg-slate-900/50 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="sm:col-span-2">
                <div className="mb-1 text-sm font-medium text-slate-200">Заголовок</div>
                <input className={INPUT_CLS} value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>

              <label>
                <div className="mb-1 text-sm font-medium text-slate-200">Категория</div>
                <select className={INPUT_CLS} value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Выберите категорию</option>
                  <option value="frontend">Frontend</option>
                  <option value="datascience">Data Science</option>
                  <option value="devops">DevOps</option>
                </select>
              </label>
            </div>

            <label className="mt-4 block">
              <div className="mb-1 text-sm font-medium text-slate-200">Описание</div>
              <textarea
                className={INPUT_CLS}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </section>

          {/* Шаги */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-slate-200">Шаги</h2>
              <button type="button" onClick={addStep} className="rounded-md bg-slate-800 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700">
                + Добавить шаг
              </button>
            </div>

            <div className="space-y-3">
              {steps.map((s, idx) => (
                <div key={s.id} className="box-border w-full rounded-lg border border-white/10 bg-slate-900/50 p-4">
                  <div className="mb-3 text-xs font-semibold text-slate-500">Шаг {idx + 1}</div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {/* Левая колонка: текстовые поля */}
                    <div className="flex flex-col gap-3">
                      <label className="block w-full">
                        <div className="mb-1 text-sm font-medium text-slate-200">Заголовок</div>
                        <input
                          className={INPUT_CLS}
                          value={s.title}
                          onChange={(e) => updateStep(s.id, { title: e.target.value })}
                          required
                        />
                      </label>
                      <label className="block w-full">
                        <div className="mb-1 text-sm font-medium text-slate-200">Описание</div>
                        <textarea
                          className={INPUT_CLS}
                          rows={3}
                          value={s.content}
                          onChange={(e) => updateStep(s.id, { content: e.target.value })}
                        />
                      </label>
                      <label className="block w-full">
                        <div className="mb-1 text-sm font-medium text-slate-200">Ссылка на ресурс</div>
                        <input
                          className={INPUT_CLS}
                          placeholder="Ссылка на ресурс (YouTube, статья и т.д.)"
                          value={s.link ?? ""}
                          onChange={(e) => updateStep(s.id, { link: e.target.value })}
                        />
                      </label>
                    </div>

                    {/* Правая колонка: медиа */}
                    <div className="flex flex-col gap-2">
                      <div className="text-sm font-medium text-slate-200">Медиа (изображение)</div>
                      <input
                        type="file"
                        accept="image/*"
                        className="w-full text-sm text-gray-500 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:text-blue-600 hover:file:bg-blue-100 dark:file:bg-gray-700 dark:file:text-gray-200"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) await handleFileUpload(file, s.id);
                        }}
                      />
                      {uploadingStepId === s.id && (
                        <p className="text-xs text-blue-400">Загрузка...</p>
                      )}
                      {s.media_url && (
                        <img src={s.media_url} alt="media" className="mt-1 h-28 w-full rounded-lg object-cover" />
                      )}
                      <button
                        type="button"
                        className="mt-auto w-fit text-sm text-red-500 hover:text-red-400"
                        onClick={() => removeStep(s.id)}
                      >
                        Удалить шаг
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Ресурсы */}
          <section className="rounded-lg border border-white/10 bg-slate-900/50 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium text-slate-200">Полезные ссылки</h2>
              <button
                type="button"
                onClick={addResource}
                className="rounded-md bg-slate-800 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700"
              >
                + Добавить ссылку
              </button>
            </div>

            <div className="space-y-3">
              {resources.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2">
                  <input
                    className="w-1/3 rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder="Название"
                    value={r.label}
                    onChange={(e) => updateResource(r.id, { label: e.target.value })}
                  />
                  <input
                    className="flex-1 rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder="https://..."
                    value={r.url}
                    onChange={(e) => updateResource(r.id, { url: e.target.value })}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-md px-2 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => removeResource(r.id)}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Кнопки */}
          <div className="flex items-center justify-end gap-3">
            <Link
              href={`/card/${cardId}`}
              className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
            >
              Отмена
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Загрузка...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Сохранить изменения
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
