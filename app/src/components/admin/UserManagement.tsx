"use client";

import { useMemo, useState, useTransition } from "react";
import {
  inviteUser,
  toggleUserActive,
  updateUserCompany,
  updateUserRole,
} from "@/app/(dashboard)/admin/users/actions";
import {
  ChevronDown,
  Loader2,
  Mail,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";

interface UserProfile {
  id: string;
  role: string;
  is_active: boolean | null;
  email?: string;
  full_name?: string;
  company_id?: string | null;
  company_name?: string | null;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface UserManagementProps {
  users: UserProfile[];
  companies: CompanyOption[];
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

const SELF_COMPANY_NAME = "シーメン株式会社";

export function UserManagement({ users, companies }: UserManagementProps) {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [inviteRole, setInviteRole] = useState("worker_internal");
  const [inviteCompanyId, setInviteCompanyId] = useState("");

  const selfCompanyId = useMemo(
    () => companies.find((company) => company.name === SELF_COMPANY_NAME)?.id ?? "",
    [companies]
  );

  const filteredUsers = useMemo(() => {
    if (activeTab === "all") return users;
    return users.filter((user) => user.role === activeTab);
  }, [users, activeTab]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: users.length };
    for (const user of users) {
      counts[user.role] = (counts[user.role] ?? 0) + 1;
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
        setInviteRole("worker_internal");
        setInviteCompanyId(selfCompanyId);
      } else {
        setMessage({
          type: "error",
          text: result.error || "エラーが発生しました",
        });
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
        setMessage({
          type: "error",
          text: result.error || "エラーが発生しました",
        });
      }
    });
  };

  const handleCompanyChange = (userId: string, companyId: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateUserCompany(userId, companyId || null);
      if (result.success) {
        setMessage({ type: "success", text: "会社名を更新しました" });
      } else {
        setMessage({
          type: "error",
          text: result.error || "エラーが発生しました",
        });
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
          text: !currentActive
            ? "ユーザーを有効にしました"
            : "ユーザーを無効にしました",
        });
      } else {
        setMessage({
          type: "error",
          text: result.error || "エラーが発生しました",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {message ? (
        <div
          className={`rounded-xl p-4 text-[13px] ${
            message.type === "success"
              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border border-red-200 bg-red-50 text-red-400"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {!showInviteForm ? (
        <button
          onClick={() => {
            setInviteRole("worker_internal");
            setInviteCompanyId(selfCompanyId);
            setShowInviteForm(true);
          }}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0EA5E9] px-5 text-[14px] font-bold text-white transition-all hover:bg-[#0284C7] active:scale-[0.98]"
        >
          <UserPlus size={16} />
          ユーザーを招待
        </button>
      ) : (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus size={16} className="text-[#0EA5E9]" />
            <h3 className="text-[14px] font-semibold text-[#0EA5E9]">
              新規ユーザー招待
            </h3>
          </div>
          <form action={handleInvite} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-gray-500">
                メールアドレス <span className="text-xs text-[#0EA5E9]">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="user@example.com"
                className="w-full min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[16px] text-gray-900 placeholder-gray-300 focus:border-[#0EA5E9]/50 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-gray-500">表示名</label>
              <input
                name="full_name"
                type="text"
                placeholder="山田 太郎"
                className="w-full min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[16px] text-gray-900 placeholder-gray-300 focus:border-[#0EA5E9]/50 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-gray-500">
                ロール <span className="text-xs text-[#0EA5E9]">*</span>
              </label>
              <div className="relative">
                <select
                  name="role"
                  value={inviteRole}
                  onChange={(event) => {
                    const nextRole = event.target.value;
                    setInviteRole(nextRole);
                    if (
                      (nextRole === "worker_internal" || nextRole === "worker_external") &&
                      selfCompanyId
                    ) {
                      setInviteCompanyId(selfCompanyId);
                    }
                  }}
                  required
                  className="w-full min-h-[44px] appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[16px] text-gray-900 focus:border-[#0EA5E9]/50 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]/20"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-gray-500">会社名</label>
              <div className="relative">
                <select
                  name="company_id"
                  value={inviteCompanyId}
                  onChange={(event) => setInviteCompanyId(event.target.value)}
                  className="w-full min-h-[44px] appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[16px] text-gray-900 focus:border-[#0EA5E9]/50 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]/20"
                >
                  <option value="">未設定</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowInviteForm(false);
                  setInviteRole("worker_internal");
                  setInviteCompanyId(selfCompanyId);
                }}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 text-[14px] font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#0EA5E9] px-4 text-[14px] font-bold text-white transition-all hover:bg-[#0284C7] disabled:opacity-50"
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : "招待する"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-hide">
        {ROLE_TABS.map((tab) => {
          const count = roleCounts[tab.value] ?? 0;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-medium transition-all ${
                isActive
                  ? "border border-cyan-200 bg-cyan-100 text-[#0EA5E9]"
                  : "border border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
              }`}
            >
              {tab.label}
              <span
                className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full text-[10px] ${
                  isActive
                    ? "bg-cyan-100 text-[#0EA5E9]"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-12 text-gray-300">
            <Users size={28} className="mb-2 text-gray-200" />
            <p className="text-[13px]">
              {activeTab === "all"
                ? "ユーザーが登録されていません"
                : `${ROLE_TABS.find((tab) => tab.value === activeTab)?.label ?? ""}のユーザーはいません`}
            </p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isActive = user.is_active !== false;
            return (
              <div
                key={user.id}
                className={`rounded-2xl border bg-white p-4 transition-colors ${
                  isActive ? "border-gray-200" : "border-red-200 opacity-60"
                }`}
              >
                {/* Top row: avatar + name + active toggle */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                      isActive
                        ? "bg-cyan-100 text-[#0EA5E9]"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {(user.full_name || user.email || "?")
                      .split(/[\s@]/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((segment) => segment[0].toUpperCase())
                      .join("")}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-gray-700">
                      {user.full_name || user.email || "Unknown"}
                    </p>
                    {user.email ? (
                      <p className="flex truncate items-center gap-1 text-[11px] text-gray-400">
                        <Mail size={10} />
                        {user.email}
                      </p>
                    ) : null}
                  </div>

                  <button
                    onClick={() => handleToggleActive(user.id, isActive)}
                    disabled={isPending}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                      isActive
                        ? "text-emerald-400 hover:bg-emerald-500/10"
                        : "text-red-400 hover:bg-red-50"
                    }`}
                    title={isActive ? "無効にする" : "有効にする"}
                  >
                    {isActive ? <UserCheck size={16} /> : <UserX size={16} />}
                  </button>
                </div>

                {/* Bottom row: role + company selects */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select
                      value={user.role}
                      onChange={(event) => handleRoleChange(user.id, event.target.value)}
                      disabled={isPending}
                      className="w-full min-h-[36px] appearance-none rounded-lg border border-gray-200 bg-gray-50 pl-3 pr-7 text-[12px] text-gray-600 focus:border-[#0EA5E9]/50 focus:outline-none disabled:opacity-50"
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={12}
                      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>

                  <div className="relative flex-1">
                    <select
                      value={user.company_id ?? ""}
                      onChange={(event) => handleCompanyChange(user.id, event.target.value)}
                      disabled={isPending}
                      className="w-full min-h-[36px] appearance-none rounded-lg border border-gray-200 bg-gray-50 pl-3 pr-7 text-[12px] text-gray-600 focus:border-[#0EA5E9]/50 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">会社未設定</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={12}
                      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
