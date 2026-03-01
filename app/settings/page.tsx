"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import UserAvatar from "@/components/UserAvatar";
import { ArrowLeft, LogOut, Save, Camera, Mail, Lock, Eye, EyeOff, Trash2, Loader2, Globe, ChevronDown, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useHasMounted } from "@/hooks/useHasMounted";
import { saveLanguage, type SupportedLanguage } from "@/lib/i18n";
import { subscribeUser, unsubscribeUser, getActiveSubscription, getPushStatus, type PushStatus } from "@/lib/push";
import { ALL_BADGES } from "@/components/ProfileBadges";

const INPUT_CLS =
  "box-border w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
const CARD_CLS = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6";
const BTN_PRIMARY =
  "inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

type Profile = {
  id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  language: string | null;
};

const LANGUAGE_OPTIONS: { value: SupportedLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "uk", label: "Ukrainian" },
  { value: "pl", label: "Polish" },
  { value: "ru", label: "Russian" },
];

export default function SettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, i18n } = useTranslation();
  const mounted = useHasMounted();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<SupportedLanguage>("en");

  // Смена почты
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  // Смена пароля
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // Danger Zone
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Push-уведомления
  const [pushStatus, setPushStatus] = useState<PushStatus>('unsupported');
  const [pushLoading, setPushLoading] = useState(false);

  // Достижения
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string>>(new Set());
  const [featuredBadge, setFeaturedBadge] = useState<string | null>(null);
  const [badgeSaving, setBadgeSaving] = useState(false);

  // Инициализируем статус push при монтировании
  useEffect(() => {
    const initPush = async () => {
      const base = getPushStatus();
      if (base === 'unsupported' || base === 'denied') {
        setPushStatus(base);
        return;
      }
      const existing = await getActiveSubscription();
      setPushStatus(existing ? 'subscribed' : 'default');
    };
    initPush();
  }, []);

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
        toast.error("Не удалось загрузить профиль: " + error.message);
      } else if (data) {
        setProfile(data);
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar ?? null);
        const lang = (data.language ?? "en") as SupportedLanguage;
        setLanguage(lang);
        i18n.changeLanguage(lang);
        saveLanguage(lang);
        // featured_badge появится только после выполнения миграции
        setFeaturedBadge(data.featured_badge ?? null);

        // Загружаем полученные значки (таблица может отсутствовать до миграции)
        const { data: badgesData, error: badgesErr } = await supabase
          .from('user_badges')
          .select('badge_id')
          .eq('user_id', user.id);
        if (!badgesErr) {
          setEarnedBadgeIds(new Set((badgesData ?? []).map((b: { badge_id: string }) => b.badge_id)));
        }
      } else {
        // Профиль ещё не создан — создаём с дефолтными значениями
        const { data: newProfile, error: upsertError } = await supabase
          .from("profiles")
          .upsert({ id: user.id, username: user.email?.split("@")[0] ?? "user", avatar: null, language: "en" })
          .select()
          .single();

        if (upsertError) {
          toast.error("Не удалось создать профиль: " + upsertError.message);
        } else if (newProfile) {
          setProfile(newProfile);
          setUsername(newProfile.username ?? "");
          setBio(newProfile.bio ?? "");
          setAvatarUrl(newProfile.avatar ?? null);
          setLanguage("en");
        }
      }

      setLoading(false);
    }

    loadProfile();
  }, [router]);

  async function saveFeaturedBadge(badgeId: string | null) {
    if (!profile) return;
    const next = featuredBadge === badgeId ? null : badgeId; // toggle
    setFeaturedBadge(next);
    setBadgeSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ featured_badge: next })
      .eq('id', profile.id);
    setBadgeSaving(false);
    if (error) {
      toast.error('Ошибка сохранения');
      setFeaturedBadge(featuredBadge); // rollback
    } else {
      toast.success(next ? 'Витринный значок обновлён' : 'Витринный значок снят');
    }
  }

  // Обработчик выбора файла
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

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

      // Получаем актуальный ID пользователя из auth, а не из локального стейта profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Необходимо войти в аккаунт.");
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
      toast.success("Аватар обновлён!");
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error("Ошибка загрузки аватара: " + (err?.message ?? "Неизвестная ошибка"));
    } finally {
      setUploading(false);
    }
  }

  // Сохранение профиля
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

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
        toast.error("Имя пользователя не может быть пустым.");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, username: trimmed, avatar: avatarUrl, bio: bio.trim() || null, language });

      if (error) {
        // 409 / PostgreSQL 23505 — нарушение уникальности (ник уже занят)
        const isDuplicate =
          error.code === '23505' ||
          (error as any).status === 409 ||
          error.message?.toLowerCase().includes('unique') ||
          error.message?.toLowerCase().includes('duplicate') ||
          error.details?.toLowerCase().includes('already exists');

        if (isDuplicate) {
          toast.error(`Пользователь с ником «${trimmed}» уже существует. Выберите другой ник.`);
        } else {
          toast.error("Ошибка сохранения: " + (error.message ?? "Неизвестная ошибка"));
        }
        return;
      }

      toast.success("Профиль успешно обновлён!");
      setProfile((prev) => prev ? { ...prev, username: trimmed, avatar: avatarUrl, bio: bio.trim() || null } : prev);
    } catch (err: any) {
      console.error("Save profile error:", err);
      toast.error("Ошибка сохранения: " + (err?.message ?? "Неизвестная ошибка"));
    } finally {
      setSaving(false);
    }
  }

  async function handleEmailUpdate(e: React.FormEvent) {
    e.preventDefault();
    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      toast.success("Письмо с подтверждением отправлено на обе почты!", {
        description: "Перейдите по ссылке в каждом письме для подтверждения.",
        duration: 6000,
      });
      setNewEmail("");
    } catch (err: any) {
      toast.error("Ошибка обновления Email: " + (err?.message ?? "Неизвестная ошибка"));
    } finally {
      setEmailSaving(false);
    }
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordError("");
    try {
      if (newPassword !== confirmPassword) {
        setPasswordError("Пароли не совпадают.");
        return;
      }
      // Проверяем текущий пароль перед сменой
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });
      if (signInError) {
        setPasswordError("Текущий пароль введён неверно.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Пароль успешно изменён!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error("Ошибка смены пароля: " + (err?.message ?? "Неизвестная ошибка"));
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteLoading(true);
    try {
      // 1. Проверяем креденциалы
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: deleteEmail.trim(),
        password: deletePassword,
      });
      if (signInError) {
        toast.error("Неверная почта или пароль.");
        return;
      }

      // 2. Получаем ID текущего пользователя
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Сессия истекла, войдите заново.");
        return;
      }

      // 3. Вызываем серверный API-роут, передаём userId в теле
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Ошибка сервера");

      // 4. Уведомляем, разлогиниваемся и переходим на главную
      toast.success("Ваш аккаунт был успешно удалён.");
      await supabase.auth.signOut();
      router.refresh();
      router.push("/");
    } catch (err: any) {
      toast.error("Ошибка удаления: " + (err?.message ?? "Неизвестная ошибка"));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleLanguageChange(lang: SupportedLanguage) {
    // 1. Мгновенно обновляем UI
    setLanguage(lang);
    i18n.changeLanguage(lang);
    saveLanguage(lang);

    // 2. Сохраняем в Supabase
    if (profile?.id) {
      const { error } = await supabase
        .from('profiles')
        .update({ language: lang })
        .eq('id', profile.id);

      if (error) {
        console.error('Language save error:', error);
        toast.error(t('common.error') + ': ' + error.message);
      }
    }
  }
  async function handleTogglePush() {
    if (!profile?.id) return;
    setPushLoading(true);
    try {
      if (pushStatus === 'subscribed') {
        const { ok, error } = await unsubscribeUser(profile.id);
        if (ok) {
          setPushStatus('default');
          toast.success('Push-уведомления отключены.');
        } else {
          toast.error(error ?? 'Ошибка при отписке.');
        }
      } else {
        const { ok, error } = await subscribeUser(profile.id);
        if (ok) {
          setPushStatus('subscribed');
          toast.success('Push-уведомления включены!');
        } else {
          toast.error(error ?? 'Ошибка при подписке.');
          // Если разрешение заблокировано — обновляем статус
          if (Notification.permission === 'denied') setPushStatus('denied');
        }
      }
    } finally {
      setPushLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (!mounted) return <div className="opacity-0" />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#020617]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] text-slate-900 dark:text-slate-100">
      {/* Шапка */}
      <div className="border-b border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 transition-colors hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('nav.backToHome')}
          </Link>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-sm text-red-500 dark:text-red-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 dark:hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            {t('auth.logout')}
          </button>
        </div>
      </div>

      {/* Контент */}
      <main className="mx-auto max-w-2xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('settings.title')}</h1>

        {/* ── Аватар ── */}
        <div className={CARD_CLS}>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">{t('settings.avatar')}</h2>
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
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-white/5 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 transition-all hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Camera className="h-4 w-4" />}
                {uploading ? t('settings.uploading') : t('settings.changeAvatar')}
              </button>
              {avatarUrl && (
                <button type="button" onClick={() => setAvatarUrl(null)} className="text-left text-xs text-red-400 hover:text-red-300">
                  {t('settings.deleteAvatarLabel')}
                </button>
              )}
              <p className="text-xs text-slate-500">{t('settings.avatarHint')}</p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
        </div>

        {/* ── Данные (имя) ── */}
        <form onSubmit={handleSaveProfile}>
          <div className={CARD_CLS}>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">{t('settings.profileInfo')}</h2>
            <label className="block">
              <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.username')}</div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="username"
                className={INPUT_CLS}
              />
            </label>

            <label className="mt-4 block">
              <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.email')}</div>
              {loading ? (
                <div className="h-10 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800/60" />
              ) : (
                <input
                  type="email"
                  value={userEmail}
                  readOnly
                  className="box-border w-full cursor-not-allowed rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 outline-none"
                />
              )}
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{t('settings.emailReadonlyHint')}</p>
            </label>

            <label className="mt-4 block">
              <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.bio')}</div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={200}
                rows={3}
                placeholder={t('settings.bioPlaceholder')}
                className="box-border w-full resize-none rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-1 text-right text-xs text-slate-500 dark:text-slate-400">
                <span className={bio.length >= 180 ? 'text-amber-400' : ''}>{bio.length}</span>/200
              </p>
            </label>

            {/* ── Язык интерфейса ── */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Globe className="h-4 w-4" />
                {t('settings.language_label')}
              </div>
              <div className="relative">
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                  className={INPUT_CLS + " cursor-pointer appearance-none pr-10"}
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{t('settings.languageHint')}</p>
            </div>

            <div className="mt-4 flex justify-end">
              <button type="submit" disabled={saving || uploading} className={BTN_PRIMARY}>
                {saving
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Save className="h-4 w-4" />}
                {saving ? t('settings.saving') : t('settings.save_button')}
              </button>
            </div>
          </div>
        </form>

        {/* ── Изменить почту ── */}
        <form onSubmit={handleEmailUpdate}>
          <div className={CARD_CLS}>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              <Mail className="h-3.5 w-3.5" />
              {t('settings.changeEmail')}
            </h2>
            <label className="block">
              <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.newEmail')}</div>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                placeholder="new@example.com"
                className={INPUT_CLS}
              />
            </label>
            <div className="mt-4 flex justify-end">
              <button type="submit" disabled={emailSaving || !newEmail.trim()} className={BTN_PRIMARY}>
                {emailSaving
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Mail className="h-4 w-4" />}
                {emailSaving ? t('settings.sending') : t('settings.updateEmail')}
              </button>
            </div>
          </div>
        </form>

        {/* ── Безопасность (пароль) ── */}
        <form onSubmit={handlePasswordUpdate}>
          <div className={CARD_CLS}>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              {t('settings.security')}
            </h2>
            <div className="space-y-3">
              {/* Текущий пароль */}
              <div>
                <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.currentPassword')}</div>
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
                <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.newPassword')}</div>
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
                <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.confirmPassword')}</div>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={`box-border w-full rounded-lg border bg-white dark:bg-slate-900 px-4 py-2.5 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 ${
                      confirmPassword && newPassword !== confirmPassword
                        ? "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/20"
                        : "border-slate-200 dark:border-slate-800 focus:border-blue-500/60 focus:ring-blue-500/20"
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
                  <p className="mt-1 text-xs text-red-400">{t('settings.passwordMismatch')}</p>
                )}
              </div>
            </div>
            {passwordError && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-400">{passwordError}</div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={passwordSaving || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                className={BTN_PRIMARY}
              >
                {passwordSaving
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Lock className="h-4 w-4" />}
                {passwordSaving ? t('settings.saving') : t('settings.changePassword')}
              </button>
            </div>
          </div>
        </form>

        {/* ── Достижения ── */}
        <div className={CARD_CLS}>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            🏆 Достижения
          </h2>
          <p className="mb-5 text-xs text-slate-500">
            Выберите один значок для отображения на витрине профиля — он будет отмечен короной 👑.
          </p>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-3">
            {ALL_BADGES.map((badge) => {
              const earned = earnedBadgeIds.has(badge.id);
              const isFeatured = featuredBadge === badge.id;
              return (
                <button
                  key={badge.id}
                  type="button"
                  disabled={!earned || badgeSaving}
                  onClick={() => saveFeaturedBadge(badge.id)}
                  className={`group relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all disabled:cursor-not-allowed ${
                    isFeatured
                      ? 'border-amber-400/60 bg-amber-400/10 ring-2 ring-amber-400/40'
                      : earned
                      ? 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:border-blue-400/50 hover:bg-blue-400/5'
                      : 'border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/2 opacity-50'
                  }`}
                >
                  {/* Корона над выбранным */}
                  {isFeatured && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-base leading-none">👑</span>
                  )}
                  <span className={`text-4xl leading-none ${earned ? '' : 'grayscale'}`}>{badge.emoji}</span>
                  <span className={`text-xs font-semibold ${
                    isFeatured ? 'text-amber-500 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
                  }`}>{badge.label}</span>
                  <span className="text-center text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {earned ? badge.description : badge.hint}
                  </span>
                  {isFeatured && (
                    <span className="mt-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                      Витрина
                    </span>
                  )}
                  {!earned && (
                    <span className="mt-1 rounded-full bg-slate-200 dark:bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">
                      Не получено
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Push-уведомления ── */}
        <div className={CARD_CLS}>
          <h2 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            <Bell className="h-3.5 w-3.5" />
            Уведомления
          </h2>
          <p className="mb-5 text-xs text-slate-500">
            Получайте Push-уведомления прямо в браузере — о лайках, комментариях, новых карточках.
          </p>

          {pushStatus === 'unsupported' && (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5 px-4 py-3 text-sm text-slate-500">
              <BellOff className="h-4 w-4 shrink-0" />
              Ваш браузер не поддерживает Push-уведомления.
            </div>
          )}

          {pushStatus === 'denied' && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
              <BellOff className="h-4 w-4 shrink-0" />
              Уведомления заблокированы в настройках браузера. Разрешите их вручную в адресной строке.
            </div>
          )}

          {(pushStatus === 'default' || pushStatus === 'subscribed') && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {pushStatus === 'subscribed' ? (
                  <Bell className="h-5 w-5 text-blue-500" />
                ) : (
                  <BellOff className="h-5 w-5 text-slate-400" />
                )}
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {pushStatus === 'subscribed' ? 'Push-уведомления включены' : 'Push-уведомления выключены'}
                </span>
              </div>
              <button
                type="button"
                disabled={pushLoading}
                onClick={handleTogglePush}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  pushStatus === 'subscribed'
                    ? 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {pushLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : pushStatus === 'subscribed' ? (
                  <BellOff className="h-4 w-4" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                {pushLoading
                  ? 'Подождите...'
                  : pushStatus === 'subscribed'
                  ? 'Отключить'
                  : 'Включить уведомления'}
              </button>
            </div>
          )}
        </div>

        {/* ── Danger Zone ── */}
        <form onSubmit={handleDeleteAccount}>
          <div className="rounded-xl border border-red-900/50 bg-red-950/10 p-6">
            <h2 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
              {t('settings.dangerZone')}
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              {t('settings.dangerHint')}
            </p>

            <div className="space-y-3">
              <div>
                <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.yourEmail')}</div>
                <input
                  type="email"
                  value={deleteEmail}
                  onChange={(e) => setDeleteEmail(e.target.value)}
                  required
                  placeholder="email@example.com"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.yourPassword')}</div>
                <div className="relative">
                  <input
                    type={showDeletePassword ? "text" : "password"}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={INPUT_CLS + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={deleteLoading || !deleteEmail.trim() || !deletePassword}
                className="inline-flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/50 px-5 py-2.5 text-sm font-medium text-red-400 transition-all hover:bg-red-900/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2 className="h-4 w-4" />}
                {deleteLoading ? t('settings.deleting') : t('settings.deleteForever')}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
