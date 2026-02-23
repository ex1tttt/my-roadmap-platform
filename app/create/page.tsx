"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";


type Step = { id: string; title: string; content: string; link?: string; media_url?: string };
type Resource = { id: string; label: string; url: string };

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function CreatePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  const [steps, setSteps] = useState<Step[]>([
    { id: uid(), title: "", content: "", link: "", media_url: undefined },
  ]);
  const [resources, setResources] = useState<Resource[]>([]);

  const [saving, setSaving] = useState(false);
  const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);

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

      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, media_url: publicUrl } : s))
      );
    } catch (err) {
      console.error("Upload error:", err);
      alert("Ошибка загрузки файла: " + (err as any)?.message);
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
        alert("Пожалуйста, войдите в систему, чтобы опубликовать карточку.");
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
          },
        ])
        .select("id");

      if (cardError) {
        console.error('Full error:', cardError);
        alert('Ошибка: ' + cardError.message);
        return;
      }
      const cardId = cardData?.[0]?.id;
      if (!cardId) throw new Error("Card ID not returned");

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
          alert('Ошибка: ' + stepsError.message);
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
      setSteps([{ id: uid(), title: "", content: "", link: "", media_url: undefined }]);
      setResources([]);
      alert("Карточка успешно опубликована");
    } catch (err: any) {
      console.error('Full error:', err);
      alert('Ошибка: ' + (err?.message || 'Неизвестная ошибка при публикации'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6 dark:bg-black">
      <main className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-100">Создать карточку</h1>

        <form onSubmit={handlePublish} className="space-y-6">
          <section className="rounded-lg border border-white/10 bg-slate-900/50 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="sm:col-span-2">
                <div className="mb-1 text-sm font-medium text-slate-200">Title</div>
                <input
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </label>

              <label>
                <div className="mb-1 text-sm font-medium text-slate-200">Category</div>
                <select
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Выберите категорию</option>
                  <option value="frontend">Frontend</option>
                  <option value="datascience">Data Science</option>
                  <option value="devops">DevOps</option>
                </select>
              </label>
            </div>

            <label className="mt-4 block">
              <div className="mb-1 text-sm font-medium text-slate-200">Description</div>
              <textarea
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-slate-200">Steps</h2>
              <button type="button" onClick={addStep} className="rounded-md bg-slate-800 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700">
                + Добавить шаг
              </button>
            </div>

            <div className="space-y-3">
              {steps.map((s, idx) => (
                <div key={s.id} className="box-border w-full rounded-lg border border-white/10 bg-slate-900/50 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {/* Левая колонка: текстовые поля */}
                    <div className="flex flex-col gap-3">
                      <label className="block">
                        <div className="mb-1 text-sm font-medium text-slate-200">Заголовок шага</div>
                        <input
                          className="box-border w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          value={s.title}
                          onChange={(e) => updateStep(s.id, { title: e.target.value })}
                          required
                        />
                      </label>

                      <label className="block">
                        <div className="mb-1 text-sm font-medium text-slate-200">Описание</div>
                        <textarea
                          className="box-border w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          rows={3}
                          value={s.content}
                          onChange={(e) => updateStep(s.id, { content: e.target.value })}
                        />
                      </label>

                      <label className="block">
                        <div className="mb-1 text-sm font-medium text-slate-200">Ссылка (необязательно)</div>
                        <input
                          type="url"
                          placeholder="https://..."
                          className="box-border w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          value={s.link ?? ""}
                          onChange={(e) => updateStep(s.id, { link: e.target.value })}
                        />
                      </label>
                    </div>

                    {/* Правая колонка: медиа + удаление */}
                    <div className="flex flex-col gap-2">
                      <div className="text-sm font-medium text-slate-200">Медиа</div>
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
                        <p className="text-xs text-gray-500">Загрузка...</p>
                      )}
                      {s.media_url && (
                        <img src={s.media_url} alt="media" className="mt-1 h-32 w-full rounded object-cover" />
                      )}
                      <button
                        type="button"
                        className="mt-auto self-start text-sm text-red-600 hover:text-red-800"
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

          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Сохранение..." : "Опубликовать"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
