"use client";

import { useState, useTransition, useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { ProcessCategoryRecord } from "@/lib/processCategories";
import type { ProcessTemplateRecord } from "@/lib/processTemplates";
import { buildTemplateTree } from "@/lib/processTemplates";
import type { ProcessTemplateTreeNode } from "@/lib/processTemplates";
import {
  createProcessCategory,
  deleteProcessCategory,
  updateProcessCategory,
} from "@/app/(dashboard)/admin/process-category-actions";
import {
  createProcessTemplate,
  deleteProcessTemplate,
  moveProcessTemplate,
  updateProcessTemplate,
} from "@/app/(dashboard)/admin/process-template-actions";

const PHASE_OPTIONS = [
  { value: "A", label: "A 躯体" },
  { value: "B", label: "B 外装" },
  { value: "C", label: "C 内装" },
  { value: "D", label: "D 引き渡し" },
] as const;

type PhaseKey = (typeof PHASE_OPTIONS)[number]["value"];

function parseProcessCode(code: string) {
  const match = code.match(/^([A-D])-(\d+)(?:-(\d+))?$/);
  if (!match) return null;

  return {
    phaseKey: match[1] as PhaseKey,
    major: Number(match[2]),
    branch: match[3] ? Number(match[3]) : null,
  };
}

function getNextProcessCode(
  templates: ProcessTemplateRecord[],
  phaseKey: PhaseKey,
  isParallel: boolean
) {
  const phaseItems = templates
    .filter((template) => template.phaseKey === phaseKey)
    .map((template) => ({ template, parsed: parseProcessCode(template.processCode) }))
    .filter(
      (item): item is { template: ProcessTemplateRecord; parsed: NonNullable<ReturnType<typeof parseProcessCode>> } =>
        item.parsed !== null
    );

  const lastItem = phaseItems[phaseItems.length - 1];
  const maxParallelGroup = templates.reduce(
    (max, template) => Math.max(max, template.parallelGroup ?? 0),
    0
  );

  if (!lastItem) {
    return {
      processCode: isParallel ? `${phaseKey}-1-1` : `${phaseKey}-1`,
      parallelGroup: isParallel ? 1 : null,
    };
  }

  if (isParallel) {
    const sameGroupItems =
      lastItem.template.parallelGroup === null
        ? []
        : phaseItems.filter(
            (item) => item.template.parallelGroup === lastItem.template.parallelGroup
          );

    if (
      lastItem.template.parallelGroup !== null &&
      sameGroupItems.every((item) => item.parsed.major === lastItem.parsed.major)
    ) {
      const maxBranch = sameGroupItems.reduce(
        (max, item) => Math.max(max, item.parsed.branch ?? 0),
        0
      );

      return {
        processCode: `${phaseKey}-${lastItem.parsed.major}-${maxBranch + 1}`,
        parallelGroup: lastItem.template.parallelGroup,
      };
    }

    const nextMajor = lastItem.parsed.major + 1;
    return {
      processCode: `${phaseKey}-${nextMajor}-1`,
      parallelGroup: maxParallelGroup + 1,
    };
  }

  return {
    processCode: `${phaseKey}-${lastItem.parsed.major + 1}`,
    parallelGroup: null,
  };
}

function groupParallelItems(items: ProcessTemplateTreeNode[]) {
  const groups: Array<{ key: string; items: ProcessTemplateTreeNode[] }> = [];

  for (const item of items) {
    const last = groups[groups.length - 1];
    if (item.parallelGroup !== null && last?.items[0]?.parallelGroup === item.parallelGroup) {
      last.items.push(item);
      continue;
    }
    groups.push({
      key: item.parallelGroup === null ? item.id : `parallel-${item.parallelGroup}-${item.sortOrder}`,
      items: [item],
    });
  }

  return groups;
}

export function ProcessTemplateManager({
  initialTemplates,
  initialCategories,
}: {
  initialTemplates: ProcessTemplateRecord[];
  initialCategories: ProcessCategoryRecord[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [categories, setCategories] = useState(initialCategories);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [addCategoryLabel, setAddCategoryLabel] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryLabel, setEditCategoryLabel] = useState("");
  const [addPhaseKey, setAddPhaseKey] = useState<PhaseKey>("A");
  const [addCategory, setAddCategory] = useState(initialCategories[0]?.value ?? "");
  const [addName, setAddName] = useState("");
  const [addAsParallel, setAddAsParallel] = useState(false);
  const [addParentTemplateId, setAddParentTemplateId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhaseKey, setEditPhaseKey] = useState<PhaseKey>("A");
  const [editCode, setEditCode] = useState("");
  const [editCategory, setEditCategory] = useState(initialCategories[0]?.value ?? "");
  const [editName, setEditName] = useState("");
  const [editParallelGroup, setEditParallelGroup] = useState("");
  const [editParentTemplateId, setEditParentTemplateId] = useState<string>("");
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const categoryLabelMap = Object.fromEntries(
    categories.map((category) => [category.value, category.label])
  );

  // ルートテンプレート（親がないもの）をセレクト用に抽出
  const rootTemplates = useMemo(
    () => templates.filter((t) => t.parentTemplateId === null),
    [templates]
  );

  // ツリー構造をフェーズ別に構築
  const phaseSections = useMemo(() => {
    const tree = buildTemplateTree(templates);
    return PHASE_OPTIONS.map((phase) => ({
      ...phase,
      items: tree.filter((node) => node.phaseKey === phase.value),
      allItems: templates.filter((t) => t.phaseKey === phase.value),
    }));
  }, [templates]);

  const addCodePreview = getNextProcessCode(templates, addPhaseKey, addAsParallel);

  const toggleExpanded = (parentId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  const handleCreateCategory = () => {
    startTransition(async () => {
      const result = await createProcessCategory(addCategoryLabel);
      if (!result.success || !result.categories) {
        showMessage("error", result.error || "工程種別の追加に失敗しました");
        return;
      }
      setCategories(result.categories);
      setAddCategory(result.categories.at(-1)?.value ?? "");
      setAddCategoryLabel("");
      showMessage("success", "工程種別を追加しました");
    });
  };

  const handleSaveCategory = () => {
    if (!editingCategoryId) return;
    startTransition(async () => {
      const result = await updateProcessCategory({
        categoryId: editingCategoryId,
        label: editCategoryLabel,
      });
      if (!result.success || !result.categories) {
        showMessage("error", result.error || "工程種別の更新に失敗しました");
        return;
      }
      setCategories(result.categories);
      setEditingCategoryId(null);
      showMessage("success", "工程種別を更新しました");
    });
  };

  const handleDeleteCategory = (categoryId: string, value: string) => {
    startTransition(async () => {
      const result = await deleteProcessCategory({ categoryId, value });
      if (!result.success || !result.categories) {
        showMessage("error", result.error || "工程種別の削除に失敗しました");
        return;
      }
      setCategories(result.categories);
      if (addCategory === value) setAddCategory(result.categories[0]?.value ?? "");
      if (editCategory === value) setEditCategory(result.categories[0]?.value ?? "");
      showMessage("success", "工程種別を削除しました");
    });
  };

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createProcessTemplate({
        phaseKey: addPhaseKey,
        processCode: addCodePreview.processCode,
        category: addCategory,
        name: addName,
        parallelGroup: addCodePreview.parallelGroup,
        parentTemplateId: addParentTemplateId || null,
      });
      if (!result.success || !result.templates) {
        showMessage("error", result.error || "追加に失敗しました");
        return;
      }
      setTemplates(result.templates);
      setAddName("");
      setAddAsParallel(false);
      setAddParentTemplateId("");
      showMessage("success", "標準工程を追加しました");
    });
  };

  const handleCreateChild = (parentId: string) => {
    // 親のフェーズとカテゴリを引き継いで追加フォームをセットアップ
    const parent = templates.find((t) => t.id === parentId);
    if (!parent) return;
    setAddPhaseKey(parent.phaseKey);
    setAddCategory(parent.category);
    setAddParentTemplateId(parentId);
    setAddName("");
    setAddAsParallel(false);
    // 追加フォームまでスクロール
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStartEdit = (template: ProcessTemplateRecord) => {
    setEditingId(template.id);
    setEditPhaseKey(template.phaseKey);
    setEditCode(template.processCode);
    setEditCategory(template.category);
    setEditName(template.name);
    setEditParallelGroup(template.parallelGroup?.toString() ?? "");
    setEditParentTemplateId(template.parentTemplateId ?? "");
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    startTransition(async () => {
      const result = await updateProcessTemplate({
        templateId: editingId,
        phaseKey: editPhaseKey,
        processCode: editCode,
        category: editCategory,
        name: editName,
        parallelGroup: editParallelGroup ? Number(editParallelGroup) : null,
        parentTemplateId: editParentTemplateId || null,
      });
      if (!result.success || !result.templates) {
        showMessage("error", result.error || "更新に失敗しました");
        return;
      }
      setTemplates(result.templates);
      setEditingId(null);
      showMessage("success", "標準工程を更新しました");
    });
  };

  const handleDelete = (templateId: string) => {
    startTransition(async () => {
      const result = await deleteProcessTemplate(templateId);
      if (!result.success || !result.templates) {
        showMessage("error", result.error || "削除に失敗しました");
        return;
      }
      setTemplates(result.templates);
      showMessage("success", "標準工程を削除しました");
    });
  };

  const handleMove = (templateId: string, direction: "up" | "down") => {
    startTransition(async () => {
      const result = await moveProcessTemplate({ templateId, direction });
      if (!result.success || !result.templates) {
        showMessage("error", result.error || "並び替えに失敗しました");
        return;
      }
      setTemplates(result.templates);
    });
  };

  /** 単一テンプレートカードの表示（親・子共通） */
  function renderTemplateCard(
    template: ProcessTemplateTreeNode,
    sectionLabel: string,
    isChild: boolean
  ) {
    const index = templates.findIndex((item) => item.id === template.id);
    const isEditing = editingId === template.id;
    const hasChildren = template.children.length > 0;
    const isExpanded = expandedParents.has(template.id);

    return (
      <div key={template.id}>
        <div
          className={`rounded-xl border p-4 ${
            isChild
              ? "border-gray-100 bg-gray-50/50 ml-6"
              : "border-gray-200 bg-gray-50"
          }`}
        >
          {isEditing ? (
            <div className="grid gap-2">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="relative">
                  <select
                    value={editPhaseKey}
                    onChange={(event) => setEditPhaseKey(event.target.value as PhaseKey)}
                    className="min-h-[40px] w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 pr-10 text-[13px] font-medium text-gray-700 focus:outline-none"
                  >
                    {PHASE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                </div>
                <input
                  value={editCode}
                  onChange={(event) => setEditCode(event.target.value)}
                  className="min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-700 focus:outline-none"
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="relative">
                  <select
                    value={editCategory}
                    onChange={(event) => setEditCategory(event.target.value)}
                    className="min-h-[40px] w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 pr-10 text-[13px] font-medium text-gray-700 focus:outline-none"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                </div>
                <input
                  value={editParallelGroup}
                  onChange={(event) => setEditParallelGroup(event.target.value)}
                  placeholder="並行グループ番号"
                  className="min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-700 focus:outline-none"
                />
              </div>
              <div className="relative">
                <select
                  value={editParentTemplateId}
                  onChange={(event) => setEditParentTemplateId(event.target.value)}
                  className="min-h-[40px] w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 pr-10 text-[13px] font-medium text-gray-700 focus:outline-none"
                >
                  <option value="">なし（ルート工程）</option>
                  {rootTemplates
                    .filter((t) => t.id !== editingId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.processCode} {t.name}
                      </option>
                    ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
              </div>
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-700 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={!editCode.trim() || !editCategory || !editName.trim() || isPending}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-[#0EA5E9] px-3 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  <Save size={12} />
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 text-[12px] text-gray-500"
                >
                  <X size={12} />
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {isChild && (
                    <CornerDownRight size={12} className="text-gray-300 flex-shrink-0" />
                  )}
                  {!isChild && hasChildren && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(template.id)}
                      className="rounded p-0.5 text-gray-400 hover:text-[#0EA5E9]"
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  )}
                  <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[11px] font-semibold text-[#0EA5E9]">
                    {template.processCode}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {categoryLabelMap[template.category] ?? template.category}
                  </span>
                  {!isChild && hasChildren && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-500">
                      子工程 {template.children.length}件
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[14px] font-semibold text-gray-800">{template.name}</p>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
                  <span>{sectionLabel}</span>
                  <span>順番 {template.sortOrder}</span>
                  {template.parallelGroup !== null && <span>並行 {template.parallelGroup}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                {!isChild && (
                  <button
                    type="button"
                    onClick={() => handleCreateChild(template.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-violet-500 bg-violet-50 hover:bg-violet-100 transition-colors disabled:opacity-50"
                  >
                    <Plus size={12} />
                    子工程
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleMove(template.id, "up")}
                  disabled={index === 0 || isPending}
                  className="rounded-lg p-2 text-gray-300 hover:bg-white hover:text-[#0EA5E9] disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(template.id, "down")}
                  disabled={index === templates.length - 1 || isPending}
                  className="rounded-lg p-2 text-gray-300 hover:bg-white hover:text-[#0EA5E9] disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleStartEdit(template)}
                  disabled={isPending}
                  className="rounded-lg p-2 text-gray-300 hover:bg-white hover:text-[#0EA5E9]"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(template.id)}
                  disabled={isPending}
                  className="rounded-lg p-2 text-gray-300 hover:bg-red-50 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 子工程の展開表示 */}
        {!isChild && hasChildren && isExpanded && (
          <div className="mt-2 space-y-2">
            {template.children.map((child) =>
              renderTemplateCard(child, sectionLabel, true)
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-bold text-gray-900">標準工程マスター</h1>
            <p className="mt-1 text-[12px] text-gray-400">
              一般住宅の標準工程と工程種別を、時系列に沿って管理します。
            </p>
          </div>
          <span className="rounded-full border border-gray-200 px-3 py-1 text-[11px] text-gray-400">
            工程 {templates.length}件 / 種別 {categories.length}件
          </span>
        </div>

        {message && (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-[12px] ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                : "border-red-200 bg-red-50 text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-gray-800">標準工程を追加</p>
            {addParentTemplateId && (
              <p className="mt-1 text-[12px] text-violet-500">
                子工程として追加（親: {templates.find((t) => t.id === addParentTemplateId)?.name ?? "不明"}）
              </p>
            )}
          </div>
          <span className="text-[15px] font-semibold text-[#0EA5E9]">
            {addCodePreview.processCode}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-[12px] font-medium text-gray-500">フェーズ</span>
            <div className="relative">
              <select
                value={addPhaseKey}
                onChange={(event) => setAddPhaseKey(event.target.value as PhaseKey)}
                className="min-h-[44px] w-full appearance-none rounded-2xl border border-gray-200 bg-white px-4 pr-11 text-[14px] font-medium text-gray-700 shadow-sm focus:outline-none focus:border-[#0EA5E9]/50"
              >
                {PHASE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" />
            </div>
          </label>
          <label className="space-y-1.5">
            <span className="text-[12px] font-medium text-gray-500">工程種別</span>
            <div className="relative">
              <select
                value={addCategory}
                onChange={(event) => setAddCategory(event.target.value)}
                className="min-h-[44px] w-full appearance-none rounded-2xl border border-gray-200 bg-white px-4 pr-11 text-[14px] font-medium text-gray-700 shadow-sm focus:outline-none focus:border-[#0EA5E9]/50"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" />
            </div>
            <button
              type="button"
              onClick={() => setShowCategoryModal(true)}
              className="text-[12px] font-medium text-[#0EA5E9] transition-colors hover:text-[#0284C7]"
            >
              工程種別を編集する&gt;
            </button>
          </label>
          <label className="space-y-1.5">
            <span className="text-[12px] font-medium text-gray-500">親工程</span>
            <div className="relative">
              <select
                value={addParentTemplateId}
                onChange={(event) => setAddParentTemplateId(event.target.value)}
                className="min-h-[44px] w-full appearance-none rounded-2xl border border-gray-200 bg-white px-4 pr-11 text-[14px] font-medium text-gray-700 shadow-sm focus:outline-none focus:border-[#0EA5E9]/50"
              >
                <option value="">なし（ルート工程）</option>
                {rootTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.processCode} {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" />
            </div>
          </label>
          <div className="hidden md:block" />
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[12px] font-medium text-gray-500">工程名</span>
            <input
              value={addName}
              onChange={(event) => setAddName(event.target.value)}
              placeholder="工程名を入力"
              className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-[14px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#0EA5E9]/50"
            />
          </label>
          <label className="-mt-1 flex items-center gap-2 px-1 text-[13px] text-gray-700 md:col-span-2">
            <input
              type="checkbox"
              checked={addAsParallel}
              onChange={(event) => setAddAsParallel(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-[#0EA5E9] focus:ring-[#0EA5E9]"
            />
            <span>直前工程と並行で追加する</span>
          </label>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!addCategory || !addName.trim() || isPending}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#0EA5E9] px-5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            <Plus size={14} />
            追加
          </button>
          {addParentTemplateId && (
            <button
              type="button"
              onClick={() => setAddParentTemplateId("")}
              className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-gray-300 px-4 text-[12px] text-gray-500"
            >
              <X size={12} />
              親工程の選択を解除
            </button>
          )}
        </div>
      </section>

      <div className="space-y-5">
        {phaseSections.map((section) => {
          const grouped = groupParallelItems(section.items);
          return (
            <section key={section.value} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-gray-800">{section.label}</h2>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] text-gray-500">
                  {section.allItems.length}件
                </span>
              </div>

              <div className="space-y-4">
                {grouped.map((group) => (
                  <div
                    key={group.key}
                    className={`grid gap-3 ${group.items.length > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}
                  >
                    {group.items.map((template) =>
                      renderTemplateCard(template, section.label, false)
                    )}
                  </div>
                ))}
                {section.items.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-[12px] text-gray-400">
                    このフェーズの標準工程はまだありません。
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-bold text-gray-900">工程種別マスター</h2>
                <p className="text-[12px] text-gray-400">既存種別は残したまま、追加・編集・削除できます。</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategoryId(null);
                }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
              <div className="flex gap-2">
                <input
                  value={addCategoryLabel}
                  onChange={(event) => setAddCategoryLabel(event.target.value)}
                  placeholder="新しい工程種別名"
                  className="min-h-[44px] flex-1 rounded-xl border border-gray-200 bg-white px-4 text-[14px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#0EA5E9]/50"
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={!addCategoryLabel.trim() || isPending}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#0EA5E9] px-4 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  <Plus size={14} />
                  追加
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {categories.map((category) => (
                <div key={category.id} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  {editingCategoryId === category.id ? (
                    <div className="flex gap-2">
                      <input
                        value={editCategoryLabel}
                        onChange={(event) => setEditCategoryLabel(event.target.value)}
                        className="min-h-[40px] flex-1 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-700 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSaveCategory}
                        disabled={!editCategoryLabel.trim() || isPending}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-[#0EA5E9] px-3 text-[12px] font-semibold text-white disabled:opacity-50"
                      >
                        <Save size={12} />
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCategoryId(null)}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 text-[12px] text-gray-500"
                      >
                        <X size={12} />
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold text-gray-800">{category.label}</p>
                        <p className="text-[11px] text-gray-400">{category.value}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategoryId(category.id);
                            setEditCategoryLabel(category.label);
                          }}
                          className="rounded-lg p-2 text-gray-300 hover:bg-white hover:text-[#0EA5E9]"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(category.id, category.value)}
                          className="rounded-lg p-2 text-gray-300 hover:bg-red-50 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
