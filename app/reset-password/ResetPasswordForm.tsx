"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import LoginBackdrop from "@/components/auth/LoginBackdrop";
import {
  AUTH_HEADING_CLASS,
  AUTH_ICON_BUTTON_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_MODAL_CLASS,
  AUTH_MUTED_CLASS,
  AUTH_PAGE_CLASS,
} from "@/components/auth/authStyles";
import { useDeferredT } from "@/hooks/useDeferredT";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordForm() {
  const { t } = useTranslation();
  const dt = useDeferredT();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setHasSession(Boolean(session));
      setCheckingSession(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t("auth.passwordMinLength"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.passwordsMismatch"));
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(t("auth.resetPasswordError"));
      return;
    }

    window.location.href = "/";
  }

  return (
    <div className={AUTH_PAGE_CLASS}>
      <LoginBackdrop />

      <div className="relative z-10 flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10 sm:px-6">
        <div className={AUTH_MODAL_CLASS}>
          <h1 className={AUTH_HEADING_CLASS}>{dt("auth.newPasswordTitle")}</h1>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          {checkingSession ? (
            <p className={`text-center text-sm ${AUTH_MUTED_CLASS}`}>{dt("common.loading")}</p>
          ) : !hasSession ? (
            <div className="space-y-4 text-center">
              <p className={`text-sm ${AUTH_MUTED_CLASS}`}>{dt("auth.resetLinkInvalid")}</p>
              <Link href="/login" className="font-medium text-blue-500 hover:text-blue-400">
                {dt("auth.goToLogin")}
              </Link>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <label className="block">
                <span className={AUTH_LABEL_CLASS}>{dt("auth.newPassword")}</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder={dt("auth.newPasswordPlaceholder")}
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

              <label className="block">
                <span className={AUTH_LABEL_CLASS}>{dt("auth.confirmNewPassword")}</span>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder={dt("auth.confirmNewPasswordPlaceholder")}
                    className={`${AUTH_INPUT_CLASS} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    className={AUTH_ICON_BUTTON_CLASS}
                    aria-label={showConfirmPassword ? dt("auth.hidePassword") : dt("auth.showPassword")}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-60"
              >
                {saving ? dt("auth.savingPassword") : dt("auth.resetPasswordSubmit")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
