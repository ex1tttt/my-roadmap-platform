"use client";

import React, { useState, useEffect } from "react";
import CollaboratorManager from "@/components/CollaboratorManager";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Save, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHasMounted } from "@/hooks/useHasMounted";

type Step = { id: string; title: string; content: string; link?: string; media_url?: string };
type Resource = { id: string; label: string; url: string };

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const INPUT_CLS =
  "w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40";

export default function EditPage() {
  const params = useParams();
  const rawId = params?.id;
  const cardId = Array.isArray(rawId) ? rawId[0] : (rawId ?? "");
  const router = useRouter();
  const { t } = useTranslation();
  const hasMounted = useHasMounted();

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
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
      setIsPrivate(card.is_private === true);
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
      alert(t('common.error') + ': ' + (err as any)?.message);
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
      if (!user) { alert(t('edit.errorNotAuth')); return; }

      // 1) Обновляем карточку
      const { error: cardError } = await supabase
        .from("cards")
        .update({ title, description, category })
        .eq("id", cardId)
        .eq("user_id", user.id); // дополнительная защита на уровне запроса

      if (cardError) {
        console.error("Card update error:", cardError);
        alert(t('common.error') + ': ' + cardError.message);
        return;
      }

      // 2) Синхронизируем шаги: удаляем старые → вставляем новые
      const { error: delStepsErr } = await supabase.from("steps").delete().eq("card_id", cardId);
      if (delStepsErr) { console.error(delStepsErr); alert(t('common.error') + ': ' + delStepsErr.message); return; }

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
        if (insStepsErr) { console.error(insStepsErr); alert(t('common.error') + ': ' + insStepsErr.message); return; }
      }

      // 3) Синхронизируем ресурсы: удаляем старые → вставляем новые
      const { error: delResErr } = await supabase.from("resources").delete().eq("card_id", cardId);
      if (delResErr) { console.error(delResErr); alert(t('common.error') + ': ' + delResErr.message); return; }

      const validResources = resources.filter((r) => r.url.trim());
      if (validResources.length > 0) {
        const resPayload = validResources.map((r) => ({ card_id: cardId, label: r.label, url: r.url }));
        const { error: insResErr } = await supabase.from("resources").insert(resPayload);
        if (insResErr) { console.error(insResErr); alert(t('common.error') + ': ' + insResErr.message); return; }
      }

      router.refresh();
      router.push(`/card/${cardId}`);
    } catch (err: any) {
      console.error("Update error:", err);
      alert(t('common.error') + ': ' + (err?.message ?? err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteImage(stepId: string, imageUrl: string) {
    try {
      // Получаем путь из URL
      const path = imageUrl.split("/images/")[1];
      if (!path) return;
      // Удаляем файл из Supabase Storage
      const { error: storageError } = await supabase.storage.from("images").remove([path]);
      if (storageError) throw storageError;
      // Обновляем поле media_url в базе
      const { error: dbError } = await supabase.from("steps").update({ media_url: null }).eq("id", stepId);
      if (dbError) throw dbError;
      // Обновляем UI
      setSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, media_url: undefined } : s));
    } catch (err) {
      alert("Ошибка удаления изображения: " + (err as any)?.message);
    }
  }

  if (!hasMounted) return <div className="opacity-0" />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#020617]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#020617]">
        <div className="rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/40 px-8 py-10 text-center">
          <p className="text-lg font-semibold text-red-600 dark:text-red-400">{hasMounted ? t('edit.forbidden') : 'Access denied'}</p>
          <p className="mt-1 text-sm text-red-500 dark:text-red-300">{hasMounted ? t('edit.forbiddenText') : ''}</p>
          <Link href="/" className="mt-4 inline-block text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline">
            {hasMounted ? t('edit.backToHome') : 'Back to home'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] py-12 px-6 text-slate-900 dark:text-slate-100">
      <main className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={`/card/${cardId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {hasMounted ? t('edit.back') : 'Back'}
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{hasMounted ? t('edit.title') : 'Edit roadmap'}</h1>
        </div>

        <form onSubmit={handleUpdate} className="space-y-6">
          {/* Основная информация */}
          <section className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 p-6">
            <label className="block">
              <div className="mb-1 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>{hasMounted ? t('edit.heading') : 'Title'}</span>
                <span className={`text-xs tabular-nums ${title.length >= 45 ? 'text-red-400' : 'text-slate-500'}`}>
                  {title.length}/50
                </span>
              </div>
              <input className={INPUT_CLS} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={50} required />
            </label>

            <div className="mt-4">
              <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{hasMounted ? t('edit.category') : 'Category'}</div>
              <div className="flex flex-wrap gap-2">
                {[
                  'Frontend', 'Backend', 'Mobile Development', 'Data Science',
                  'Design', 'DevOps', 'Marketing', 'GameDev', 'Cybersecurity', 'Soft Skills',
                ].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`rounded-full px-3 py-1 text-sm transition-colors ${
                      category === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {!category && (
                <p className="mt-1.5 text-xs text-slate-500">{hasMounted ? t('edit.selectCategory') : ''}</p>
              )}
            </div>

            <label className="mt-4 block">
              <div className="mb-1 text-sm font-medium text-slate-200">{hasMounted ? t('edit.description') : 'Description'}</div>
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
            <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200">{hasMounted ? t('edit.steps') : 'Steps'}</h2>
            <div className="space-y-3">
              {steps.map((s, idx) => (
                <div key={s.id} className="box-border w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 p-4">
                  <div className="mb-3 text-xs font-semibold text-slate-500">{hasMounted ? t('edit.stepLabel', { n: idx + 1 }) : `Step ${idx + 1}`}</div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {/* Левая колонка: текстовые поля */}
                    <div className="flex flex-col gap-3">
                      <label className="block w-full">
                        <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">{hasMounted ? t('edit.stepTitle') : 'Step title'}</div>
                        <input
                          className={INPUT_CLS}
                          value={s.title}
                          onChange={(e) => updateStep(s.id, { title: e.target.value })}
                          required
                        />
                      </label>
                      <label className="block w-full">
                        <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">{hasMounted ? t('edit.stepContent') : 'Content'}</div>
                        <textarea
                          className={INPUT_CLS}
                          rows={3}
                          value={s.content}
                          onChange={(e) => updateStep(s.id, { content: e.target.value })}
                        />
                      </label>
                      <label className="block w-full">
                        <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">{hasMounted ? t('edit.stepLink') : 'Link'}</div>
                        <input
                          className={INPUT_CLS}
                          placeholder={hasMounted ? t('edit.stepLinkPlaceholder') : ''}
                          value={s.link ?? ""}
                          onChange={(e) => updateStep(s.id, { link: e.target.value })}
                        />
                      </label>
                    </div>
                    {/* Правая колонка: медиа */}
                    <div className="flex flex-col gap-2">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{hasMounted ? t('edit.stepMedia') : 'Media'}</div>
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
                        <p className="text-xs text-blue-400">{hasMounted ? t('create.uploading') : 'Uploading...'}</p>
                      )}
                      {s.media_url && (
                        <div className="relative mt-1">
                          <img src={s.media_url} alt="media" className="h-28 w-full rounded-lg object-cover" />
                          <button
                            type="button"
                            className="absolute top-1 right-1 z-10 rounded-full bg-red-500 text-white p-1 hover:bg-red-600 transition"
                            onClick={() => handleDeleteImage(s.id, s.media_url!)}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        className="mt-auto w-fit text-sm text-red-500 hover:text-red-400"
                        onClick={() => removeStep(s.id)}
                      >
                        {hasMounted ? t('edit.deleteStep') : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addStep}
              className="mt-4 w-full text-left rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {hasMounted ? t('edit.addStep') : 'Add step'}
            </button>
          </section>

          {/* Ресурсы */}
          <section className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200">{hasMounted ? t('edit.usefulLinks') : 'Useful links'}</h2>
              <button
                type="button"
                onClick={addResource}
                className="rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                {hasMounted ? t('edit.addLink') : 'Add link'}
              </button>
            </div>

            <div className="space-y-3">
              {resources.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 px-3 py-2">
                  <input
                    className="w-1/3 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder={hasMounted ? t('create.labelPlaceholder') : 'Label'}
                    value={r.label}
                    onChange={(e) => updateResource(r.id, { label: e.target.value })}
                  />
                  <input
                    className="flex-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder="https://..."
                    value={r.url}
                    onChange={(e) => updateResource(r.id, { url: e.target.value })}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-md px-2 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => removeResource(r.id)}
                  >
                    {hasMounted ? t('delete.label') : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Кнопки */}
          <div className="flex items-center justify-end gap-3">
            <Link
              href={`/card/${cardId}`}
              className="rounded-md border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 transition-colors hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Отмена
            </Link>
            <button
              type="submit"
              disabled={saving || title.trim().length === 0 || title.length > 50}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  {hasMounted ? t('edit.saving') : 'Saving...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {hasMounted ? t('edit.save') : 'Save'}
                </>
              )}
            </button>
          </div>
        </form>
        {isPrivate && (
          <div className="mt-10">
            <CollaboratorManager cardId={cardId} />
          </div>
        )}
      </main>
    </div>
  );
}
