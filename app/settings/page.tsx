"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import UserAvatar from "@/components/UserAvatar";
import { ArrowLeft, LogOut, Save, Camera, Mail, Lock, Eye, EyeOff } from "lucide-react";

const INPUT_CLS =
  "box-border w-full rounded-lg border border-slate-800 bg-zinc-900 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
const CARD_CLS = "rounded-xl border border-slate-800 bg-slate-900/50 p-6";
const BTN_PRIMARY =
  "inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-60";

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
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  // Смена почты
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");
  const [emailError, setEmailError] = useState("");

  // Смена пароля
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [userEmail, setUserEmail] = useState("");

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

      setUserEmail(user.email ?? "");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setProfileError("Не удалось загрузить профиль: " + error.message);
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
          setProfileError("Не удалось создать профиль: " + upsertError.message);
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
      setProfileError("");

      // Получаем актуальный ID пользователя из auth, а не из локального стейта profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfileError("Необходимо войти в аккаунт.");
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
      setProfileError("Ошибка загрузки аватара: " + (err?.message ?? "Неизвестная ошибка"));
    } finally {
      setUploading(false);
    }
  }

  // Сохранение профиля
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setProfileMsg("");
    setProfileError("");

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
        setProfileError("Имя пользователя не может быть пустым.");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, username: trimmed, avatar: avatarUrl });

      if (error) throw error;

      setProfileMsg("Профиль успешно обновлён!");
      setProfile((prev) => prev ? { ...prev, username: trimmed, avatar: avatarUrl } : prev);
    } catch (err: any) {
      console.error("Save profile error:", err);
      setProfileError("Ошибка сохранения: " + (err?.message ?? "Неизвестная ошибка"));
    } finally {
      setSaving(false);
    }
  }

  async function handleEmailUpdate(e: React.FormEvent) {
    e.preventDefault();
    setEmailSaving(true);
    setEmailMsg("");
    setEmailError("");
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      setEmailMsg("Письмо с подтверждением отправлено на обе почты. Перейдите по ссылке в каждом письме.");
      setNewEmail("");
    } catch (err: any) {
      setEmailError("Ошибка: " + (err?.message ?? "Неизвестная ошибка"));
    } finally {
      setEmailSaving(false);
    }
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMsg("");
    setPasswordError("");
    try {
      if (newPassword !== confirmPassword) {
        setPasswordError("Пароли не совпадают.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMsg("Пароль успешно изменён!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError("Ошибка: " + (err?.message ?? "Неизвестная ошибка"));
    } finally {
      setPasswordSaving(false);
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
      <div className="border-b border-slate-800 bg-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-white/5 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            На главную
          </Link>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-white/5 px-3 py-1.5 text-sm text-red-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </div>
      </div>

      {/* Контент */}
      <main className="mx-auto max-w-2xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-bold text-white">Настройки профиля</h1>

        {/* ── Аватар ── */}
        <div className={CARD_CLS}>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Аватар</h2>
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Аватар" className="h-20 w-20 rounded-full object-cover ring-2 ring-blue-500/40" />
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
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-300 transition-all hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300 disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
                {uploading ? "Загрузка..." : "Выбрать фото"}
              </button>
              {avatarUrl && (
                <button type="button" onClick={() => setAvatarUrl(null)} className="text-left text-xs text-red-400 hover:text-red-300">
                  Удалить аватар
                </button>
              )}
              <p className="text-xs text-slate-500">JPG, PNG, WebP — до 5 МБ</p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
        </div>

        {/* ── Данные (имя) ── */}
        <form onSubmit={handleSaveProfile}>
          <div className={CARD_CLS}>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Данные</h2>
            <label className="block">
              <div className="mb-1.5 text-sm font-medium text-slate-300">Имя пользователя</div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="username"
                className={INPUT_CLS}
              />
            </label>
            {profileError && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-400">{profileError}</div>
            )}
            {profileMsg && (
              <div className="mt-3 rounded-lg border border-green-500/30 bg-green-950/40 px-4 py-3 text-sm text-green-400">{profileMsg}</div>
            )}
            <div className="mt-4 flex justify-end">
              <button type="submit" disabled={saving || uploading} className={BTN_PRIMARY}>
                <Save className="h-4 w-4" />
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </form>

        {/* ── Изменить почту ── */}
        <form onSubmit={handleEmailUpdate}>
          <div className={CARD_CLS}>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              <Mail className="h-3.5 w-3.5" />
              Изменить почту
            </h2>
            <label className="block">
              <div className="mb-1.5 text-sm font-medium text-slate-300">Новый Email</div>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                placeholder="new@example.com"
                className={INPUT_CLS}
              />
            </label>
            {emailError && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-400">{emailError}</div>
            )}
            {emailMsg && (
              <div className="mt-3 rounded-lg border border-green-500/30 bg-green-950/40 px-4 py-3 text-sm text-green-400">{emailMsg}</div>
            )}
            <div className="mt-4 flex justify-end">
              <button type="submit" disabled={emailSaving || !newEmail.trim()} className={BTN_PRIMARY}>
                <Mail className="h-4 w-4" />
                {emailSaving ? "Отправка..." : "Обновить Email"}
              </button>
            </div>
          </div>
        </form>

        {/* ── Безопасность (пароль) ── */}
        <form onSubmit={handlePasswordUpdate}>
          <div className={CARD_CLS}>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              Безопасность
            </h2>
            <div className="space-y-3">
              {/* Текущий пароль */}
              <div>
                <div className="mb-1.5 text-sm font-medium text-slate-300">Текущий пароль</div>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={INPUT_CLS + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Новый пароль */}
              <div>
                <div className="mb-1.5 text-sm font-medium text-slate-300">Новый пароль</div>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={INPUT_CLS + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Подтвердите новый пароль */}
              <div>
                <div className="mb-1.5 text-sm font-medium text-slate-300">Подтвердите новый пароль</div>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={`box-border w-full rounded-lg border bg-zinc-900 px-4 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 ${
                      confirmPassword && newPassword !== confirmPassword
                        ? "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/20"
                        : "border-slate-800 focus:border-blue-500/60 focus:ring-blue-500/20"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-400">Пароли не совпадают</p>
                )}
              </div>
            </div>
            {passwordError && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-400">{passwordError}</div>
            )}
            {passwordMsg && (
              <div className="mt-3 rounded-lg border border-green-500/30 bg-green-950/40 px-4 py-3 text-sm text-green-400">{passwordMsg}</div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={passwordSaving || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                className={BTN_PRIMARY}
              >
                <Lock className="h-4 w-4" />
                {passwordSaving ? "Проверка..." : "Сменить пароль"}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
