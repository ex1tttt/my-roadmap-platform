"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import UserAvatar from "@/components/UserAvatar";
import { Home, Save, Camera, Mail, Lock, Eye, EyeOff, Trash2, Loader2, Globe, ChevronDown, Bell, BellOff, ShieldBan, User } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useHasMounted } from "@/hooks/useHasMounted";
import { saveLanguage, type SupportedLanguage } from "@/lib/i18n";
import { subscribeUser, unsubscribeUser, getActiveSubscription, getPushStatus, type PushStatus } from "@/lib/push";

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

function BlockedUsersSection({
  t, blockedUsers, blocksLoading, unblockingId, onUnblock,
}: {
  t: (key: string, opts?: any) => string;
  blockedUsers: { id: string; blocked_id: string; username: string; avatar: string | null }[];
  blocksLoading: boolean;
  unblockingId: string | null;
  onUnblock: (blockId: string, blockedId: string) => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6">
      <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        <ShieldBan className="h-3.5 w-3.5" />
        {t('block.settingsTitle')}
      </h2>
      {blocksLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : blockedUsers.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">{t('block.settingsEmpty')}</p>
      ) : (
        <ul className="space-y-3">
          {blockedUsers.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3">
              <Link href={`/profile/${b.blocked_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <UserAvatar username={b.username} avatarUrl={b.avatar} size={36} />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{b.username}</span>
              </Link>
              <button
                onClick={() => onUnblock(b.id, b.blocked_id)}
                disabled={unblockingId === b.id}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 transition-all hover:border-green-500/40 hover:bg-green-950/30 hover:text-green-400 disabled:opacity-50"
              >
                {unblockingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {t('block.unblockInSettings')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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

  // Настройки типов уведомлений (localStorage)
  const NOTIF_TYPES = [
    { key: 'like',         label: 'Лайки' },
    { key: 'comment',      label: 'Комментарии' },
    { key: 'comment_like', label: 'Лайки на комментарии' },
    { key: 'follow',       label: 'Новые подписчики' },
    { key: 'mention',      label: 'Упоминания' },
    { key: 'new_card',     label: 'Новые карточки от подписок' },
  ];
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    ['like','comment','comment_like','follow','mention','new_card'].forEach(k => { defaults[k] = true; });
    return defaults;
  });
  const [notifSaved, setNotifSaved] = useState(false);

  // Заблокированные пользователи
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; blocked_id: string; username: string; avatar: string | null }[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

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
        // Загружаем настройки типов push-уведомлений из БД (приоритет) или localStorage
        if (data.push_notif_prefs && typeof data.push_notif_prefs === 'object') {
          setNotifPrefs((prev) => ({ ...prev, ...data.push_notif_prefs }));
        } else {
          try {
            const saved = localStorage.getItem('notif_type_prefs');
            if (saved) setNotifPrefs(JSON.parse(saved));
          } catch {}
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

      // Загружаем заблокированных пользователей
      setBlocksLoading(true);
      const { data: blocks } = await supabase
        .from('user_blocks')
        .select('id, blocked_id')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });
      if (blocks && blocks.length > 0) {
        const blockedIds = blocks.map((b: any) => b.blocked_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar')
          .in('id', blockedIds);
        const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
        setBlockedUsers(blocks.map((b: any) => ({
          id: b.id,
          blocked_id: b.blocked_id,
          username: profileMap.get(b.blocked_id)?.username ?? b.blocked_id,
          avatar: profileMap.get(b.blocked_id)?.avatar ?? null,
        })));
      }
      setBlocksLoading(false);
    }

    loadProfile();
  }, [router]);

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
      if (!/^[a-zA-Z0-9_]{1,32}$/.test(trimmed)) {
        toast.error("Ник может содержать только латинские буквы, цифры и знак _. Пробелы запрещены.");
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
        setPasswordError(t('settings.passwordMismatch'));
        return;
      }
      // Проверяем текущий пароль перед сменой
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });
      if (signInError) {
        setPasswordError(t('passwordChange.wrongPassword'));
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t('passwordChange.success'));
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
        toast.error(t('passwordChange.wrongEmailOrPassword'));
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

  // Активная секция сайдбара
  const [activeSection, setActiveSection] = useState<'profile' | 'notifications' | 'blocked' | 'security'>('profile');

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

  const NAV_ITEMS = [
    { id: 'profile' as const, label: mounted ? t('nav.profile') : 'Профиль', icon: User },
    { id: 'notifications' as const, label: mounted ? t('pushNotifications.sectionTitle') : 'Уведомления', icon: Bell },
    { id: 'blocked' as const, label: mounted ? t('block.settingsTitle') : 'Заблокированные', icon: ShieldBan },
    { id: 'security' as const, label: mounted ? t('settings.security') : 'Безопасность и вход', icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex gap-6">

          {/* ── Сайдбар ── */}
          <aside className="w-52 shrink-0">
            {/* На главную над сайдбаром */}
            <Link
              href="/"
              className="mb-3 flex w-full items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 transition-colors hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <Home className="h-4 w-4 shrink-0" />
              {mounted ? t('nav.backToHome') : 'На главную'}
            </Link>

            <nav className="sticky top-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 py-2 overflow-hidden">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                    activeSection === id
                      ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
          </aside>

          {/* ── Контент ── */}
          <main className="flex-1 min-w-0 space-y-6">

            {/* ─── ПРОФИЛЬ ─── */}
            {activeSection === 'profile' && (
              <>
                {/* Аватар */}
                <div className={CARD_CLS}>
                  <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">{mounted ? t('settings.avatar') : 'Аватар'}</h2>
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
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                        {uploading ? (mounted ? t('settings.uploading') : '...') : (mounted ? t('settings.changeAvatar') : 'Изменить')}
                      </button>
                      {avatarUrl && (
                        <button type="button" onClick={() => setAvatarUrl(null)} className="text-left text-xs text-red-400 hover:text-red-300">
                          {mounted ? t('settings.deleteAvatarLabel') : 'Удалить аватар'}
                        </button>
                      )}
                      <p className="text-xs text-slate-500">{mounted ? t('settings.avatarHint') : 'PNG, JPG до 5 МБ'}</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </div>
                </div>

                {/* Данные профиля */}
                <form onSubmit={handleSaveProfile}>
                  <div className={CARD_CLS}>
                    <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">{mounted ? t('settings.profileInfo') : 'Информация'}</h2>
                    <label className="block">
                      <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{mounted ? t('settings.username') : 'Никнейм'}</div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                        required
                        maxLength={32}
                        placeholder="только буквы, цифры, _"
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="mt-4 block">
                      <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{mounted ? t('settings.email') : 'Email'}</div>
                      <input
                        type="email"
                        value={userEmail}
                        readOnly
                        className="box-border w-full cursor-not-allowed rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 outline-none"
                      />
                      <p className="mt-1.5 text-xs text-slate-500">{mounted ? t('settings.emailReadonlyHint') : ''}</p>
                    </label>
                    <label className="mt-4 block">
                      <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{mounted ? t('settings.bio') : 'О себе'}</div>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        maxLength={200}
                        rows={3}
                        placeholder={mounted ? t('settings.bioPlaceholder') : ''}
                        className="box-border w-full resize-none rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <p className="mt-1 text-right text-xs text-slate-500">
                        <span className={bio.length >= 180 ? 'text-amber-400' : ''}>{bio.length}</span>/200
                      </p>
                    </label>
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Globe className="h-4 w-4" />
                        {mounted ? t('settings.language_label') : 'Язык'}
                      </div>
                      <div className="relative">
                        <select
                          value={language}
                          onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                          className={INPUT_CLS + " cursor-pointer appearance-none pr-10"}
                        >
                          {LANGUAGE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button type="submit" disabled={saving || uploading} className={BTN_PRIMARY}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {saving ? (mounted ? t('settings.saving') : '...') : (mounted ? t('settings.save_button') : 'Сохранить')}
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}

            {/* ─── УВЕДОМЛЕНИЯ ─── */}
            {activeSection === 'notifications' && (
              <div className="space-y-6">
                {/* Push-уведомления */}
                <div className={CARD_CLS}>
                  <h2 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    <Bell className="h-3.5 w-3.5" />
                    {mounted ? t('pushNotifications.sectionTitle') : 'Push-уведомления'}
                  </h2>
                  <p className="mb-5 text-xs text-slate-500">{mounted ? t('pushNotifications.sectionDesc') : ''}</p>

                  {pushStatus === 'unsupported' && (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5 px-4 py-3 text-sm text-slate-500">
                      <BellOff className="h-4 w-4 shrink-0" />
                      {mounted ? t('pushNotifications.unsupported') : ''}
                    </div>
                  )}
                  {pushStatus === 'denied' && (
                    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
                      <BellOff className="h-4 w-4 shrink-0" />
                      {mounted ? t('pushNotifications.denied') : ''}
                    </div>
                  )}
                  {(pushStatus === 'default' || pushStatus === 'subscribed') && (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {pushStatus === 'subscribed'
                          ? <Bell className="h-5 w-5 text-blue-500" />
                          : <BellOff className="h-5 w-5 text-slate-400" />}
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {mounted ? (pushStatus === 'subscribed' ? t('pushNotifications.enabled') : t('pushNotifications.disabled')) : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={pushLoading}
                        onClick={handleTogglePush}
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
                          pushStatus === 'subscribed'
                            ? 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                            : 'bg-blue-600 text-white hover:bg-blue-500'
                        }`}
                      >
                        {pushLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : pushStatus === 'subscribed' ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                        {mounted ? (pushLoading ? t('pushNotifications.waiting') : pushStatus === 'subscribed' ? t('pushNotifications.disable') : t('pushNotifications.enable')) : ''}
                      </button>
                    </div>
                  )}
                </div>

                {/* Типы уведомлений */}
                <div className={CARD_CLS}>
                  <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    <Bell className="h-3.5 w-3.5" />
                    Типы уведомлений
                  </h2>
                  <p className="mb-4 text-xs text-slate-500">Выберите, о чём хотите получать уведомления</p>
                  <div className="space-y-3">
                    {NOTIF_TYPES.map(({ key, label }) => (
                      <label key={key} className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={notifPrefs[key] ?? true}
                          onChange={(e) => setNotifPrefs(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-blue-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        try { localStorage.setItem('notif_type_prefs', JSON.stringify(notifPrefs)); } catch {}
                        if (profile?.id) {
                          await supabase
                            .from('profiles')
                            .update({ push_notif_prefs: notifPrefs })
                            .eq('id', profile.id);
                        }
                        // Сообщаем NotificationBell об изменении настроек без перезагрузки
                        window.dispatchEvent(new CustomEvent('notif-prefs-updated', { detail: notifPrefs }));
                        setNotifSaved(true);
                        setTimeout(() => setNotifSaved(false), 2000);
                      }}
                      className={BTN_PRIMARY}
                    >
                      {notifSaved ? <span className="text-green-300">✓ Сохранено</span> : <><Save className="h-4 w-4" /> Сохранить</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── ЗАБЛОКИРОВАННЫЕ ─── */}
            {activeSection === 'blocked' && (
              <BlockedUsersSection
                t={t}
                blockedUsers={blockedUsers}
                blocksLoading={blocksLoading}
                unblockingId={unblockingId}
                onUnblock={async (blockId, blockedId) => {
                  setUnblockingId(blockId);
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return;
                  const { error } = await supabase
                    .from('user_blocks')
                    .delete()
                    .eq('blocker_id', user.id)
                    .eq('blocked_id', blockedId);
                  if (!error) {
                    setBlockedUsers((prev) => prev.filter((b) => b.id !== blockId));
                    toast.success(t('block.unblocked'));
                  } else {
                    toast.error(t('common.error'));
                  }
                  setUnblockingId(null);
                }}
              />
            )}

            {/* ─── БЕЗОПАСНОСТЬ ─── */}
            {activeSection === 'security' && (
              <>
                {/* Изменить email */}
                <form onSubmit={handleEmailUpdate}>
                  <div className={CARD_CLS}>
                    <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                      <Mail className="h-3.5 w-3.5" />
                      {mounted ? t('settings.changeEmail') : 'Изменить Email'}
                    </h2>
                    <label className="block">
                      <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{mounted ? t('settings.newEmail') : 'Новый Email'}</div>
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
                        {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        {mounted ? (emailSaving ? t('settings.sending') : t('settings.updateEmail')) : 'Обновить'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Изменить пароль */}
                <form onSubmit={handlePasswordUpdate}>
                  <div className={CARD_CLS}>
                    <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                      <Lock className="h-3.5 w-3.5" />
                      {mounted ? t('settings.security') : 'Безопасность'}
                    </h2>
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{mounted ? t('settings.currentPassword') : 'Текущий пароль'}</div>
                        <div className="relative">
                          <input type={showCurrent ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required placeholder="••••••••" className={INPUT_CLS + " pr-10"} />
                          <button type="button" onClick={() => setShowCurrent((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{mounted ? t('settings.newPassword') : 'Новый пароль'}</div>
                        <div className="relative">
                          <input type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="••••••••" className={INPUT_CLS + " pr-10"} />
                          <button type="button" onClick={() => setShowNew((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{mounted ? t('settings.confirmPassword') : 'Подтвердите пароль'}</div>
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
                          <button type="button" onClick={() => setShowConfirm((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {confirmPassword && newPassword !== confirmPassword && (
                          <p className="mt-1 text-xs text-red-400">{mounted ? t('settings.passwordMismatch') : ''}</p>
                        )}
                      </div>
                    </div>
                    {passwordError && (
                      <div className="mt-3 rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-400">{passwordError}</div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <button type="submit" disabled={passwordSaving || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword} className={BTN_PRIMARY}>
                        {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                        {mounted ? (passwordSaving ? t('settings.saving') : t('settings.changePassword')) : 'Сменить'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Удалить аккаунт */}
                <form onSubmit={handleDeleteAccount}>
                  <div className="rounded-xl border border-red-900/50 bg-red-950/10 p-6">
                    <h2 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                      {mounted ? t('settings.dangerZone') : 'Удалить аккаунт'}
                    </h2>
                    <p className="mb-4 text-xs text-slate-500">{mounted ? t('settings.dangerHint') : ''}</p>
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{mounted ? t('settings.yourEmail') : 'Email'}</div>
                        <input type="email" value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} required placeholder="email@example.com" className={INPUT_CLS} />
                      </div>
                      <div>
                        <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{mounted ? t('settings.yourPassword') : 'Пароль'}</div>
                        <div className="relative">
                          <input type={showDeletePassword ? "text" : "password"} value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} required placeholder="••••••••" className={INPUT_CLS + " pr-10"} />
                          <button type="button" onClick={() => setShowDeletePassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                            {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button type="submit" disabled={deleteLoading || !deleteEmail.trim() || !deletePassword} className="inline-flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/50 px-5 py-2.5 text-sm font-medium text-red-400 transition-all hover:bg-red-900/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50">
                        {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        {mounted ? (deleteLoading ? t('settings.deleting') : t('settings.deleteForever')) : 'Удалить'}
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}
