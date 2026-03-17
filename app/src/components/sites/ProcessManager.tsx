"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  WORK_PROCESS_LABELS,
  getProgressColorClasses,
} from "@/lib/constants";
import type { ProcessCategoryRecord } from "@/lib/processCategories";
import type { ProcessTemplateRecord } from "@/lib/processTemplateTypes";

export interface SiteProcessDraftItem {
  id: string;
  category: string;
  name: string;
  orderIndex: number;
  progressRate: number;
  status: string;
  createdAt: string;
}

interface ProcessManagerProps {
  processes: SiteProcessDraftItem[];
  canManage: boolean;
  initialTemplates: ProcessTemplateRecord[];
  categoryOptions: ProcessCategoryRecord[];
  onChange?: (next: SiteProcessDraftItem[]) => void;
}

const PHASE_LABELS: Record<string, string> = {
  A: "A 躯体",
  B: "B 外装",
  C: "C 内装",
  D: "D 引き渡し",
};

function reorderItems(items: SiteProcessDraftItem[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((item, index) => ({ ...item, orderIndex: index + 1 }));
}

export function ProcessManager({
  processes,
  canManage,
  initialTemplates,
  categoryOptions,
  onChange,
}: ProcessManagerProps) {
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<"A" | "B" | "C" | "D" | "">("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const categoryLabelMap = useMemo(
    () =>
      Object.fromEntries(
        categoryOptions.map((category) => [category.value, category.label])
      ),
    [categoryOptions]
  );

  const existingKeys = useMemo(
    () => new Set(processes.map((process) => `${process.category}::${process.name.trim()}`)),
    [processes]
  );

  const templateCandidates = useMemo(
    () =>
      initialTemplates.filter(
        (item) => !existingKeys.has(`${item.category}::${item.name.trim()}`)
      ),
    [existingKeys, initialTemplates]
  );

  const phaseOptions = useMemo(
    () =>
      ["A", "B", "C", "D"]
        .filter((phaseKey) =>
          templateCandidates.some((item) => item.phaseKey === phaseKey)
        )
        .map((phaseKey) => ({
          value: phaseKey as "A" | "B" | "C" | "D",
          label: PHASE_LABELS[phaseKey],
        })),
    [templateCandidates]
  );

  const availableCategories = useMemo(() => {
    if (!selectedPhase) return [];
    return categoryOptions.filter((option) =>
      templateCandidates.some(
        (template) =>
          template.phaseKey === selectedPhase && template.category === option.value
      )
    );
  }, [categoryOptions, selectedPhase, templateCandidates]);

  const availableTemplates = useMemo(() => {
    if (!selectedPhase || !selectedCategory) return [];
    return templateCandidates.filter(
      (template) =>
        template.phaseKey === selectedPhase &&
        template.category === selectedCategory
    );
  }, [selectedCategory, selectedPhase, templateCandidates]);

  const resolvedSelectedPhase = phaseOptions.some(
    (option) => option.value === selectedPhase
  )
    ? selectedPhase
    : "";

  const resolvedSelectedCategory = availableCategories.some(
    (option) => option.value === selectedCategory
  )
    ? selectedCategory
    : "";

  const resolvedSelectedTemplateId = availableTemplates.some(
    (template) => template.id === selectedTemplateId
  )
    ? selectedTemplateId
    : "";

  const templatePhaseMap = useMemo(
    () =>
      new Map(
        initialTemplates.map((template) => [
          `${template.category}::${template.name.trim()}`,
          template.phaseKey,
        ])
      ),
    [initialTemplates]
  );

  const visiblePhaseGroups = useMemo(() => {
    const grouped = processes.reduce<Record<string, SiteProcessDraftItem[]>>(
      (acc, process) => {
        const phaseKey =
          templatePhaseMap.get(`${process.category}::${process.name.trim()}`) ?? "other";
        if (!acc[phaseKey]) acc[phaseKey] = [];
        acc[phaseKey].push(process);
        return acc;
      },
      {}
    );

    return ["A", "B", "C", "D"]
      .filter((phaseKey) => (grouped[phaseKey]?.length ?? 0) > 0)
      .map((phaseKey) => ({
        key: phaseKey,
        label: PHASE_LABELS[phaseKey] ?? phaseKey,
        processes: grouped[phaseKey],
      }));
  }, [processes, templatePhaseMap]);

  const otherProcesses = useMemo(() => {
    const grouped = processes.reduce<Record<string, SiteProcessDraftItem[]>>(
      (acc, process) => {
        const phaseKey =
          templatePhaseMap.get(`${process.category}::${process.name.trim()}`) ?? "other";
        if (!acc[phaseKey]) acc[phaseKey] = [];
        acc[phaseKey].push(process);
        return acc;
      },
      {}
    );
    return grouped.other ?? [];
  }, [processes, templatePhaseMap]);

  const openAddModal = () => {
    setSelectedPhase("");
    setSelectedCategory("");
    setSelectedTemplateId("");
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setSelectedPhase("");
    setSelectedCategory("");
    setSelectedTemplateId("");
  };

  const updateProcesses = (next: SiteProcessDraftItem[]) => {
    onChange?.(next.map((item, index) => ({ ...item, orderIndex: index + 1 })));
  };

  const handleStartEdit = (process: SiteProcessDraftItem) => {
    setEditingId(process.id);
    setEditCategory(process.category);
    setEditName(process.name);
    setDeletingId(null);
  };

  const handlePickTemplateProcess = () => {
    const template = availableTemplates.find(
      (item) => item.id === resolvedSelectedTemplateId
    );
    if (!template || !onChange) return;

    const insertAtIndex = processes.findIndex((process) => {
      const matchedTemplate = initialTemplates.find(
        (item) => item.category === process.category && item.name === process.name
      );
      return matchedTemplate ? matchedTemplate.sortOrder > template.sortOrder : false;
    });

    const nextProcess: SiteProcessDraftItem = {
      id: `draft-process-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: template.category,
      name: template.name,
      orderIndex: processes.length + 1,
      progressRate: 0,
      status: "in_progress",
      createdAt: new Date().toISOString(),
    };

    const next = [...processes];
    if (insertAtIndex === -1) {
      next.push(nextProcess);
    } else {
      next.splice(insertAtIndex, 0, nextProcess);
    }

    updateProcesses(next);
    closeAddModal();
    setMessage({
      type: "success",
      text: `「${template.processCode} ${template.name}」を追加しました`,
    });
  };

  const handleSaveEdit = () => {
    if (!editingId || !editCategory || !editName.trim() || !onChange) return;
    updateProcesses(
      processes.map((process) =>
        process.id === editingId
          ? {
              ...process,
              category: editCategory,
              name: editName.trim(),
            }
          : process
      )
    );
    setEditingId(null);
    setMessage({ type: "success", text: "工程を更新しました" });
  };

  const handleDelete = (processId: string) => {
    if (!onChange) return;
    updateProcesses(processes.filter((process) => process.id !== processId));
    setDeletingId(null);
    setMessage({ type: "success", text: "工程を削除しました" });
  };

  const beginDrag = (processId: string, startY: number) => {
    if (!canManage || !onChange) return;
    dragCleanupRef.current?.();
    setDraggingId(processId);

    const updateDragPosition = (pointerY: number) => {
      const currentIndex = processes.findIndex((process) => process.id === processId);
      if (currentIndex === -1) return;

      let targetIndex = currentIndex;

      for (let index = 0; index < processes.length; index += 1) {
        const current = processes[index];
        if (current.id === processId) continue;
        const element = itemRefs.current[current.id];
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (pointerY < rect.top + rect.height / 2) {
          targetIndex = index;
          break;
        }
        targetIndex = index + 1;
      }

      if (targetIndex === currentIndex) return;

      updateProcesses(
        reorderItems(
          processes,
          currentIndex,
          targetIndex > currentIndex ? targetIndex - 1 : targetIndex
        )
      );
    };

    const finishDrag = () => {
      setDraggingId(null);
      dragCleanupRef.current = null;
    };

    const handleMouseMove = (event: MouseEvent) => {
      event.preventDefault();
      updateDragPosition(event.clientY);
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      updateDragPosition(touch.clientY);
    };

    const handleMouseUp = () => {
      cleanup();
      finishDrag();
    };

    const handleTouchEnd = () => {
      cleanup();
      finishDrag();
    };

    const cleanup = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
    dragCleanupRef.current = cleanup;
    updateDragPosition(startY);
  };

  const renderProcessCard = (process: SiteProcessDraftItem) => {
    const colors = getProgressColorClasses(process.progressRate);
    const isEditing = editingId === process.id;
    const isDeleting = deletingId === process.id;
    const categoryLabel =
      categoryLabelMap[process.category] ??
      WORK_PROCESS_LABELS[process.category] ??
      process.category;

    if (isEditing && canManage) {
      return (
        <div
          key={process.id}
          className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4"
        >
          <div className="space-y-3">
            <div className="relative">
              <select
                value={editCategory}
                onChange={(event) => setEditCategory(event.target.value)}
                className="w-full min-h-[44px] appearance-none rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-700 focus:outline-none focus:border-[#0EA5E9]/50"
              >
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-300"
              />
            </div>
            <input
              type="text"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="w-full min-h-[44px] rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-700 focus:outline-none focus:border-[#0EA5E9]/50"
              autoFocus
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="flex-1 min-h-[40px] rounded-xl border border-gray-300 text-[13px] text-gray-500 transition-colors hover:bg-gray-100"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={!editCategory || !editName.trim()}
              className="flex-1 min-h-[40px] rounded-xl bg-[#0EA5E9] text-[13px] font-bold text-white transition-colors hover:bg-[#0284C7] disabled:opacity-50"
            >
              保存
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={process.id}
        ref={(element) => {
          itemRefs.current[process.id] = element;
        }}
        className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition ${
          draggingId === process.id ? "scale-[0.98] opacity-70 shadow-lg" : ""
        }`}
      >
        <div className="flex items-start gap-3">
          {canManage ? (
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                beginDrag(process.id, event.clientY);
              }}
              onTouchStart={(event) => {
                const touch = event.touches[0];
                if (!touch) return;
                event.preventDefault();
                beginDrag(process.id, touch.clientY);
              }}
              className="mt-0.5 flex h-9 w-9 shrink-0 touch-none items-center justify-center rounded-xl bg-gray-50 text-gray-300 transition-colors hover:bg-cyan-50 hover:text-[#0EA5E9]"
              title="ドラッグして並び替え"
            >
              <GripVertical size={16} />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="truncate text-[14px] font-semibold text-gray-800">
                {process.name}
              </span>
              {process.status === "completed" ? (
                <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
              ) : null}
            </div>
            <p className="mb-3 text-[11px] text-gray-400">{categoryLabel}</p>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${colors.bg}`}
                  style={{ width: `${process.progressRate}%` }}
                />
              </div>
              <span className={`w-8 text-right text-[11px] font-semibold ${colors.text}`}>
                {process.progressRate}%
              </span>
            </div>
            {isDeleting ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                <AlertTriangle size={14} className="shrink-0 text-red-400" />
                <p className="flex-1 text-[11px] text-red-400">
                  この工程を削除しますか？
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
                  onClick={() => handleDelete(process.id)}
                  className="rounded bg-red-400 px-2 py-1 text-[11px] text-white transition-colors hover:bg-red-500"
                >
                  削除
                </button>
              </div>
            ) : null}
          </div>
          {canManage ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => handleStartEdit(process)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-cyan-50 hover:text-[#0EA5E9]"
                title="編集"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(isDeleting ? null : process.id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400"
                title="削除"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList size={16} className="text-[#0EA5E9]" />
          <h3 className="text-[13px] font-semibold tracking-wide text-gray-600">
            工程管理
          </h3>
          <span className="text-[11px] text-gray-300">({processes.length})</span>
        </div>

        {message ? (
          <div
            className={`mb-4 rounded-xl border px-3 py-2 text-[12px] ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                : "border-red-200 bg-red-50 text-red-400"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        {canManage ? (
          <div className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-gray-700">
                  工程を追加する
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  フェーズから選んで標準工程候補を追加します
                </p>
              </div>
              <button
                type="button"
                onClick={openAddModal}
                disabled={templateCandidates.length === 0}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#0EA5E9] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#0284C7] disabled:opacity-50"
              >
                <Plus size={14} />
                追加する
              </button>
            </div>
            {templateCandidates.length === 0 ? (
              <p className="mt-3 text-[11px] text-gray-400">
                追加できる標準工程はありません。
              </p>
            ) : null}
          </div>
        ) : null}

        {processes.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-gray-300">
            <ClipboardList size={24} className="mb-1.5" />
            <p className="text-[12px]">工程が登録されていません</p>
          </div>
        ) : (
          <div className="space-y-5">
            {visiblePhaseGroups.map((group) => (
              <section key={group.key}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-gray-500">
                    {group.label}
                  </p>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-400">
                    {group.processes.length}件
                  </span>
                </div>
                <div className="space-y-2">{group.processes.map(renderProcessCard)}</div>
              </section>
            ))}

            {otherProcesses.length > 0 ? (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-gray-500">その他</p>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-400">
                    {otherProcesses.length}件
                  </span>
                </div>
                <div className="space-y-2">{otherProcesses.map(renderProcessCard)}</div>
              </section>
            ) : null}
          </div>
        )}
      </div>

      {showAddModal ? (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-gray-900/40 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+80px)] md:items-center md:pb-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-[16px] font-bold text-gray-900">工程を追加する</h4>
                <p className="mt-1 text-[12px] text-gray-400">
                  フェーズ、工程種別、工程の順に選択してください
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200"
                title="閉じる"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <select
                  value={resolvedSelectedPhase}
                  onChange={(event) => {
                    setSelectedPhase(event.target.value as "A" | "B" | "C" | "D" | "");
                    setSelectedCategory("");
                    setSelectedTemplateId("");
                  }}
                  className="w-full min-h-[48px] appearance-none rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-700 focus:outline-none focus:border-[#0EA5E9]/50"
                >
                  <option value="">フェーズを選択</option>
                  {phaseOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-300"
                />
              </div>

              <div className="relative">
                <select
                  value={resolvedSelectedCategory}
                  onChange={(event) => {
                    setSelectedCategory(event.target.value);
                    setSelectedTemplateId("");
                  }}
                  disabled={!resolvedSelectedPhase}
                  className="w-full min-h-[48px] appearance-none rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-700 focus:outline-none focus:border-[#0EA5E9]/50 disabled:bg-gray-50 disabled:text-gray-300"
                >
                  <option value="">工程種別を選択</option>
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-300"
                />
              </div>

              <div className="relative">
                <select
                  value={resolvedSelectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  disabled={!resolvedSelectedCategory}
                  className="w-full min-h-[48px] appearance-none rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-700 focus:outline-none focus:border-[#0EA5E9]/50 disabled:bg-gray-50 disabled:text-gray-300"
                >
                  <option value="">工程を選択</option>
                  {availableTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.processCode} {template.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-300"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeAddModal}
                className="flex-1 min-h-[44px] rounded-xl border border-gray-300 text-[13px] text-gray-500 transition-colors hover:bg-gray-100"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handlePickTemplateProcess}
                disabled={!resolvedSelectedTemplateId}
                className="flex-1 min-h-[44px] rounded-xl bg-[#0EA5E9] text-[13px] font-bold text-white transition-colors hover:bg-[#0284C7] disabled:opacity-50"
              >
                追加する
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
