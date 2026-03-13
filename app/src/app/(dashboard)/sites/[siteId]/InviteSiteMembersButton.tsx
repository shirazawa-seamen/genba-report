"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Check, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addSiteMembers, getInvitableUsers } from "../actions";

type InviteUser = {
  id: string;
  name: string;
  role: string;
};

const ROLE_GROUPS = [
  { key: "client", label: "クライアントの追加", roles: ["client"] },
  { key: "internal", label: "社内メンバーの追加", roles: ["admin", "manager", "worker_internal"] },
  { key: "external", label: "外部メンバーの追加", roles: ["worker_external"] },
] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  manager: "マネージャー",
  worker_internal: "ワーカー",
  worker_external: "パートナー",
  client: "クライアント",
};

export function InviteSiteMembersButton({ siteId }: { siteId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [users, setUsers] = useState<InviteUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, string[]>>({
    client: [],
    internal: [],
    external: [],
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const groupedUsers = useMemo(
    () =>
      ROLE_GROUPS.map((group) => ({
        ...group,
        users: users.filter((user) => (group.roles as readonly string[]).includes(user.role)),
      })),
    [users]
  );

  const selectedUsers = groupedUsers
    .flatMap((group) =>
      group.users.filter((user) => selected[group.key].includes(user.id))
    );

  const openModal = () => {
    setIsOpen(true);
    setIsPreviewMode(false);
    setLoading(true);
    setMessage(null);
    getInvitableUsers(siteId)
      .then((result) => {
        if (result.success) {
          setUsers(result.users ?? []);
          return;
        }
        setMessage(result.error || "ユーザー候補の取得に失敗しました");
      })
      .finally(() => setLoading(false));
  };

  const closeModal = () => {
    setIsOpen(false);
    setIsPreviewMode(false);
    setMessage(null);
    setSelected({ client: [], internal: [], external: [] });
  };

  const handleConfirm = () => {
    if (selectedUsers.length === 0) {
      setMessage("招待するユーザーを選択してください");
      return;
    }
    setMessage(null);
    setIsPreviewMode(true);
  };

  const handleSend = () => {
    if (selectedUsers.length === 0) return;
    startTransition(async () => {
      const result = await addSiteMembers(siteId, selectedUsers.map((user) => user.id));
      if (!result.success) {
        setMessage(result.error || "招待に失敗しました");
        return;
      }
      closeModal();
      window.location.reload();
    });
  };

  return (
    <>
      <Button type="button" variant="primary" size="sm" onClick={openModal}>
        <UserPlus size={14} />
        招待
      </Button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 px-4 py-6 md:items-center">
              <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-[18px] font-bold text-gray-900">メンバーを招待する</h3>
                    <p className="mt-1 text-[12px] text-gray-400">
                      役割ごとに選択し、確認してから送信します。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-400"
                  >
                    <X size={16} />
                  </button>
                </div>

                {message ? (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-400">
                    {message}
                  </div>
                ) : null}

                {loading ? (
                  <p className="py-6 text-center text-[13px] text-gray-400">ユーザーを読み込み中...</p>
                ) : isPreviewMode ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="mb-3 text-[13px] font-semibold text-gray-700">送信内容の確認</p>
                      {selectedUsers.length === 0 ? (
                        <p className="text-[12px] text-gray-400">招待対象はありません。</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedUsers.map((user) => (
                            <div key={user.id} className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                              <p className="text-[13px] font-medium text-gray-800">{user.name}</p>
                              <p className="text-[11px] text-gray-400">{ROLE_LABELS[user.role] ?? user.role}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsPreviewMode(false)} className="flex-1">
                        戻る
                      </Button>
                      <Button type="button" variant="primary" size="sm" onClick={handleSend} loading={isPending} className="flex-1">
                        {isPending ? "送信中..." : "送信"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedUsers.map((group) => (
                      <div key={group.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-medium text-gray-500">{group.label}</span>
                          <span className="text-[11px] text-gray-300">{selected[group.key].length}人選択</span>
                        </div>
                        {group.users.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-3 text-[12px] text-gray-400">
                            追加可能なユーザーがいません
                          </div>
                        ) : (
                          <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-3">
                            {group.users.map((user) => {
                              const isSelected = selected[group.key].includes(user.id);
                              return (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() =>
                                    setSelected((prev) => ({
                                      ...prev,
                                      [group.key]: isSelected
                                        ? prev[group.key].filter((id) => id !== user.id)
                                        : [...prev[group.key], user.id],
                                    }))
                                  }
                                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                                    isSelected
                                      ? "border-cyan-200 bg-cyan-50"
                                      : "border-gray-200 bg-white hover:bg-gray-50"
                                  }`}
                                >
                                  <div>
                                    <p className="text-[13px] font-medium text-gray-700">{user.name}</p>
                                    <p className="text-[11px] text-gray-400">{ROLE_LABELS[user.role] ?? user.role}</p>
                                  </div>
                                  {isSelected ? <Check size={16} className="text-[#0EA5E9]" /> : null}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={closeModal} className="flex-1">
                        キャンセル
                      </Button>
                      <Button type="button" variant="primary" size="sm" onClick={handleConfirm} className="flex-1">
                        確認
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
