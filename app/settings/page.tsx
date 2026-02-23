"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import UserAvatar from "@/components/UserAvatar";
import { ArrowLeft, LogOut, Save, Camera } from "lucide-react";

type Profile = {
  id: string;
  username: string;
  avatar: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Загружаем профиль текущего пользователя
  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setErrorMsg("Не удалось загрузить профиль: " + error.message);
      } else if (data) {
        setProfile(data);
        setUsername(data.username ?? "");
        setAvatarUrl(data.avatar ?? null);
      } else {
        // Профиль ещё не создан — создаём с дефолтными значениями
        const { data: newProfile, error: upsertError } = await supabase
          .from("profiles")
          .upsert({ id: user.id, username: user.email?.split("@")[0] ?? "user", avatar: null })
          .select()
          .single();

        if (upsertError) {
          setErrorMsg("Не удалось создать профиль: " + upsertError.message);
        } else if (newProfile) {
          setProfile(newProfile);
          setUsername(newProfile.username ?? "");
          setAvatarUrl(newProfile.avatar ?? null);
        }
      }

      setLoading(false);
    }

    loadProfile();
  }, [router]);

  // Обработчик выбора файла
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    console.log('Файл выбран:', file);

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер — 5 МБ.');
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    // Сбрасываем после захвата файла, чтобы можно было повторно выбрать тот же файл
    e.target.value = "";
    handleAvatarUpload(file);
  }

  // Загрузка аватара в бакет avatars
  async function handleAvatarUpload(file: File) {
    try {
      setUploading(true);
      setErrorMsg("");

      // Получаем актуальный ID пользователя из auth, а не из локального стейта profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorMsg("Необходимо войти в аккаунт.");
        return;
      }

      const filePath = `${user.id}/${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Получаем постоянную публичную ссылку (не createObjectURL — она временная)
      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;
      // Сохраняем в таблицу profiles сразу после загрузки
      const { error: dbError } = await supabase
        .from("profiles")
        .update({ avatar: publicUrl })
        .eq("id", user.id);

      if (dbError) throw dbError;

      // Обновляем state постоянным URL из хранилища
      setAvatarUrl(publicUrl);
      setProfile((prev) => prev ? { ...prev, avatar: publicUrl } : prev);
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      setErrorMsg("Ошибка загрузки аватара: " + (err?.message ?? "Неизвестная ошибка"));
    } finally {
      setUploading(false);
    }
  }

  // Сохранение профиля
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const trimmed = username.trim();
      if (!trimmed) {
        setErrorMsg("Имя пользователя не может быть пустым.");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, username: trimmed, avatar: avatarUrl });

      if (error) throw error;

      setSuccessMsg("Профиль успешно обновлён!");
      setProfile((prev) => prev ? { ...prev, username: trimmed, avatar: avatarUrl } : prev);
    } catch (err: any) {
      console.error("Save profile error:", err);
      setErrorMsg("Ошибка сохранения: " + (err?.message ?? "Неизвестная ошибка"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-100">
      {/* Шапка */}
      <div className="border-b border-white/10 bg-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            На главную
          </Link>

          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-red-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </div>
      </div>

      {/* Основной контент */}
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-8 text-2xl font-bold text-white">Настройки профиля</h1>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Аватар */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
              Аватар
            </h2>

            <div className="flex items-center gap-5">
              {/* Превью */}
              <div className="relative shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Аватар"
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-blue-500/40"
                  />
                ) : (
                  <UserAvatar username={username || "?"} size={80} />
                )}

                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300 transition-all hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                  {uploading ? "Загрузка..." : "Выбрать фото"}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="text-left text-xs text-red-400 hover:text-red-300"
                  >
                    Удалить аватар
                  </button>
                )}
                <p className="text-xs text-slate-500">JPG, PNG, WebP — до 5 МБ</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Данные профиля */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
              Данные
            </h2>

            <label className="block">
              <div className="mb-1.5 text-sm font-medium text-slate-300">Имя пользователя</div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="box-border w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="username"
              />
            </label>
          </div>

          {/* Сообщения */}
          {errorMsg && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-400">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="rounded-lg border border-green-500/30 bg-green-950/40 px-4 py-3 text-sm text-green-400">
              {successMsg}
            </div>
          )}

          {/* Кнопка сохранения */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
