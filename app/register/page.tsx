"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      const userId = data?.user?.id;
      if (userId) {
        // create profile row
        const { error: profileError } = await supabase.from("profiles").insert({ id: userId, username });
        if (profileError) console.error("Profile insert error", profileError);
      }

      // Redirect after sign up (may require email confirmation depending on Supabase settings)
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
        <h1 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">Регистрация</h1>
        <form onSubmit={handleRegister} className="space-y-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <label className="block">
            <div className="mb-1 text-sm text-gray-700 dark:text-gray-300">Имя пользователя</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-sm text-gray-700 dark:text-gray-300">Email</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-sm text-gray-700 dark:text-gray-300">Password</div>
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
              {loading ? "Регистрация..." : "Зарегистрироваться"}
            </button>
            <a href="/login" className="text-sm text-gray-600 hover:underline dark:text-gray-300">Уже есть аккаунт?</a>
          </div>
        </form>
      </main>
    </div>
  );
}
