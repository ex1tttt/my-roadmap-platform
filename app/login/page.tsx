
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from 'react-i18next';
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { supabase } from "@/lib/supabase";

interface SavedAccount {
  email: string
  password: string
}

// Простое шифрование для localStorage
const encryptPassword = (password: string): string => {
  return btoa(password)
}

const decryptPassword = (encrypted: string): string => {
  try {
    return atob(encrypted)
  } catch {
    return ''
  }
}

const saveAccount = (email: string, password: string) => {
  console.log('[LOGIN] Saving account:', email);
  const saved = localStorage.getItem('saved_accounts');
  let accounts: SavedAccount[] = [];
  
  if (saved) {
    try {
      accounts = JSON.parse(saved);
      console.log('[LOGIN] Found existing accounts:', accounts.length);
    } catch (e) {
      console.error('Error parsing saved accounts:', e);
    }
  }
  
  // Удаляем если уже есть, и добавляем в начало
  accounts = accounts.filter(a => a.email !== email);
  const encryptedPassword = encryptPassword(password);
  accounts.unshift({ email, password: encryptedPassword });
  
  // Сохраняем максимум 5 аккаунтов
  const toSave = accounts.slice(0, 5);
  localStorage.setItem('saved_accounts', JSON.stringify(toSave));
  console.log('[LOGIN] Saved accounts:', toSave.map(a => ({ email: a.email, hasPassword: !!a.password })));
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { getToken } = useRecaptcha();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  // Загружаем email и пароль из URL параметров если они были передан
  useEffect(() => {
    const emailParam = searchParams.get('email');
    
    console.log('[LOGIN] URL params:', { email: emailParam });
    
    if (emailParam) {
      const decodedEmail = decodeURIComponent(emailParam);
      setEmail(decodedEmail);
      
      // Пытаемся получить сохранённый пароль из sessionStorage
      const savedPassword = sessionStorage.getItem(`login_password_${decodedEmail}`);
      if (savedPassword) {
        console.log('[LOGIN] Found saved password in sessionStorage');
        setPassword(savedPassword);
        // Пытаемся войти автоматически с сохранённым паролем
        setAutoLoginAttempted(true);
      } else {
        console.log('[LOGIN] No saved password in sessionStorage');
      }
    }
  }, [searchParams]);

  // Автоматический вход если был передан пароль
  useEffect(() => {
    if (autoLoginAttempted && email && password && !loading) {
      console.log('[AUTO-LOGIN] Attempting auto-login for:', email);
      // Используем setTimeout чтобы убедиться что reCAPTCHA инициализирована
      const timer = setTimeout(() => {
        handleLogin(new Event('submit') as any, true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoLoginAttempted, email, password, loading]);

  async function handleLogin(e: React.FormEvent, isAutoLogin = false) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      console.log('[CLIENT] handleLogin started, isAutoLogin:', isAutoLogin);
      
      // Получаем reCAPTCHA токен
      let recaptchaToken = null;
      try {
        recaptchaToken = await getToken("login");
        console.log('[CLIENT] recaptchaToken:', recaptchaToken ? 'obtained' : 'null');
      } catch (err) {
        console.error('[CLIENT] reCAPTCHA error:', err);
        if (!isAutoLogin) {
          setError("Не удалось инициализировать проверку безопасности");
          setLoading(false);
          return;
        }
        // Для автоматического входа пытаемся продолжить даже без reCAPTCHA
        console.log('[AUTO-LOGIN] Continuing without reCAPTCHA');
      }
      
      if (!recaptchaToken && !isAutoLogin) {
        setError("Не удалось инициализировать проверку безопасности");
        setLoading(false);
        return;
      }

      console.log('[CLIENT] Sending login request...');
      // Отправляем запрос на API endpoint
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, recaptchaToken: recaptchaToken || "" }),
      });

      const data = await response.json();
      console.log('[CLIENT] Login response:', { status: response.status, ok: response.ok, error: data.error });

      if (!response.ok) {
        const errorMsg = data.error || "Ошибка входа";
        console.log('[CLIENT] Login failed:', errorMsg, 'isAutoLogin:', isAutoLogin);
        
        if (isAutoLogin) {
          // Если автоматический вход не удалась - показываем поле для ввода пароля
          console.log('[AUTO-LOGIN] Failed, showing password field');
          setPasswordRequired(true);
          setPassword('');
          setError("Пароль истёк или изменился. Пожалуйста введите новый пароль.");
        } else {
          throw new Error(errorMsg);
        }
        setLoading(false);
        return;
      }

      // Сохраняем аккаунт с паролем
      console.log('[CLIENT] Saving account...');
      saveAccount(email, password);

      // Успешный вход - обновляем сессию на клиенте
      console.log('[CLIENT] Login successful, refreshing session...');
      
      // Ждем обновления сессии на сервере (куки обновлены через proxy)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('[CLIENT] Redirecting to home with full reload...');
      // Используем полный редирект с обновлением страницы (не Next.js router)
      window.location.href = "/";
    } catch (err: any) {
      console.error('[CLIENT] Login error:', err);
      if (!isAutoLogin) {
        setError(err.message || "Ошибка входа");
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#020617] py-12 px-4 sm:px-6">
      <main className="mx-auto max-w-md">
        <h1 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">
          {passwordRequired ? 'Введите пароль' : t('auth.login')}
        </h1>
        <form onSubmit={handleLogin} className="space-y-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          {error && <div className="text-sm text-red-600">{error}</div>}
          
          {!passwordRequired && (
            <label className="block">
              <div className="mb-1 text-sm text-gray-700 dark:text-gray-300">{t('auth.email')}</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
          )}
          
          {passwordRequired && (
            <div className="rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
              {email}
            </div>
          )}
          
          <label className="block">
            <div className="mb-1 text-sm text-gray-700 dark:text-gray-300">{t('auth.password')}</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus={passwordRequired}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900"
            />
          </label>

          <div className="flex items-center justify-between">
            <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={loading}>
              {loading ? t('auth.signingIn') : t('auth.login')}
            </button>
            {!passwordRequired && (
              <a href="/register" className="text-sm text-gray-600 hover:underline dark:text-gray-300">{t('nav.register')}</a>
            )}
            {passwordRequired && (
              <a href="/login" className="text-sm text-gray-600 hover:underline dark:text-gray-300">Назад</a>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
