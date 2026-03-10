"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, AlertTriangle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

function validateEmail(v: string) {
  if (!v) return "メールアドレスを入力してください";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "有効なメールアドレスを入力してください";
}

function validatePassword(v: string) {
  if (!v) return "パスワードを入力してください";
  if (v.length < 6) return "6文字以上で入力してください";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(undefined);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Invalid login credentials") || error.message.includes("invalid_credentials")) {
          setServerError("メールアドレスまたはパスワードが正しくありません");
        } else {
          setServerError(`ログインに失敗しました: ${error.message}`);
        }
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setServerError("予期しないエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {serverError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3.5 text-[13px] text-red-400">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Email */}
      <div>
        <label className="text-[13px] font-medium text-white/50 mb-1.5 block">メールアドレス</label>
        <div className="relative">
          <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(validateEmail(e.target.value)); }}
            onBlur={() => setEmailError(validateEmail(email))}
            disabled={loading}
            className="w-full min-h-[48px] pl-11 pr-4 rounded-xl border border-white/[0.1] bg-white/[0.05] text-[15px] text-white/90 placeholder-white/25 focus:outline-none focus:border-[#00D9FF]/50 focus:ring-1 focus:ring-[#00D9FF]/20 transition-all disabled:opacity-40"
          />
        </div>
        {emailError && <p className="text-[12px] text-red-400 mt-1.5">{emailError}</p>}
      </div>

      {/* Password */}
      <div>
        <label className="text-[13px] font-medium text-white/50 mb-1.5 block">パスワード</label>
        <div className="relative">
          <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(validatePassword(e.target.value)); }}
            onBlur={() => setPasswordError(validatePassword(password))}
            disabled={loading}
            className="w-full min-h-[48px] pl-11 pr-14 rounded-xl border border-white/[0.1] bg-white/[0.05] text-[15px] text-white/90 placeholder-white/25 focus:outline-none focus:border-[#00D9FF]/50 focus:ring-1 focus:ring-[#00D9FF]/20 transition-all disabled:opacity-40"
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors w-8 h-8 flex items-center justify-center"
            tabIndex={0}
            disabled={loading}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {passwordError && <p className="text-[12px] text-red-400 mt-1.5">{passwordError}</p>}
      </div>

      <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-2 w-full">
        {loading ? "ログイン中..." : "ログイン"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#1a1a1a] px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#00D9FF]/15 flex items-center justify-center mx-auto mb-4">
            <Building2 size={24} className="text-[#00D9FF]" />
          </div>
          <h1 className="text-[24px] font-bold text-white/95 mb-1">現場報告システム</h1>
          <p className="text-[14px] text-white/35">アカウントにサインイン</p>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <Suspense fallback={
            <div className="flex flex-col gap-5">
              {[0, 1].map((i) => (
                <div key={i}>
                  <div className="h-4 w-24 rounded bg-white/[0.04] mb-2" />
                  <div className="h-12 w-full rounded-xl bg-white/[0.04]" />
                </div>
              ))}
              <div className="h-12 w-full rounded-xl bg-white/[0.04] mt-2" />
            </div>
          }>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-[11px] text-white/20 mt-6">
          アクセスに問題がある場合は管理者にお問い合わせください
        </p>
      </div>
    </main>
  );
}
