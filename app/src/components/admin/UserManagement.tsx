"use client";

import { useState, useTransition, useMemo } from "react";
import { inviteUser, updateUserRole, toggleUserActive } from "@/app/(dashboard)/admin/users/actions";
import { ROLE_LABELS } from "@/lib/constants";
import {
  UserPlus,
  Loader2,
  Mail,
  UserCheck,
  UserX,
  ChevronDown,
  Users,
} from "lucide-react";

interface UserProfile {
  id: string;
  role: string;
  is_active: boolean | null;
  email?: string;
  full_name?: string;
}

interface UserManagementProps {
  users: UserProfile[];
}

const ROLE_OPTIONS = [
  { value: "admin", label: "管理者" },
  { value: "manager", label: "マネージャー" },
  { value: "worker_internal", label: "ワーカー" },
  { value: "worker_external", label: "パートナー" },
  { value: "client", label: "クライアント" },
];

const ROLE_TABS = [
  { value: "all", label: "全員" },
  { value: "admin", label: "管理者" },
  { value: "manager", label: "マネージャー" },
  { value: "worker_internal", label: "ワーカー" },
  { value: "worker_external", label: "パートナー" },
  { value: "client", label: "クライアント" },
];

export function UserManagement({ users }: UserManagementProps) {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const filteredUsers = useMemo(() => {
    if (activeTab === "all") return users;
    return users.filter((u) => u.role === activeTab);
  }, [users, activeTab]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: users.length };
    for (const u of users) {
      counts[u.role] = (counts[u.role] ?? 0) + 1;
    }
    return counts;
  }, [users]);

  const handleInvite = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result = await inviteUser(formData);
      if (result.success) {
        setMessage({ type: "success", text: "ユーザーを招待しました" });
        setShowInviteForm(false);
      } else {
        setMessage({ type: "error", text: result.error || "エラーが発生しました" });
      }
    });
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateUserRole(userId, newRole);
      if (result.success) {
        setMessage({ type: "success", text: "ロールを更新しました" });
      } else {
        setMessage({ type: "error", text: result.error || "エラーが発生しました" });
      }
    });
  };

  const handleToggleActive = (userId: string, currentActive: boolean) => {
    setMessage(null);
    startTransition(async () => {
      const result = await toggleUserActive(userId, !currentActive);
      if (result.success) {
        setMessage({
          type: "success",
          text: !currentActive ? "ユーザーを有効にしました" : "ユーザーを無効にしました",
        });
      } else {
        setMessage({ type: "error", text: result.error || "エラーが発生しました" });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div
          className={`rounded-xl p-4 text-[13px] ${
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-red-50 border border-red-200 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Invite Button / Form */}
      {!showInviteForm ? (
        <button
          onClick={() => setShowInviteForm(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0EA5E9] min-h-[44px] px-5 text-[14px] font-bold text-white transition-all hover:bg-[#0284C7] active:scale-[0.98]"
        >
          <UserPlus size={16} />
          ユーザーを招待
        </button>
      ) : (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={16} className="text-[#0EA5E9]" />
            <h3 className="text-[14px] font-semibold text-[#0EA5E9]">新規ユーザー招待</h3>
          </div>
          <form action={handleInvite} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-gray-500">
                メールアドレス <span className="text-[#0EA5E9] text-xs">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="user@example.com"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[16px] text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-gray-500">表示名</label>
              <input
                name="full_name"
                type="text"
                placeholder="山田 太郎"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[16px] text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-gray-500">
                ロール <span className="text-[#0EA5E9] text-xs">*</span>
              </label>
              <div className="relative">
                <select
                  name="role"
                  required
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[16px] text-gray-900 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20 appearance-none"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 min-h-[44px] px-4 text-[14px] font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0EA5E9] min-h-[44px] px-4 text-[14px] font-bold text-white transition-all hover:bg-[#0284C7] disabled:opacity-50"
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : "招待する"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Role Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {ROLE_TABS.map((tab) => {
          const count = roleCounts[tab.value] ?? 0;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all ${
                isActive
                  ? "bg-cyan-100 text-[#0EA5E9] border border-cyan-200"
                  : "bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100 hover:text-gray-500"
              }`}
            >
              {tab.label}
              <span className={`text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${
                isActive ? "bg-cyan-100 text-[#0EA5E9]" : "bg-gray-100 text-gray-400"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* User List */}
      <div className="space-y-2">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-300 rounded-2xl border border-gray-200 bg-white">
            <Users size={28} className="mb-2 text-gray-200" />
            <p className="text-[13px]">
              {activeTab === "all" ? "ユーザーが登録されていません" : `${ROLE_TABS.find(t => t.value === activeTab)?.label ?? ""}のユーザーはいません`}
            </p>
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isActive = u.is_active !== false;
            return (
              <div
                key={u.id}
                className={`rounded-2xl border bg-white p-4 transition-colors ${
                  isActive ? "border-gray-200" : "border-red-200 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  {/* Avatar */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                      isActive
                        ? "bg-cyan-100 text-[#0EA5E9]"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {(u.full_name || u.email || "?")
                      .split(/[\s@]/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((s) => s[0].toUpperCase())
                      .join("")}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-gray-700 truncate">
                      {u.full_name || u.email || "Unknown"}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      {u.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail size={10} />
                          {u.email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Role Selector */}
                  <div className="relative shrink-0">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={isPending}
                      className="min-h-[36px] pl-3 pr-7 rounded-lg border border-gray-200 bg-gray-50 text-[12px] text-gray-600 focus:outline-none focus:border-[#0EA5E9]/50 appearance-none disabled:opacity-50"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>

                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggleActive(u.id, isActive)}
                    disabled={isPending}
                    className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-lg transition-colors disabled:opacity-50 ${
                      isActive
                        ? "text-emerald-400 hover:bg-emerald-500/10"
                        : "text-red-400 hover:bg-red-50"
                    }`}
                    title={isActive ? "無効にする" : "有効にする"}
                  >
                    {isActive ? <UserCheck size={16} /> : <UserX size={16} />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
