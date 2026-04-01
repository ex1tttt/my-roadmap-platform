
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from 'react-i18next';
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { getToken } = useRecaptcha();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      console.log('[CLIENT] handleLogin started');
      
      // Получаем reCAPTCHA токен
      const recaptchaToken = await getToken("login");
      console.log('[CLIENT] recaptchaToken:', recaptchaToken ? 'obtained' : 'null');
      
      if (!recaptchaToken) {
        setError("Не удалось инициализировать проверку безопасности");
        return;
      }

      console.log('[CLIENT] Sending login request...');
      // Отправляем запрос на API endpoint
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, recaptchaToken }),
      });

      const data = await response.json();
      console.log('[CLIENT] Login response:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        throw new Error(data.error || "Ошибка входа");
      }

      // Успешный вход - обновляем сессию на клиенте
      console.log('[CLIENT] Login successful, refreshing session...');
      
      // Ждем обновления сессии на сервере (куки обновлены через proxy)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('[CLIENT] Redirecting to home with full reload...');
      // Используем полный редирект с обновлением страницы (не Next.js router)
      window.location.href = "/";
    } catch (err: any) {
      console.error('[CLIENT] Login error:', err);
      setError(err.message || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#020617] py-12 px-6">
      <main className="mx-auto max-w-md">
        <h1 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">{t('auth.login')}</h1>
        <form onSubmit={handleLogin} className="space-y-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          {error && <div className="text-sm text-red-600">{error}</div>}
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
          <label className="block">
            <div className="mb-1 text-sm text-gray-700 dark:text-gray-300">{t('auth.password')}</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900"
            />
          </label>

          <div className="flex items-center justify-between">
            <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={loading}>
              {loading ? t('auth.signingIn') : t('auth.login')}
            </button>
            <a href="/register" className="text-sm text-gray-600 hover:underline dark:text-gray-300">{t('nav.register')}</a>
          </div>
        </form>
      </main>
    </div>
  );
}
