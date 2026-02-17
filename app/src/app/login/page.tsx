"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HardHat, Mail, Lock, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

// --------------------------------------------------------------------------
// バリデーション
// --------------------------------------------------------------------------

function validateEmail(value: string): string | undefined {
  if (!value) return "メールアドレスを入力してください";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    return "有効なメールアドレスを入力してください";
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (!value) return "パスワードを入力してください";
  if (value.length < 6) return "パスワードは6文字以上で入力してください";
  return undefined;
}

// --------------------------------------------------------------------------
// メインフォーム（useSearchParams を内包するため Suspense が必要）
// --------------------------------------------------------------------------

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

  // リアルタイムバリデーション（blur 時）
  const handleEmailBlur = () => setEmailError(validateEmail(email));
  const handlePasswordBlur = () => setPasswordError(validatePassword(password));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(undefined);

    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    setEmailError(emailErr);
    setPasswordError(passwordErr);
    if (emailErr || passwordErr) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (
          error.message.includes("Invalid login credentials") ||
          error.message.includes("invalid_credentials")
        ) {
          setServerError(
            "メールアドレスまたはパスワードが正しくありません。",
          );
        } else if (error.message.includes("Email not confirmed")) {
          setServerError(
            "メールアドレスの確認が完了していません。受信トレイをご確認ください。",
          );
        } else {
          setServerError(
            `ログインに失敗しました: ${error.message}`,
          );
        }
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setServerError("予期しないエラーが発生しました。しばらく経ってから再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {/* サーバーエラー */}
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}

      {/* メールアドレス */}
      <div className="relative">
        <Input
          type="email"
          label="メールアドレス"
          placeholder="you@example.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(validateEmail(e.target.value));
          }}
          onBlur={handleEmailBlur}
          error={emailError}
          className="pl-11"
          disabled={loading}
        />
        {/* メールアイコン（Inputの内部paddingに合わせて絶対配置） */}
        <Mail
          size={17}
          className="pointer-events-none absolute bottom-0 left-3.5 top-[2.85rem] -translate-y-1/2 text-gray-500"
          aria-hidden="true"
        />
      </div>

      {/* パスワード */}
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          label="パスワード"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordError) setPasswordError(validatePassword(e.target.value));
          }}
          onBlur={handlePasswordBlur}
          error={passwordError}
          className="pl-11 pr-14"
          disabled={loading}
        />
        {/* 錠前アイコン */}
        <Lock
          size={17}
          className="pointer-events-none absolute bottom-0 left-3.5 top-[2.85rem] -translate-y-1/2 text-gray-500"
          aria-hidden="true"
        />
        {/* パスワード表示切替ボタン */}
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute bottom-0 right-3.5 top-[2.85rem] -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500/60 rounded"
          aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示する"}
          tabIndex={0}
          disabled={loading}
        >
          {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </div>

      {/* ログインボタン */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        className="mt-2 w-full"
      >
        {loading ? "ログイン中..." : "ログイン"}
      </Button>
    </form>
  );
}

// --------------------------------------------------------------------------
// ページコンポーネント
// --------------------------------------------------------------------------

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-12">
      {/* 背景グロー */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-amber-600/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* カード */}
        <div className="rounded-2xl border border-gray-800/80 bg-gray-900/90 shadow-2xl shadow-black/60 backdrop-blur-sm">
          {/* ヘッダー */}
          <div className="flex flex-col items-center gap-4 border-b border-gray-800/60 px-8 py-8">
            {/* ロゴアイコン */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 shadow-lg shadow-amber-500/10">
              <HardHat size={34} className="text-amber-400" aria-hidden="true" />
            </div>

            {/* タイトル */}
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-gray-100">
                現場報告システム
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                アカウントにサインインしてください
              </p>
            </div>
          </div>

          {/* フォームエリア */}
          <div className="px-8 py-8">
            <Suspense
              fallback={
                <div className="flex flex-col gap-5">
                  {/* スケルトン */}
                  {[0, 1].map((i) => (
                    <div key={i} className="flex flex-col gap-1.5">
                      <div className="h-4 w-28 animate-pulse rounded bg-gray-800" />
                      <div className="h-12 w-full animate-pulse rounded-xl bg-gray-800" />
                    </div>
                  ))}
                  <div className="mt-2 h-14 w-full animate-pulse rounded-xl bg-gray-800" />
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>

          {/* フッター */}
          <div className="rounded-b-2xl border-t border-gray-800/60 bg-gray-950/40 px-8 py-4">
            <p className="text-center text-xs text-gray-600">
              アクセスに問題がある場合は管理者にお問い合わせください。
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
