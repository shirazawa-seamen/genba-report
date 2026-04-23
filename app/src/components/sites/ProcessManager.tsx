"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CornerDownRight,
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
import type { ProcessChecklistItem } from "@/app/(dashboard)/sites/actions";
import {
  addSiteProcess,
  batchAddSiteProcesses,
  getSiteProcesses,
  getProcessChecklist,
  toggleChecklistItem,
  addChecklistItem,
  deleteChecklistItem,
} from "@/app/(dashboard)/sites/actions";

export interface SiteProcessDraftItem {
  id: string;
  category: string;
  name: string;
  orderIndex: number;
  progressRate: number;
  status: string;
  createdAt: string;
  parentProcessId?: string | null;
}

interface ProcessManagerProps {
  siteId?: string;
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
  const movedItem = items[fromIndex];

  // 親工程の場合、子工程も一緒に移動
  const movedIds = new Set<string>([movedItem.id]);
  const childItems = items.filter((item) => item.parentProcessId === movedItem.id);
  for (const child of childItems) movedIds.add(child.id);
  // 孫工程（子の子）も
  const grandchildItems = items.filter((item) => item.parentProcessId && movedIds.has(item.parentProcessId) && !movedIds.has(item.id));
  for (const gc of grandchildItems) movedIds.add(gc.id);

  // 移動対象と残りを分離
  const toMove = items.filter((item) => movedIds.has(item.id));
  const remaining = items.filter((item) => !movedIds.has(item.id));

  // 挿入位置を調整（remainingの中でのindex）
  const adjustedTo = Math.min(Math.max(0, toIndex > fromIndex ? toIndex - toMove.length + 1 : toIndex), remaining.length);
  remaining.splice(adjustedTo, 0, ...toMove);

  return remaining.map((item, index) => ({ ...item, orderIndex: index + 1 }));
}

