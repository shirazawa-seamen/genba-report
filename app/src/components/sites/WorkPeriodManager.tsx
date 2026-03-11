"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

export interface WorkPeriodDraftItem {
  id: string;
  startDate: string;
  endDate: string;
}

interface WorkPeriodManagerProps {
  periods: WorkPeriodDraftItem[];
  canManage?: boolean;
  onChange?: (next: WorkPeriodDraftItem[]) => void;
}

function formatDateJP(date: string): string {
  return new Date(date).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function WorkPeriodManager({
  periods,
  canManage = false,
  onChange,
}: WorkPeriodManagerProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setShowAdd(true);
    setEditingId(null);
    setDeletingId(null);
    if (periods.length > 0) {
      const lastEnd = new Date(periods[periods.length - 1].endDate);
      lastEnd.setDate(lastEnd.getDate() + 2);
      const start = lastEnd.toISOString().split("T")[0];
      const end = new Date(lastEnd);
      end.setDate(end.getDate() + 6);
      setAddStart(start);
      setAddEnd(end.toISOString().split("T")[0]);
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 6);
    setAddStart(today);
    setAddEnd(nextWeek.toISOString().split("T")[0]);
  };

  const handleAdd = () => {
    if (!onChange || !addStart || !addEnd) return;
    onChange([
      ...periods,
      {
        id: `draft-period-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startDate: addStart,
        endDate: addEnd,
      },
    ]);
    setShowAdd(false);
    setAddStart("");
    setAddEnd("");
  };

  const handleStartEdit = (period: WorkPeriodDraftItem) => {
    setEditingId(period.id);
    setEditStart(period.startDate);
    setEditEnd(period.endDate);
    setDeletingId(null);
  };

  const handleSaveEdit = () => {
    if (!onChange || !editingId || !editStart || !editEnd) return;
    onChange(
      periods.map((period) =>
        period.id === editingId
          ? { ...period, startDate: editStart, endDate: editEnd }
          : period
      )
    );
    setEditingId(null);
  };

  const handleDelete = (periodId: string) => {
    if (!onChange) return;
    onChange(periods.filter((period) => period.id !== periodId));
    setDeletingId(null);
  };

  const getGapDays = (index: number): number | null => {
    if (index === 0 || periods.length < 2) return null;
    const previousEnd = new Date(periods[index - 1].endDate);
    const currentStart = new Date(periods[index].startDate);
    const gap =
      Math.round(
        (currentStart.getTime() - previousEnd.getTime()) / (1000 * 60 * 60 * 24)
      ) - 1;
    return gap > 0 ? gap : null;
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[#0EA5E9]" />
          <h3 className="text-[13px] font-semibold tracking-wide text-gray-600">
            稼働期間管理
          </h3>
          <span className="text-[11px] text-gray-300">({periods.length}期間)</span>
        </div>
        {canManage && !showAdd ? (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[12px] font-medium text-[#0EA5E9] transition-colors hover:bg-cyan-100"
          >
            <Plus size={12} />
            追加
          </button>
        ) : null}
      </div>

      {canManage && showAdd ? (
        <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Plus size={14} className="text-[#0EA5E9]" />
            <span className="text-[13px] font-semibold text-[#0EA5E9]">
              稼働期間を追加
            </span>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">
                開始日
              </label>
              <input
                type="date"
                value={addStart}
                onChange={(event) => setAddStart(event.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-[14px] text-gray-700 focus:outline-none focus:border-[#0EA5E9]/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">
                終了日
              </label>
              <input
                type="date"
                value={addEnd}
                onChange={(event) => setAddEnd(event.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-[14px] text-gray-700 focus:outline-none focus:border-[#0EA5E9]/50"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setAddStart("");
                setAddEnd("");
              }}
              className="flex-1 min-h-[40px] rounded-lg border border-gray-300 text-[13px] text-gray-500 transition-colors hover:bg-gray-100"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!addStart || !addEnd}
              className="flex-1 min-h-[40px] rounded-lg bg-[#0EA5E9] text-[13px] font-bold text-white transition-colors hover:bg-[#0284C7] disabled:opacity-50"
            >
              追加する
            </button>
          </div>
        </div>
      ) : null}

      {periods.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-gray-300">
          <Calendar size={24} className="mb-1.5" />
          <p className="text-[12px]">稼働期間が登録されていません</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {periods.map((period, index) => {
            const gapDays = getGapDays(index);
            const isEditing = editingId === period.id;
            const isDeleting = deletingId === period.id;
            const days = daysBetween(period.startDate, period.endDate);

            return (
              <div key={period.id}>
                {gapDays !== null ? (
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="shrink-0 text-[10px] font-medium text-gray-300">
                      {gapDays}日間 中抜け
                    </span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                ) : null}

                {isEditing ? (
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3">
                    <div className="mb-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-500">
                          開始日
                        </label>
                        <input
                          type="date"
                          value={editStart}
                          onChange={(event) => setEditStart(event.target.value)}
                          className="w-full min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-700 focus:outline-none focus:border-[#0EA5E9]/50"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-500">
                          終了日
                        </label>
                        <input
                          type="date"
                          value={editEnd}
                          onChange={(event) => setEditEnd(event.target.value)}
                          className="w-full min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-700 focus:outline-none focus:border-[#0EA5E9]/50"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex-1 min-h-[36px] rounded-lg border border-gray-300 text-[12px] text-gray-500 transition-colors hover:bg-gray-100"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={!editStart || !editEnd}
                        className="flex-1 min-h-[36px] rounded-lg bg-[#0EA5E9] text-[12px] font-bold text-white transition-colors hover:bg-[#0284C7] disabled:opacity-50"
                      >
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          保存
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-[11px] font-bold text-[#0EA5E9]">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-gray-700">
                          {formatDateJP(period.startDate)} ~ {formatDateJP(period.endDate)}
                        </p>
                        <p className="text-[11px] text-gray-400">{days}日間</p>
                      </div>
                      {canManage ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(period)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-cyan-50 hover:text-[#0EA5E9]"
                            title="編集"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeletingId(isDeleting ? null : period.id)
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400"
                            title="削除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {isDeleting ? (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
                        <AlertTriangle size={14} className="shrink-0 text-red-400" />
                        <p className="flex-1 text-[11px] text-red-400">
                          この稼働期間を削除しますか？
                        </p>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="rounded px-2 py-1 text-[11px] text-gray-500 transition-colors hover:bg-gray-100"
                        >
                          いいえ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(period.id)}
                          className="rounded bg-red-400 px-2 py-1 text-[11px] text-white transition-colors hover:bg-red-500"
                        >
                          削除
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {periods.length >= 2 ? (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-[11px] text-gray-400">
            全体: {formatDateJP(periods[0].startDate)} ~{" "}
            {formatDateJP(periods[periods.length - 1].endDate)}
            {" / "}
            稼働{" "}
            {periods.reduce(
              (sum, period) => sum + daysBetween(period.startDate, period.endDate),
              0
            )}
            日
            {" / "}
            中抜け{" "}
            {periods.reduce((sum, _, index) => sum + (getGapDays(index) ?? 0), 0)}日
          </p>
        </div>
      ) : null}
    </div>
  );
}
