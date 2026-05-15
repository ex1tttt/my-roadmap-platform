"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { supabase } from "@/lib/supabase";
import LoginBackdrop from "@/components/auth/LoginBackdrop";

interface SavedAccount {
  email: string;
  password: string;
}

const encryptPassword = (password: string): string => btoa(password);

const decryptPassword = (encrypted: string): string => {
  try {
    return atob(encrypted);
  } catch {
    return "";
  }
};

const saveAccount = (email: string, password: string) => {
  const saved = localStorage.getItem("saved_accounts");
  let accounts: SavedAccount[] = [];
  if (saved) {
    try {
      accounts = JSON.parse(saved);
    } catch {
      accounts = [];
    }
  }
  accounts = accounts.filter((a) => a.email !== email);
  accounts.unshift({ email, password: encryptPassword(password) });
  localStorage.setItem("saved_accounts", JSON.stringify(accounts.slice(0, 5)));
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { getToken } = useRecaptcha();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      const decodedEmail = decodeURIComponent(emailParam);
      setEmail(decodedEmail);
      const savedPassword = sessionStorage.getItem(`login_password_${decodedEmail}`);
      if (savedPassword) {
        setPassword(savedPassword);
        setAutoLoginAttempted(true);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("error") === "auth_callback") {
      setError(t("auth.callbackError"));
    }
  }, [searchParams, t]);

  const handleLogin = useCallback(
    async (e: React.FormEvent, isAutoLogin = false) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setInfo(null);

      try {
        let recaptchaToken: string | null = null;
        try {
          recaptchaToken = await getToken("login");
        } catch {
          if (!isAutoLogin) {
            setError(t("auth.securityCheckFailed"));
            setLoading(false);
            return;
          }
        }

        if (!recaptchaToken && !isAutoLogin) {
          setError(t("auth.securityCheckFailed"));
          setLoading(false);
          return;
        }

        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, recaptchaToken: recaptchaToken || "" }),
        });

        const data = await response.json();

        if (!response.ok) {
          const errorMsg = data.error || t("auth.invalidCredentials");
          if (isAutoLogin) {
            setPasswordRequired(true);
            setPassword("");
            setError(t("auth.passwordExpired"));
          } else {
            throw new Error(errorMsg);
          }
          setLoading(false);
          return;
        }

        saveAccount(email, password);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        window.location.href = "/";
      } catch (err: unknown) {
        if (!isAutoLogin) {
          setError(err instanceof Error ? err.message : t("auth.invalidCredentials"));
        }
        setLoading(false);
      }
    },
    [email, password, getToken, t]
  );

  useEffect(() => {
    if (autoLoginAttempted && email && password && !loading) {
      const timer = setTimeout(() => {
        void handleLogin(new Event("submit") as unknown as React.FormEvent, true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoLoginAttempted, email, password, loading, handleLogin]);

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError(null);
    setInfo(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError(t("auth.forgotPasswordEnterEmail"));
      return;
    }
    setResetSending(true);
    setError(null);
    setInfo(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
    });
    setResetSending(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setInfo(t("auth.resetEmailSent", { email: email.trim() }));
    setForgotMode(false);
  }

  const inputClass =
    "w-full rounded-lg border border-slate-600/80 bg-slate-950/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/25";

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] overflow-hidden bg-[#020617]">
      <LoginBackdrop />

      <div className="relative z-10 flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900/95 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10">
          <h1 className="mb-8 text-center text-3xl font-bold tracking-tight text-white">
            {passwordRequired ? t("auth.enterPassword") : t("auth.login")}
          </h1>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-200">
              {info}
            </div>
          )}

          {forgotMode ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-center text-sm text-slate-400">{t("auth.forgotPasswordHint")}</p>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">{t("auth.emailAddress")}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder={t("auth.emailPlaceholder")}
                  className={inputClass}
                />
              </label>
              <button
                type="submit"
                disabled={resetSending}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
              >
                {resetSending ? t("auth.sendingReset") : t("auth.sendResetLink")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setError(null);
                }}
                className="w-full text-sm text-slate-400 hover:text-slate-200"
              >
                {t("common.back")}
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
              {!passwordRequired && (
                <label className="block">
                  <span className="mb-1.5 block text-sm text-slate-300">{t("auth.emailAddress")}</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder={t("auth.emailPlaceholder")}
                    className={inputClass}
                  />
                </label>
              )}

              {passwordRequired && (
                <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
                  {email}
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">{t("auth.password")}</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus={passwordRequired}
                    autoComplete="current-password"
                    placeholder={t("auth.passwordPlaceholder")}
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-200"
                    aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {!passwordRequired && (
                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true);
                      setError(null);
                      setInfo(null);
                    }}
                    className="text-sm text-slate-400 transition hover:text-slate-200"
                  >
                    {t("auth.forgotPassword")}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={googleLoading || loading}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-500/70 bg-transparent py-2.5 text-sm font-medium text-white transition hover:border-slate-400 hover:bg-white/5 disabled:opacity-60"
              >
                <GoogleIcon className="h-5 w-5 shrink-0" />
                {googleLoading ? t("auth.signingIn") : t("auth.loginWithGoogle")}
              </button>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-60"
              >
                {loading ? t("auth.signingIn") : t("auth.login")}
              </button>

              {!passwordRequired ? (
                <p className="pt-2 text-center text-sm text-slate-400">
                  {t("auth.noAccount")}{" "}
                  <Link href="/register" className="font-medium text-blue-400 hover:text-blue-300">
                    {t("auth.signupCta")}
                  </Link>
                </p>
              ) : (
                <Link href="/login" className="block text-center text-sm text-slate-400 hover:text-slate-200">
                  {t("common.back")}
                </Link>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
