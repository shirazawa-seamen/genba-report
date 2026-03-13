"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type { CompanyRecord } from "@/lib/companies";
import {
  createCompany,
  deleteCompany,
  updateCompany,
} from "@/app/(dashboard)/admin/company-actions";

export function CompanyManager({
  initialCompanies,
}: {
  initialCompanies: CompanyRecord[];
}) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createCompany(newName);
      if (!result.success || !result.companies) {
        showMessage("error", result.error || "会社名の追加に失敗しました");
        return;
      }
      setCompanies(result.companies);
      setNewName("");
      showMessage("success", "会社名を追加しました");
    });
  };

  const handleSave = () => {
    if (!editingId) return;
    startTransition(async () => {
      const result = await updateCompany({
        companyId: editingId,
        name: editingName,
      });
      if (!result.success || !result.companies) {
        showMessage("error", result.error || "会社名の更新に失敗しました");
        return;
      }
      setCompanies(result.companies);
      setEditingId(null);
      setEditingName("");
      showMessage("success", "会社名を更新しました");
    });
  };

  const handleDelete = (companyId: string) => {
    startTransition(async () => {
      const result = await deleteCompany(companyId);
      if (!result.success || !result.companies) {
        showMessage("error", result.error || "会社名の削除に失敗しました");
        return;
      }
      setCompanies(result.companies);
      if (editingId === companyId) {
        setEditingId(null);
        setEditingName("");
      }
      showMessage("success", "会社名を削除しました");
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-800">会社を追加</h2>
            <p className="mt-1 text-[12px] text-gray-400">
              ユーザーと現場で共通利用する会社名マスターです。
            </p>
          </div>
          <span className="rounded-full border border-gray-200 px-3 py-1 text-[11px] text-gray-400">
            {companies.length}件
          </span>
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

        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="例：株式会社サンプル"
            className="min-h-[44px] flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-700 shadow-sm transition-all focus:border-[#0EA5E9]/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#0EA5E9] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#0284C7] disabled:opacity-50"
          >
            <Plus size={16} />
            追加
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold text-gray-800">会社一覧</h2>
        </div>

        {companies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-[13px] text-gray-400">
            会社名がまだ登録されていません。
          </div>
        ) : (
          <div className="space-y-2.5">
            {companies.map((company) => {
              const isEditing = editingId === company.id;
              return (
                <div
                  key={company.id}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  {isEditing ? (
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        className="min-h-[44px] flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-700 transition-all focus:border-[#0EA5E9]/50 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={isPending}
                          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#0EA5E9] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#0284C7] disabled:opacity-50"
                        >
                          <Save size={14} />
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditingName("");
                          }}
                          disabled={isPending}
                          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50"
                        >
                          <X size={14} />
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[14px] font-medium text-gray-700">{company.name}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(company.id);
                            setEditingName(company.name);
                          }}
                          disabled={isPending}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-white hover:text-[#0EA5E9] disabled:opacity-50"
                          aria-label={`${company.name}を編集`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(company.id)}
                          disabled={isPending}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-white hover:text-red-400 disabled:opacity-50"
                          aria-label={`${company.name}を削除`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
