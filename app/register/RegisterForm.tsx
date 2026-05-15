"use client";

import React, { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { supabase } from "@/lib/supabase";
import LoginBackdrop from "@/components/auth/LoginBackdrop";
import GoogleIcon from "@/components/auth/GoogleIcon";
import { AUTH_INPUT_CLASS, AUTH_MODAL_CLASS } from "@/components/auth/authStyles";

const USERNAME_RE = /^[a-zA-Z0-9_]{1,32}$/;

type EmailIssue =
  | "invalid_format"
  | "disposable"
  | "no_mx"
  | "already_registered";

export default function RegisterForm() {
  const { t } = useTranslation();
  const { getToken } = useRecaptcha();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailIssue, setEmailIssue] = useState<EmailIssue | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const emailCheckSeq = useRef(0);

  const issueMessage = useCallback(
    (issue: EmailIssue) => {
      switch (issue) {
        case "invalid_format":
          return t("auth.emailInvalidFormat");
        case "disposable":
          return t("auth.emailDisposable");
        case "no_mx":
          return t("auth.emailNoMx");
        case "already_registered":
          return t("auth.emailAlreadyRegistered");
        default:
          return t("auth.emailInvalidFormat");
      }
    },
    [t]
  );

  const validateEmail = useCallback(
    async (raw: string): Promise<{ ok: true } | { ok: false; issue: EmailIssue }> => {
      const trimmed = raw.trim();
      if (!trimmed) {
        setEmailIssue("invalid_format");
        return { ok: false, issue: "invalid_format" };
      }

      const seq = ++emailCheckSeq.current;
      setEmailChecking(true);
      setEmailIssue(null);

      try {
        const res = await fetch("/api/auth/validate-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        });
        const data = await res.json();
        if (seq !== emailCheckSeq.current) {
          return { ok: false, issue: "invalid_format" };
        }

        if (!res.ok || data.valid === false) {
          const issue = (data.issue as EmailIssue) || "invalid_format";
          setEmailIssue(issue);
          return { ok: false, issue };
        }
        setEmailIssue(null);
        return { ok: true };
      } catch {
        if (seq === emailCheckSeq.current) {
          setEmailIssue("invalid_format");
        }
        return { ok: false, issue: "invalid_format" };
      } finally {
        if (seq === emailCheckSeq.current) {
          setEmailChecking(false);
        }
      }
    },
    []
  );

  async function handleGoogleSignup() {
    setGoogleLoading(true);
    setError(null);
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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!USERNAME_RE.test(username.trim())) {
        setError(t("profile.usernameInvalid"));
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError(t("auth.passwordsMismatch"));
        setLoading(false);
        return;
      }

      const emailCheck = await validateEmail(email);
      if (!emailCheck.ok) {
        setError(issueMessage(emailCheck.issue));
        setLoading(false);
        return;
      }

      const recaptchaToken = await getToken("register");
      if (!recaptchaToken) {
        setError(t("auth.securityCheckFailed"));
        setLoading(false);
        return;
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, username: username.trim(), recaptchaToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.issue) {
          const issue = data.issue as EmailIssue;
          setEmailIssue(issue);
          setError(issueMessage(issue));
        } else {
          setError(data.error || t("auth.registerError", { message: "" }));
        }
        setLoading(false);
        return;
      }

      if (data.needsEmailConfirmation) {
        setPendingEmail(data.email || email);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
      window.location.href = "/";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.registerError", { message: "" }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] overflow-hidden bg-[#020617]">
      <LoginBackdrop />

      <div className="relative z-10 flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10 sm:px-6">
        <div className={AUTH_MODAL_CLASS}>
          <h1 className="mb-8 text-center text-3xl font-bold tracking-tight text-white">{t("auth.register")}</h1>

          {pendingEmail ? (
            <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-sm font-medium text-emerald-100">{t("auth.checkEmailTitle")}</p>
              <p className="text-sm text-emerald-100/90">{t("auth.checkEmailBody", { email: pendingEmail })}</p>
              <p className="text-xs text-emerald-200/80">{t("auth.checkEmailSpamHint")}</p>
              <Link
                href="/login"
                className="mt-2 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
              >
                {t("auth.goToLogin")}
              </Link>
            </div>
          ) : (
            <form onSubmit={(e) => void handleRegister(e)} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
                  {error}
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">{t("auth.emailAddress")}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailIssue(null);
                    setError(null);
                  }}
                  onBlur={() => void validateEmail(email)}
                  required
                  autoComplete="email"
                  placeholder={t("auth.emailPlaceholder")}
                  className={AUTH_INPUT_CLASS}
                  aria-invalid={emailIssue != null}
                />
                {emailChecking && (
                  <p className="mt-1 text-xs text-slate-500">{t("auth.emailChecking")}</p>
                )}
                {emailIssue && !emailChecking && (
                  <p className="mt-1 text-xs text-red-400">{issueMessage(emailIssue)}</p>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">{t("auth.username")}</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  maxLength={32}
                  required
                  autoComplete="username"
                  placeholder={t("settings.usernamePlaceholder")}
                  className={AUTH_INPUT_CLASS}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">{t("auth.password")}</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder={t("auth.passwordPlaceholder")}
                    className={`${AUTH_INPUT_CLASS} pr-11`}
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

              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">{t("auth.confirmPasswordLabel")}</span>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder={t("auth.confirmPasswordPlaceholder")}
                    className={`${AUTH_INPUT_CLASS} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-200"
                    aria-label={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <button
                type="button"
                onClick={() => void handleGoogleSignup()}
                disabled={googleLoading || loading}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-500/70 bg-transparent py-2.5 text-sm font-medium text-white transition hover:border-slate-400 hover:bg-white/5 disabled:opacity-60"
              >
                <GoogleIcon className="h-5 w-5 shrink-0" />
                {googleLoading ? t("auth.registering") : t("auth.loginWithGoogle")}
              </button>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-60"
              >
                {loading ? t("auth.registering") : t("auth.register")}
              </button>

              <p className="pt-2 text-center text-sm text-slate-400">
                {t("auth.hasAccount")}{" "}
                <Link href="/login" className="font-medium text-blue-400 hover:text-blue-300">
                  {t("auth.loginCta")}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
