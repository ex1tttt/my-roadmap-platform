"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { useHasMounted } from "@/hooks/useHasMounted";
import { Lock, Globe } from "lucide-react";
import Toast from "@/components/Toast";
import { checkAndAwardBadges } from '@/lib/badges';

type Step = { id: string; title: string; content: string; link?: string; media_url?: string };
type Resource = { id: string; label: string; url: string };

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function CreatePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const mounted = useHasMounted();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  const [steps, setSteps] = useState<Step[]>([
    { id: uid(), title: "", content: "", link: "", media_url: undefined },
  ]);
  const [resources, setResources] = useState<Resource[]>([]);

  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  async function handleFileUpload(file: File, stepId: string) {
    try {
      setUploadingStepId(stepId);
      const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'bin';
      const fileName = `${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("images").getPublicUrl(fileName);
      const publicUrl = publicData.publicUrl;

      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, media_url: publicUrl } : s))
      );
    } catch (err) {
      console.error("Upload error:", err);
      setToast({ message: t('common.error') + ': ' + (err as any)?.message, type: 'error' });
    } finally {
      setUploadingStepId(null);
    }
  }

  function addStep() {
    setSteps((s) => [...s, { id: uid(), title: "", content: "", link: "", media_url: undefined }]);
  }

  function removeStep(id: string) {
    setSteps((s) => s.filter((st) => st.id !== id));
  }

  function updateStep(id: string, patch: Partial<Step>) {
    setSteps((s) => s.map((st) => (st.id === id ? { ...st, ...patch } : st)));
  }

  function addResource() {
    setResources((r) => [...r, { id: crypto.randomUUID(), label: "", url: "" }]);
  }

  function updateResource(id: string, patch: Partial<Resource>) {
    setResources((r) => r.map((res) => (res.id === id ? { ...res, ...patch } : res)));
  }

  function removeResource(id: string) {
    setResources((r) => r.filter((res) => res.id !== id));
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      // Получаем свежий ID залогиненного пользователя прямо перед сохранением,
      // чтобы не зависеть от потенциально устаревшего состояния
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert(t('edit.errorNotAuth'));
        setSaving(false);
        return;
      }
      // 1) create card
      const { data: cardData, error: cardError } = await supabase
        .from("cards")
        .insert([
          {
            user_id: user.id,
            title,
            category,
            description,
            is_private: isPrivate,
          },
        ])
        .select("id");

      if (cardError) {
        console.error('Full error:', cardError);
        setToast({ message: t('common.error') + ': ' + cardError.message, type: 'error' });
        setSaving(false);
        return;
      }
      const cardId = cardData?.[0]?.id;
      if (!cardId) throw new Error("Card ID not returned");

      // Проверяем достижение «Первопроходец»
      await checkAndAwardBadges(user.id, 'first_card');

      // --- Уведомления подписчикам ---
      // Получаем всех подписчиков с их настройкой колокольчика
      // Пробуем получить подписчиков с колонкой notify_new_cards (если миграция применена)
      // Fallback — без неё (только in-app уведомления, без push-фильтрации)
      let followers: any[] | null = null
      const { data: followersWithBell, error: errWithBell } = await supabase
        .from('follows')
        .select('follower_id, notify_new_cards')
        .eq('following_id', user.id)
      if (!errWithBell) {
        followers = followersWithBell
      } else {
        // Колонка ещё не добавлена — берём без неё
        const { data: followersBasic } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id)
        followers = followersBasic
      }

      if (followers && followers.length > 0) {
        // In-app уведомления создаются DB-триггером notify_followers_on_new_card
        // (только подписчикам с notify_new_cards = true)

        // Push — только тем, у кого включён колокольчик
        const pushIds = followers
          .filter((f: any) => f.notify_new_cards === true)
          .map((f: any) => f.follower_id);
        if (pushIds.length > 0) {
          fetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: pushIds,
              actor_id: user.id,
              title: '🗺️ Новая карточка',
              body: `Опубликована карточка «${title}»`,
              url: `/card/${cardId}`,
            }),
          }).catch(() => {});
        }
      }

      // 2) insert steps
      const stepsPayload = steps.map((s, idx) => ({
        card_id: cardId,
        "order": idx + 1,
        title: s.title,
        content: s.content,
        link: s.link ?? null,
        media_url: s.media_url || null,
      }));

      if (stepsPayload.length > 0) {
        const { error: stepsError } = await supabase.from("steps").insert(stepsPayload);
        if (stepsError) {
          console.error('Full error:', stepsError);
          setToast({ message: t('common.error') + ': ' + stepsError.message, type: 'error' });
          setSaving(false);
          return;
        }
      }

      // 3) insert resources (пропускаем строки с пустым url)
      const resourcesPayload = resources
        .filter((r) => r.url.trim() !== "")
        .map((r) => ({ card_id: cardId, label: r.label, url: r.url }));
      if (resourcesPayload.length > 0) {
        const { error: resError } = await supabase.from("resources").insert(resourcesPayload);
        if (resError) throw resError;
      }

      // Reset form on success
      setTitle("");
      setDescription("");
      setCategory("");
      setIsPrivate(false);
      setSteps([{ id: uid(), title: "", content: "", link: "", media_url: undefined }]);
      setResources([]);
      setToast({ message: "Карточка успешно опубликована!", type: "success" });
      setTimeout(() => router.push('/'), 1500);
    } catch (err: any) {
      setToast({ message: t('common.error') + ': ' + (err?.message ?? err), type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return <div className="opacity-0" />;

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      <main className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-white">{t('create.title')}</h1>

        <form onSubmit={handlePublish} className="space-y-6">
          <section className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-md p-6">
            <label className="block">
              <div className="mb-1 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-slate-200">
                <span>Title</span>
                <span className={`text-xs tabular-nums ${title.length >= 35 ? 'text-red-400' : 'text-slate-500'}`}>
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
              <div className="mb-2 text-sm font-medium text-gray-700 dark:text-slate-200">{t('create.category')}</div>
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
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {!category && (
                <p className="mt-1.5 text-xs text-slate-500">{t('create.selectCategory')}</p>
              )}
            </div>

            <label className="mt-4 block">
              <div className="mb-1 text-sm font-medium text-gray-700 dark:text-slate-200">Description</div>
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
                    Приватная дорожная карта
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Приватная дорожная карта — будет видна только вам
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivate((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                  isPrivate
                    ? 'bg-blue-600'
                    : 'bg-slate-700'
                }`}
                role="switch"
                aria-checked={isPrivate}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isPrivate ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-800 dark:text-slate-200">Steps</h2>
              <button type="button" onClick={addStep} className="rounded-md bg-gray-100 dark:bg-slate-800 px-3 py-1 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700">
                {t('create.addStep')}
              </button>
            </div>

            <div className="space-y-3">
              {steps.map((s, idx) => (
                <div key={s.id} className="box-border w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900/50 shadow-sm p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {/* Левая колонка: текстовые поля */}
                    <div className="flex flex-col gap-3">
                      <label className="block">
                        <div className="mb-1 text-sm font-medium text-gray-700 dark:text-slate-200">{t('create.stepTitle')}</div>
                        <input
                          className="box-border w-full rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={s.title}
                          onChange={(e) => updateStep(s.id, { title: e.target.value })}
                          required
                        />
                      </label>

                      <label className="block">
                        <div className="mb-1 text-sm font-medium text-gray-700 dark:text-slate-200">{t('create.description')}</div>
                        <textarea
                          className="box-border w-full rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                          value={s.content}
                          onChange={(e) => updateStep(s.id, { content: e.target.value })}
                        />
                      </label>

                      <label className="block">
                        <div className="mb-1 text-sm font-medium text-gray-700 dark:text-slate-200">{t('create.link')}</div>
                        <input
                          type="url"
                          placeholder="https://..."
                          className="box-border w-full rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={s.link ?? ""}
                          onChange={(e) => updateStep(s.id, { link: e.target.value })}
                        />
                      </label>
                    </div>

                    {/* Правая колонка: медиа + удаление */}
                    <div className="flex flex-col gap-2">
                      <div className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('create.media')}</div>
                      <input
                        type="file"
                        accept="image/*"
                        className="text-sm"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          await handleFileUpload(file, s.id);
                        }}
                      />
                      {uploadingStepId === s.id && (
                        <p className="text-xs text-gray-500">{t('create.uploading')}</p>
                      )}
                      {s.media_url && (
                        <img src={s.media_url} alt="media" className="mt-1 h-32 w-full rounded object-cover" />
                      )}
                      <button
                        type="button"
                        className="mt-auto self-start text-sm text-red-600 hover:text-red-800"
                        onClick={() => removeStep(s.id)}
                      >
                        {t('create.deleteStep')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-md p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-800 dark:text-slate-200">{t('create.usefulLinks')}</h2>
              <button
                type="button"
                onClick={addResource}
                className="rounded-md bg-gray-100 dark:bg-slate-800 px-3 py-1 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
              >
                {t('create.addLink')}
              </button>
            </div>

            <div className="space-y-3">
              {resources.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-900/40 px-3 py-2">
                  <input
                    className="w-1/3 rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('create.labelPlaceholder')}
                    value={r.label}
                    onChange={(e) => updateResource(r.id, { label: e.target.value })}
                  />
                  <input
                    className="flex-1 rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                    value={r.url}
                    onChange={(e) => updateResource(r.id, { url: e.target.value })}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-md px-2 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => removeResource(r.id)}
                  >
                    {t('delete.label')}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? t('create.publishing') : t('create.publish')}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
