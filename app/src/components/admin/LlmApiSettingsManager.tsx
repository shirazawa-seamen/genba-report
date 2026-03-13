"use client";

import { useState, useTransition } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import {
  deleteClaudeApiKey,
  saveClaudeApiKey,
} from "@/app/(dashboard)/admin/llm-settings/actions";

interface SettingMeta {
  key: string;
  last_four: string | null;
  updated_at: string;
}

export function LlmApiSettingsManager({
  initialClaudeMeta,
}: {
  initialClaudeMeta: SettingMeta | null;
}) {
  const [apiKey, setApiKey] = useState("");
  const [meta, setMeta] = useState(initialClaudeMeta);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveClaudeApiKey(apiKey);
      if (!result.success) {
        setMessage({
          type: "error",
          text: result.error || "APIキーの保存に失敗しました",
        });
        return;
      }

      setApiKey("");
      setMeta(result.meta ?? null);
      setMessage({
        type: "success",
        text: "Claude APIキーを保存しました",
      });
    });
  };

  const handleDelete = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await deleteClaudeApiKey();
      if (!result.success) {
        setMessage({
          type: "error",
          text: result.error || "APIキーの削除に失敗しました",
        });
        return;
      }

      setMeta(null);
      setApiKey("");
      setMessage({
        type: "success",
        text: "Claude APIキーを削除しました",
      });
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-800">
              Claude APIキー
            </h2>
            <p className="mt-1 text-[12px] text-gray-400">
              入力値はブラウザへ再表示せず、DB には暗号化して保存します。
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50">
            <KeyRound size={18} className="text-[#0EA5E9]" />
          </div>
        </div>

        {message ? (
          <div
            className={`mb-4 rounded-lg border px-3 py-2 text-[12px] ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                : "border-red-200 bg-red-50 text-red-400"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          {meta ? (
            <div className="space-y-1 text-[12px] text-gray-500">
              <p>保存状態: 設定済み</p>
              <p>表示: ********{meta.last_four ?? ""}</p>
              <p>
                更新日時: {new Date(meta.updated_at).toLocaleString("ja-JP")}
              </p>
            </div>
          ) : (
            <p className="text-[12px] text-gray-500">保存状態: 未設定</p>
          )}
        </div>

        <div className="space-y-3">
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-ant-..."
            className="min-h-[44px] w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-700 shadow-sm transition-all focus:border-[#0EA5E9]/50 focus:outline-none"
          />
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-[#0EA5E9] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#0284C7] disabled:opacity-50"
            >
              {isPending ? "保存中..." : "保存"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending || !meta}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 text-[14px] font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              <Trash2 size={14} />
              削除
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
