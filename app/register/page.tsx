
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from 'react-i18next';
import { useRecaptcha } from "@/hooks/useRecaptcha";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { getToken } = useRecaptcha();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const USERNAME_RE = /^[a-zA-Z0-9_]{1,32}$/;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!USERNAME_RE.test(username.trim())) {
        setError("Ник может содержать только латинские буквы, цифры и знак _. Пробелы и спецсимволы запрещены.");
        setLoading(false);
        return;
      }

      // Получаем reCAPTCHA токен
      const recaptchaToken = await getToken("register");
      if (!recaptchaToken) {
        setError("Не удалось инициализировать проверку безопасности");
        return;
      }

      // Отправляем запрос на API endpoint
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, username, recaptchaToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ошибка регистрации");
      }

      // Успешная регистрация
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#020617] py-12 px-6">
      <main className="mx-auto max-w-md">
        <h1 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">{t('auth.register')}</h1>
        <form onSubmit={handleRegister} className="space-y-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <label className="block">
            <div className="mb-1 text-sm text-gray-700 dark:text-gray-300">{t('auth.username')}</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              maxLength={32}
              required
              placeholder="только буквы, цифры, _"
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
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
            <button type="submit" className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60" disabled={loading}>
              {loading ? t('auth.registering') : t('auth.register')}
            </button>
            <a href="/login" className="text-sm text-gray-600 hover:underline dark:text-gray-300">{t('auth.hasAccount')}</a>
          </div>
        </form>
      </main>
    </div>
  );
}
