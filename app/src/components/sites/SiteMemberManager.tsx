"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, X, Loader2 } from "lucide-react";
import { removeSiteMember } from "@/app/(dashboard)/sites/actions";

export interface SiteMemberDraftItem {
  id: string;
  userId: string;
  name: string;
  role: string;
  createdAt: string;
}

interface SiteMemberManagerProps {
  siteId: string;
  members: SiteMemberDraftItem[];
  userRole: string;
  editable?: boolean;
  onChange?: (next: SiteMemberDraftItem[]) => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  manager: "マネージャー",
  worker_internal: "ワーカー",
  worker_external: "パートナー",
  client: "クライアント",
};

const MEMBER_GROUPS = [
  {
    key: "internal",
    title: "社内メンバー",
    roles: ["admin", "manager", "worker_internal"],
  },
  {
    key: "external",
    title: "社外メンバー",
    roles: ["worker_external"],
  },
  {
    key: "client",
    title: "クライアント",
    roles: ["client"],
  },
] as const;

export function SiteMemberManager({
  siteId,
  members,
  userRole,
  editable = false,
  onChange,
}: SiteMemberManagerProps) {
  const canManage = editable && (userRole === "admin" || userRole === "manager");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (!window.confirm(`${memberName} をこの現場から削除しますか？`)) return;
    setError(null);
    setRemovingId(memberId);
    startTransition(async () => {
      const result = await removeSiteMember(memberId, siteId);
      if (result.success) {
        // ローカル state も更新（onChange がある場合）
        if (onChange) {
          onChange(members.filter((member) => member.id !== memberId));
        }
      } else {
        setError(result.error || "削除に失敗しました");
      }
      setRemovingId(null);
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-[13px] font-semibold tracking-wide text-gray-600">現場メンバー</h3>
        <span className="text-[11px] text-gray-300">({members.length}名)</span>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-500">
          {error}
        </div>
      )}

      {members.length === 0 ? (
        <div className="py-4 text-[12px] text-gray-300">メンバーが登録されていません</div>
      ) : (
        <div className="space-y-4">
          {MEMBER_GROUPS.map((group) => {
            const groupedMembers = members.filter((member) =>
              (group.roles as readonly string[]).includes(member.role)
            );

            if (groupedMembers.length === 0) return null;

            return (
              <div key={group.key}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex items-baseline gap-2">
                    <p className="text-[13px] font-semibold text-gray-700">{group.title}</p>
                    <p className="text-[11px] text-gray-400">{groupedMembers.length}名</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {groupedMembers.map((member) => {
                    const isRemoving = removingId === member.id && isPending;
                    return (
                      <div
                        key={member.id}
                        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                          isRemoving ? "opacity-50" : ""
                        } ${
                          group.key === "client"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-cyan-50 text-[#0EA5E9]"
                        }`}
                      >
                        <CheckCircle2 size={12} />
                        <span>{member.name}</span>
                        <span
                          className={
                            group.key === "client"
                              ? "text-[10px] text-amber-400"
                              : "text-[10px] text-[#0EA5E9]/50"
                          }
                        >
                          {ROLE_LABELS[member.role] ?? member.role}
                        </span>
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.id, member.name)}
                            disabled={isPending}
                            className="ml-0.5 transition-colors hover:text-red-400 disabled:opacity-50"
                            title="削除"
                          >
                            {isRemoving ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
