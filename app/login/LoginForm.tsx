"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDeferredT } from "@/hooks/useDeferredT";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { supabase } from "@/lib/supabase";
import LoginBackdrop from "@/components/auth/LoginBackdrop";
import GoogleIcon from "@/components/auth/GoogleIcon";
import {
  AUTH_HEADING_CLASS,
  AUTH_ICON_BUTTON_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_MODAL_CLASS,
  AUTH_MUTED_CLASS,
  AUTH_PAGE_CLASS,
  AUTH_SECONDARY_BUTTON_CLASS,
} from "@/components/auth/authStyles";

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

function authRedirectOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) {
    return /^https?:\/\//i.test(fromEnv) ? fromEnv : `https://${fromEnv}`;
  }
  return "";
}

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

export default function LoginForm() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const dt = useDeferredT();
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
      redirectTo: `${authRedirectOrigin()}/auth/callback?next=/reset-password`,
    });
    setResetSending(false);
    if (resetError) {
      const normalizedMessage = resetError.message.toLowerCase();
      if (
        normalizedMessage.includes("rate limit") ||
        normalizedMessage.includes("too many") ||
        normalizedMessage.includes("exceeded")
      ) {
        setError(t("auth.resetEmailRateLimit"));
      } else {
        setError(t("auth.resetEmailError"));
      }
      return;
    }
    setInfo(t("auth.resetEmailSent", { email: email.trim() }));
    setForgotMode(false);
  }

  return (
    <div className={AUTH_PAGE_CLASS}>
      <LoginBackdrop />

      <div className="relative z-10 flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10 sm:px-6">
        <div className={AUTH_MODAL_CLASS}>
          <h1 className={AUTH_HEADING_CLASS}>
            {passwordRequired ? dt("auth.enterPassword") : dt("auth.login")}
          </h1>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
              {info}
            </div>
          )}

          {forgotMode ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className={`text-center text-sm ${AUTH_MUTED_CLASS}`}>{dt("auth.forgotPasswordHint")}</p>
              <label className="block">
                <span className={AUTH_LABEL_CLASS}>{dt("auth.emailAddress")}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder={dt("auth.emailPlaceholder")}
                  className={AUTH_INPUT_CLASS}
                />
              </label>
              <button
                type="submit"
                disabled={resetSending}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
              >
                {resetSending ? dt("auth.sendingReset") : dt("auth.sendResetLink")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setError(null);
                }}
                className={`w-full text-sm ${AUTH_MUTED_CLASS} hover:text-slate-900 dark:hover:text-slate-200`}
              >
                {dt("common.back")}
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
              {!passwordRequired && (
                <label className="block">
                  <span className={AUTH_LABEL_CLASS}>{dt("auth.emailAddress")}</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder={dt("auth.emailPlaceholder")}
                    className={AUTH_INPUT_CLASS}
                  />
                </label>
              )}

              {passwordRequired && (
                <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-300">
                  {email}
                </div>
              )}

              <label className="block">
                <span className={AUTH_LABEL_CLASS}>{dt("auth.password")}</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus={passwordRequired}
                    autoComplete="current-password"
                    placeholder={dt("auth.passwordPlaceholder")}
                    className={`${AUTH_INPUT_CLASS} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className={AUTH_ICON_BUTTON_CLASS}
                    aria-label={showPassword ? dt("auth.hidePassword") : dt("auth.showPassword")}
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
                    className={`text-sm transition ${AUTH_MUTED_CLASS} hover:text-slate-900 dark:hover:text-slate-200`}
                  >
                    {dt("auth.forgotPassword")}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={googleLoading || loading}
                className={AUTH_SECONDARY_BUTTON_CLASS}
              >
                <GoogleIcon className="h-5 w-5 shrink-0" />
                {googleLoading ? dt("auth.signingIn") : dt("auth.loginWithGoogle")}
              </button>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-60"
              >
                {loading ? dt("auth.signingIn") : dt("auth.login")}
              </button>

              {!passwordRequired ? (
                <p className={`pt-2 text-center text-sm ${AUTH_MUTED_CLASS}`}>
                  {dt("auth.noAccount")}{" "}
                  <Link href="/register" className="font-medium text-blue-400 hover:text-blue-300">
                    {dt("auth.signupCta")}
                  </Link>
                </p>
              ) : (
                <Link href="/login" className={`block text-center text-sm ${AUTH_MUTED_CLASS} hover:text-slate-900 dark:hover:text-slate-200`}>
                  {dt("common.back")}
                </Link>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