function ChecklistPanel({
  processId, canManage, isEditing, cache, loading, isPending, newItemName,
  onToggleItem, onDeleteItem, onAddItem, onNameChange, onLoad,
}: {
  processId: string;
  canManage: boolean;
  isEditing: boolean;
  cache: Record<string, ProcessChecklistItem[]>;
  loading: Set<string>;
  isPending: boolean;
  newItemName: Record<string, string>;
  onToggleItem: (item: ProcessChecklistItem) => void;
  onDeleteItem: (itemId: string) => void;
  onAddItem: () => void;
  onNameChange: (name: string) => void;
  onLoad: () => void;
}) {
  useEffect(() => { onLoad(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const items = cache[processId] ?? [];
  const isLoading = loading.has(processId);

  // 項目なし＆編集中でない場合は何も表示しない
  if (!isLoading && items.length === 0 && !isEditing) return null;

  return (
    <div className="mt-2">
      {isLoading ? (
        <p className="text-[11px] text-gray-300 py-1">読み込み中...</p>
      ) : (
        <>
          {items.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 mb-1">
                <span className="shrink-0 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-bold text-amber-400 leading-none">孫</span>
              </div>
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={() => onToggleItem(item)}
                      disabled={isPending}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                        item.isCompleted
                          ? "border-emerald-400 bg-emerald-400 text-white"
                          : "border-gray-300 bg-white hover:border-[#0EA5E9]"
                      }`}
                    >
                      {item.isCompleted && <CheckCircle2 size={12} />}
                    </button>
                  ) : (
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      item.isCompleted
                        ? "border-emerald-400 bg-emerald-400 text-white"
                        : "border-gray-200 bg-gray-50"
                    }`}>
                      {item.isCompleted && <CheckCircle2 size={12} />}
                    </div>
                  )}
                  <span className={`flex-1 text-[12px] ${item.isCompleted ? "text-gray-300 line-through" : "text-gray-700"}`}>
                    {item.name}
                  </span>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      disabled={isPending}
                      className="text-gray-200 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {isEditing && (
            <div className={`flex gap-1.5 ${items.length > 0 ? "mt-2" : ""}`}>
              <input
                type="text"
                value={newItemName[processId] ?? ""}
                onChange={(e) => onNameChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onAddItem(); }}
                placeholder="チェック項目を追加..."
                className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] focus:border-[#0EA5E9]/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={onAddItem}
                disabled={isPending || !(newItemName[processId] ?? "").trim()}
                className="rounded-lg bg-[#0EA5E9] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0284C7] disabled:opacity-50 transition-colors"
              >
                追加
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ProcessManager({
  siteId,
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
  const [addMode, setAddMode] = useState<"template" | "custom">("template");
  const [customCategory, setCustomCategory] = useState("");
  const [customName, setCustomName] = useState("");
  // 一括追加キュー
  const [pendingProcesses, setPendingProcesses] = useState<Array<{
    id: string;
    category: string;
    name: string;
    templateId?: string;
    childTemplates?: Array<{ category: string; name: string; templateId?: string }>;
  }>>([]);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
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
  const [checklistExpanded, setChecklistExpanded] = useState<Set<string>>(new Set());
  const [checklistCache, setChecklistCache] = useState<Record<string, ProcessChecklistItem[]>>({});
  const [checklistLoading, setChecklistLoading] = useState<Set<string>>(new Set());
  const [newItemName, setNewItemName] = useState<Record<string, string>>({});
  const [isPendingChecklist, startChecklistTransition] = useTransition();

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
        (item) =>
          // 子テンプレートは候補に出さない（親選択時に自動追加される）
          !item.parentTemplateId &&
          !existingKeys.has(`${item.category}::${item.name.trim()}`)
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
    setAddMode("template");
    setCustomCategory("");
    setCustomName("");
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setSelectedPhase("");
    setSelectedCategory("");
    setSelectedTemplateId("");
    setCustomCategory("");
    setCustomName("");
  };

  // キューからアイテム削除
  const removePendingProcess = (id: string) => {
    setPendingProcesses((prev) => prev.filter((p) => p.id !== id));
  };

  // 一括保存
  const handleBatchSave = async () => {
    if (!siteId || pendingProcesses.length === 0) return;
    setIsBatchSaving(true);
    setMessage(null);

    // キューをフラット化（親工程→子工程の順に）
    const flatProcesses: Array<{
      category: string;
      name: string;
      templateId?: string;
      parentTemplateName?: string;
    }> = [];

    for (const proc of pendingProcesses) {
      flatProcesses.push({
        category: proc.category,
        name: proc.name,
        templateId: proc.templateId,
      });
      if (proc.childTemplates) {
        for (const child of proc.childTemplates) {
          flatProcesses.push({
            category: child.category,
            name: child.name,
            templateId: child.templateId,
            parentTemplateName: proc.name,
          });
        }
      }
    }

    const result = await batchAddSiteProcesses({
      siteId,
      processes: flatProcesses,
    });

    if (result.success) {
      setPendingProcesses([]);
      setMessage({
        type: "success",
        text: `${result.addedCount}件の工程を追加しました`,
      });
      window.location.reload();
    } else {
      setMessage({ type: "error", text: result.error || "一括保存に失敗しました" });
    }

    setIsBatchSaving(false);
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

  // カスタム工程をキューに追加
  const handleAddCustomProcess = () => {
    if (!customCategory || !customName.trim()) return;

    // 重複チェック（既存 + キュー）
    const key = `${customCategory}::${customName.trim()}`;
    if (existingKeys.has(key) || pendingProcesses.some((p) => `${p.category}::${p.name}` === key)) {
      setMessage({ type: "error", text: "同じ工程が既に存在または追加済みです" });
      return;
    }

    setPendingProcesses((prev) => [
      ...prev,
      {
        id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        category: customCategory,
        name: customName.trim(),
      },
    ]);
    setCustomName("");
    setMessage({ type: "success", text: `「${customName.trim()}」をキューに追加しました` });
  };

  // テンプレート工程をキューに追加
  const handlePickTemplateProcess = () => {
    const template = availableTemplates.find(
      (item) => item.id === resolvedSelectedTemplateId
    );
    if (!template) return;

    // 子テンプレートも取得
    const childTemplates = initialTemplates.filter(
      (item) => item.parentTemplateId === template.id
    );

    // 重複チェック
    const key = `${template.category}::${template.name.trim()}`;
    if (existingKeys.has(key) || pendingProcesses.some((p) => `${p.category}::${p.name}` === key)) {
      setMessage({ type: "error", text: "同じ工程が既に存在または追加済みです" });
      return;
    }

    // siteIdがある場合はキューに追加（一括保存方式）
    if (siteId) {
      const validChildren = childTemplates.filter(
        (child) => !existingKeys.has(`${child.category}::${child.name.trim()}`)
      );
      setPendingProcesses((prev) => [
        ...prev,
        {
          id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          category: template.category,
          name: template.name,
          templateId: template.id,
          childTemplates: validChildren.map((child) => ({
            category: child.category,
            name: child.name,
            templateId: child.id,
          })),
        },
      ]);

      const childCount = validChildren.length;
      setMessage({
        type: "success",
        text: childCount > 0
          ? `「${template.processCode} ${template.name}」(+子工程${childCount}件)をキューに追加しました`
          : `「${template.processCode} ${template.name}」をキューに追加しました`,
      });
      setSelectedTemplateId("");
      return;
    }

    // siteIdがない場合は従来のローカルstate方式
    const insertAtIndex = processes.findIndex((process) => {
      const matchedTemplate = initialTemplates.find(
        (item) => item.category === process.category && item.name === process.name
      );
      return matchedTemplate ? matchedTemplate.sortOrder > template.sortOrder : false;
    });

    const now = new Date().toISOString();
    const newProcesses: SiteProcessDraftItem[] = [
      {
        id: `draft-process-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        category: template.category,
        name: template.name,
        orderIndex: processes.length + 1,
        progressRate: 0,
        status: "in_progress",
        createdAt: now,
      },
      ...childTemplates
        .filter((child) => !existingKeys.has(`${child.category}::${child.name.trim()}`))
        .map((child) => ({
          id: `draft-process-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${child.id}`,
          category: child.category,
          name: child.name,
          orderIndex: processes.length + 2,
          progressRate: 0,
          status: "in_progress",
          createdAt: now,
        })),
    ];

    const next = [...processes];
    if (insertAtIndex === -1) {
      next.push(...newProcesses);
    } else {
      next.splice(insertAtIndex, 0, ...newProcesses);
    }

    updateProcesses(next);
    closeAddModal();

    const addedCount = newProcesses.length;
    setMessage({
      type: "success",
      text: addedCount > 1
        ? `「${template.processCode} ${template.name}」と子工程${addedCount - 1}件を追加しました`
        : `「${template.processCode} ${template.name}」を追加しました`,
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

  const toggleChecklistPanel = async (processId: string) => {
    const next = new Set(checklistExpanded);
    if (next.has(processId)) {
      next.delete(processId);
      setChecklistExpanded(next);
      return;
    }
    next.add(processId);
    setChecklistExpanded(next);

    if (!checklistCache[processId]) {
      setChecklistLoading((prev) => new Set(prev).add(processId));
      const result = await getProcessChecklist(processId);
      if (result.success && result.items) {
        setChecklistCache((prev) => ({ ...prev, [processId]: result.items! }));
      }
      setChecklistLoading((prev) => {
        const s = new Set(prev);
        s.delete(processId);
        return s;
      });
    }
  };

  const handleToggleCheckItem = (item: ProcessChecklistItem, processId: string) => {
    const newCompleted = !item.isCompleted;
    // Optimistic update
    setChecklistCache((prev) => ({
      ...prev,
      [processId]: (prev[processId] ?? []).map((ci) =>
        ci.id === item.id ? { ...ci, isCompleted: newCompleted } : ci
      ),
    }));
    startChecklistTransition(async () => {
      const result = await toggleChecklistItem(item.id, newCompleted);
      if (!result.success) {
        // Revert on failure
        setChecklistCache((prev) => ({
          ...prev,
          [processId]: (prev[processId] ?? []).map((ci) =>
            ci.id === item.id ? { ...ci, isCompleted: !newCompleted } : ci
          ),
        }));
      } else {
        // Refresh checklist
        const refreshed = await getProcessChecklist(processId);
        if (refreshed.success && refreshed.items) {
          setChecklistCache((prev) => ({ ...prev, [processId]: refreshed.items! }));
        }
        // Refresh progress rate from DB (trigger updates it)
        if (siteId && onChange) {
          const freshProcesses = await getSiteProcesses(siteId);
          if (freshProcesses.success && freshProcesses.processes) {
            onChange(freshProcesses.processes.map((p) => ({
              id: p.id,
              category: p.category,
              name: p.name,
              orderIndex: p.orderIndex,
              progressRate: p.progressRate,
              status: p.status,
              createdAt: p.createdAt,
              parentProcessId: p.parentProcessId,
            })));
          }
        }
      }
    });
  };

  const handleAddCheckItem = (processId: string) => {
    const name = (newItemName[processId] ?? "").trim();
    if (!name) return;
    startChecklistTransition(async () => {
      const result = await addChecklistItem(processId, name);
      if (result.success && result.items) {
        setChecklistCache((prev) => ({ ...prev, [processId]: result.items! }));
        setNewItemName((prev) => ({ ...prev, [processId]: "" }));
      }
    });
  };

  const handleDeleteCheckItem = (itemId: string, processId: string) => {
    startChecklistTransition(async () => {
      const result = await deleteChecklistItem(itemId, processId);
      if (result.success && result.items) {
        setChecklistCache((prev) => ({ ...prev, [processId]: result.items! }));
      }
    });
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

    const isChild = !!process.parentProcessId;

    return (
      <div
        key={process.id}
        ref={(element) => {
          itemRefs.current[process.id] = element;
        }}
        className={`rounded-2xl border bg-white shadow-sm transition ${
          isChild ? "ml-6 border-gray-100 p-3" : "border-gray-200 p-4"
        } ${draggingId === process.id ? "scale-[0.98] opacity-70 shadow-lg" : ""}`}
      >
        <div className="flex items-start gap-3">
          {canManage && !isChild ? (
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
              {isChild ? (
                <>
                  <CornerDownRight size={12} className="shrink-0 text-gray-300" />
                  <span className="shrink-0 rounded bg-sky-50 px-1 py-0.5 text-[9px] font-bold text-sky-400 leading-none">子</span>
                </>
              ) : (
                <span className="shrink-0 rounded bg-indigo-50 px-1 py-0.5 text-[9px] font-bold text-indigo-400 leading-none">親</span>
              )}
              <span className={`truncate font-semibold ${isChild ? "text-[13px] text-gray-600" : "text-[14px] text-gray-800"}`}>
                {process.name}
              </span>
              {process.status === "completed" ? (
                <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
              ) : null}
            </div>
            {!isChild && <p className="mb-3 text-[11px] text-gray-400">{categoryLabel}</p>}
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
            {/* チェックリスト（子工程のみ） */}
            {isChild && <ChecklistPanel
              processId={process.id}
              canManage={canManage}
              isEditing={canManage}
              cache={checklistCache}
              loading={checklistLoading}
              isPending={isPendingChecklist}
              newItemName={newItemName}
              onToggleItem={(item) => handleToggleCheckItem(item, process.id)}
              onDeleteItem={(itemId) => handleDeleteCheckItem(itemId, process.id)}
              onAddItem={() => handleAddCheckItem(process.id)}
              onNameChange={(name) => setNewItemName((prev) => ({ ...prev, [process.id]: name }))}
              onLoad={() => {
                if (!checklistCache[process.id] && !checklistLoading.has(process.id)) {
                  toggleChecklistPanel(process.id);
                }
              }}
            />}

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
                  標準工程またはカスタム工程を追加できます
                </p>
              </div>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#0EA5E9] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#0284C7]"
              >
                <Plus size={14} />
                追加する
              </button>
            </div>

            {/* ペンディングキュー */}
            {pendingProcesses.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-medium text-gray-500">
                  追加予定 ({pendingProcesses.length}件)
                </p>
                {pendingProcesses.map((proc) => (
                  <div key={proc.id} className="flex items-center gap-2 rounded-xl bg-white border border-cyan-100 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-gray-700 truncate block">
                        {proc.name}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {categoryLabelMap[proc.category] ?? proc.category}
                        {proc.childTemplates && proc.childTemplates.length > 0 && (
                          <> (+子工程{proc.childTemplates.length}件)</>
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingProcess(proc.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleBatchSave}
                  disabled={isBatchSaving}
                  className="w-full inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-xl bg-emerald-500 text-[13px] font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                >
                  {isBatchSaving ? "保存中..." : `${pendingProcesses.length}件を一括保存`}
                </button>
              </div>
            )}
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

            {/* タブ切り替え */}
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1 mb-4">
              <button
                type="button"
                onClick={() => setAddMode("template")}
                className={`flex-1 rounded-lg py-2 text-[12px] font-medium transition-all ${
                  addMode === "template" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"
                }`}
              >
                標準工程
              </button>
              <button
                type="button"
                onClick={() => setAddMode("custom")}
                className={`flex-1 rounded-lg py-2 text-[12px] font-medium transition-all ${
                  addMode === "custom" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"
                }`}
              >
                カスタム工程
              </button>
            </div>

            {addMode === "custom" ? (
              /* カスタム工程入力フォーム */
              <div className="space-y-3">
                <div className="relative">
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full min-h-[48px] appearance-none rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-700 focus:outline-none focus:border-[#0EA5E9]/50"
                  >
                    <option value="">工程種別を選択</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat.id} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" />
                </div>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCustomProcess(); } }}
                  placeholder="工程名を入力"
                  className="w-full min-h-[48px] rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#0EA5E9]/50"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={closeAddModal} className="flex-1 min-h-[44px] rounded-xl border border-gray-300 text-[13px] text-gray-500 transition-colors hover:bg-gray-100">
                    閉じる
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomProcess}
                    disabled={!customCategory || !customName.trim()}
                    className="flex-1 min-h-[44px] rounded-xl bg-[#0EA5E9] text-[13px] font-bold text-white transition-colors hover:bg-[#0284C7] disabled:opacity-50"
                  >
                    キューに追加
                  </button>
                </div>
              </div>
            ) : (
            /* 標準工程選択フォーム */
            <>
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
                    {availableTemplates.map((template) => {
                      const childCount = initialTemplates.filter(
                        (t) => t.parentTemplateId === template.id
                      ).length;
                      return (
                        <option key={template.id} value={template.id}>
                          {template.processCode} {template.name}
                          {childCount > 0 ? ` (+子工程${childCount}件)` : ""}
                        </option>
                      );
                    })}
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
                  閉じる
                </button>
                <button
                  type="button"
                  onClick={handlePickTemplateProcess}
                  disabled={!resolvedSelectedTemplateId}
                  className="flex-1 min-h-[44px] rounded-xl bg-[#0EA5E9] text-[13px] font-bold text-white transition-colors hover:bg-[#0284C7] disabled:opacity-50"
                >
                  キューに追加
                </button>
              </div>
            </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
