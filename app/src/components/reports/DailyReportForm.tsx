"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  createDailyReport,
  deleteCreatedReports,
  fetchProcesses,
  fetchProcessChecklistItems,
  replaceReportMaterials,
} from "@/app/(dashboard)/reports/new/actions";
import { syncReportPhotoToStorage } from "@/app/(dashboard)/storage/actions";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Cloud,
  Eye,
  HardHat,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  UserCheck,
  Users,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeInput } from "@/components/ui/TimeInput";
import { Select, SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PHOTO_TYPE_OPTIONS, WORK_PROCESS_LABELS } from "@/lib/constants";

type SiteOption = { id: string; name: string };
type ProcessOption = {
  id: string;
  category: string;
  name: string;
  progress_rate: number;
  status: string;
  parent_process_id?: string | null;
};
type WorkerOption = { id: string; name: string; role: string };
type PhotoItem = { file: File; photoType: string; caption: string; processId?: string; processName?: string };
type ChecklistItem = { id: string; processId: string; name: string; isCompleted: boolean };
type MaterialMeterItem = { material_name: string; quantity: string; unit: string };
type SelectedProcessItem = {
  processId: string;
  category: string;
  name: string;
  progressRate: string;
  hasChecklist: boolean;
  checklistItems: ChecklistItem[];
};

interface FormData {
  siteName: string;
  siteId: string;
  selectedProcesses: SelectedProcessItem[];
  reportDate: string;
  workDescription: string;
  workers: string;
  weather: string;
  arrivalTime: string;
  departureTime: string;
  issues: string;
  materialMeters: MaterialMeterItem[];
  photos: PhotoItem[];
}

interface FormErrors {
  siteName?: string;
  reportDate?: string;
  selectedProcesses?: string;
  workDescription?: string;
  workers?: string;
}

const PROGRESS_RATE_OPTIONS: SelectOption[] = Array.from({ length: 11 }, (_, i) => {
  const value = i * 10;
  return { value: String(value), label: `${value}%` };
});

const WEATHER_OPTIONS: SelectOption[] = [
  { value: "晴れ", label: "晴れ" },
  { value: "曇り", label: "曇り" },
  { value: "雨", label: "雨" },
  { value: "雪", label: "雪" },
];

const STEP_LABELS = ["基本情報", "作業内容", "写真・動画", "確認"];
const MAX_PHOTOS = 50;

// 画像圧縮（最大1920px、JPEG品質0.8、動画はそのまま）
async function compressImage(file: File): Promise<File> {
  if (file.type.startsWith("video/")) return file;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX_SIZE = 1920;
      let { width, height } = img;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = Math.round(height * (MAX_SIZE / width));
          width = MAX_SIZE;
        } else {
          width = Math.round(width * (MAX_SIZE / height));
          height = MAX_SIZE;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.8
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
const TOTAL_STEPS = 4;
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

const INITIAL_FORM_DATA: FormData = {
  siteName: "",
  siteId: "",
  selectedProcesses: [],
  reportDate: new Date().toISOString().split("T")[0],
  workDescription: "",
  workers: "",
  weather: "",
  arrivalTime: "",
  departureTime: "",
  issues: "",
  materialMeters: [{ material_name: "", quantity: "", unit: "" }],
  photos: [],
};

function getCategoryLabel(category: string) {
  return WORK_PROCESS_LABELS[category] ?? category;
}

function StepIndicator({
  currentStep,
  totalSteps,
  labels,
}: {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}) {
  return (
    <div className="mb-8 w-full">
      <div className="relative flex items-center justify-between">
        <div className="absolute left-0 right-0 top-5 z-0 h-0.5 bg-gray-200" />
        <div
          className="absolute left-0 top-5 z-0 h-0.5 bg-[#0EA5E9] transition-all duration-500 ease-out"
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />
        {Array.from({ length: totalSteps }, (_, index) => {
          const step = index + 1;
          const isDone = step < currentStep;
          const isActive = step === currentStep;

          return (
            <div key={step} className="z-10 flex flex-col items-center gap-2">
              <div
                className={[
                  "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-300",
                  isDone
                    ? "bg-[#0EA5E9] text-white shadow-lg shadow-[#0EA5E9]/30"
                    : isActive
                      ? "scale-110 bg-[#0EA5E9] text-white ring-4 ring-[#0EA5E9]/20 shadow-lg shadow-[#0EA5E9]/30"
                      : "border border-gray-200 bg-gray-100 text-gray-400",
                ].join(" ")}
              >
                {isDone ? <CheckCircle2 size={20} /> : step}
              </div>
              <span
                className={[
                  "text-[11px] font-semibold",
                  isActive ? "text-[#0EA5E9]" : isDone ? "text-gray-500" : "text-gray-300",
                ].join(" ")}
              >
                {labels[index]}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-[11px] text-gray-400">
        ステップ {currentStep} / {totalSteps}
      </p>
    </div>
  );
}

function Step1({
  data,
  errors,
  onChange,
  onProcessesChange,
  initialSites,
}: {
  data: FormData;
  errors: FormErrors;
  onChange: (field: keyof FormData, value: string) => void;
  onProcessesChange: (processes: SelectedProcessItem[]) => void;
  initialSites: SiteOption[];
}) {
  const [sites] = useState<SiteOption[]>(initialSites);
  const [processes, setProcesses] = useState<ProcessOption[]>([]);
  const [processesLoading, setProcessesLoading] = useState(Boolean(data.siteId));

  useEffect(() => {
    if (!data.siteId) return;
    const matchedSite = sites.find((site) => site.id === data.siteId);
    if (matchedSite && matchedSite.name !== data.siteName) {
      onChange("siteName", matchedSite.name);
    }
  }, [data.siteId, data.siteName, onChange, sites]);

  useEffect(() => {
    if (!data.siteId) return;

    let cancelled = false;
    fetchProcesses(data.siteId)
      .then((nextProcesses) => {
        if (cancelled) return;
        setProcesses(nextProcesses ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setProcesses([]);
      })
      .finally(() => {
        if (!cancelled) setProcessesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data.siteId]);

  const selectedProcessMap = useMemo(
    () =>
      new Map(
        data.selectedProcesses.map((process) => [
          process.processId,
          process,
        ])
      ),
    [data.selectedProcesses]
  );

  // 子を持つプロセスID（＝親工程）を特定
  const parentIds = useMemo(() => {
    const ids = new Set<string>();
    processes.forEach((p) => {
      if (p.parent_process_id) ids.add(p.parent_process_id);
    });
    return ids;
  }, [processes]);

  const groupedProcesses = useMemo(() => {
    const groups = new Map<string, ProcessOption[]>();
    processes.forEach((process) => {
      const current = groups.get(process.category) ?? [];
      current.push(process);
      groups.set(process.category, current);
    });

    return Array.from(groups.entries())
      .sort((a, b) => getCategoryLabel(a[0]).localeCompare(getCategoryLabel(b[0]), "ja"))
      .map(([category, items]) => ({
        category,
        label: getCategoryLabel(category),
        items,
      }));
  }, [processes, parentIds]);

  const handleSiteChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const siteId = event.target.value;
    const site = sites.find((item) => item.id === siteId);
    onChange("siteId", siteId);
    onChange("siteName", site?.name ?? "");
    onProcessesChange([]);
    setProcesses([]);
    setProcessesLoading(Boolean(siteId));
  };

  const toggleProcess = async (process: ProcessOption) => {
    const current = selectedProcessMap.get(process.id);

    if (current) {
      onProcessesChange(
        data.selectedProcesses.filter((item) => item.processId !== process.id)
      );
      return;
    }

    // チェックリスト項目を取得
    let checklistItems: ChecklistItem[] = [];
    let hasChecklist = false;
    try {
      const items = await fetchProcessChecklistItems([process.id]);
      if (items.length > 0) {
        hasChecklist = true;
        checklistItems = items.map((item) => ({
          id: item.id,
          processId: item.process_id,
          name: item.name,
          isCompleted: item.is_completed,
        }));
      }
    } catch {
      // チェックリスト取得失敗時は従来の%入力にフォールバック
    }

    onProcessesChange([
      ...data.selectedProcesses,
      {
        processId: process.id,
        category: process.category,
        name: process.name,
        progressRate: String(process.progress_rate),
        hasChecklist,
        checklistItems,
      },
    ]);
  };

  const handleProgressChange = (processId: string, progressRate: string) => {
    onProcessesChange(
      data.selectedProcesses.map((process) =>
        process.processId === processId ? { ...process, progressRate } : process
      )
    );
  };

  const siteOptions: SelectOption[] = sites.map((site) => ({
    value: site.id,
    label: site.name,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="mb-1 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50">
          <Building2 size={20} className="text-[#0EA5E9]" />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-gray-900">基本情報</h2>
          <p className="text-[13px] text-gray-400">現場と作業工程を入力してください</p>
        </div>
      </div>

      {siteOptions.length === 0 ? (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
          <p className="text-[13px] font-semibold text-[#0EA5E9]">現場が未登録です</p>
          <p className="mt-1 text-[12px] text-gray-400">
            管理者に現場の登録を依頼してください。
          </p>
        </div>
      ) : (
        <Select
          label="現場名"
          options={siteOptions}
          value={data.siteId}
          onChange={handleSiteChange}
          error={errors.siteName}
          placeholder="現場を選択してください"
          required
        />
      )}

      <Input
        label="報告日"
        type="date"
        value={data.reportDate}
        onChange={(event) => onChange("reportDate", event.target.value)}
        error={errors.reportDate}
        required
      />

      {data.siteId && !processesLoading && processes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-amber-600">
            <AlertTriangle size={14} />
            この現場には工程が登録されていません
          </p>
          <p className="mt-1 text-[12px] text-gray-400">
            マネージャーに現場の工程設定を依頼してください。
          </p>
        </div>
      ) : null}

      {processesLoading && data.siteId ? (
        <div className="flex items-center gap-2 py-3 text-[13px] text-gray-400">
          <Loader2 size={16} className="animate-spin text-[#0EA5E9]" />
          工程一覧を読み込み中...
        </div>
      ) : groupedProcesses.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-medium text-gray-500">
              工程・進捗率
              <span className="ml-1 text-xs text-[#0EA5E9]">*</span>
            </label>
            <span className="text-[11px] text-gray-400">
              {data.selectedProcesses.length}件選択中
            </span>
          </div>

          {groupedProcesses.map((group) => (
            <div key={group.category} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50">
                  <HardHat size={15} className="text-[#0EA5E9]" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-gray-800">{group.label}</p>
                  <p className="text-[11px] text-gray-400">{group.items.length}件</p>
                </div>
              </div>

              <div className="space-y-2">
                {group.items.map((process) => {
                  const selected = selectedProcessMap.get(process.id);
                  const rate = Number(selected?.progressRate ?? process.progress_rate) || 0;
                  const isParent = parentIds.has(process.id);
                  const isChild = !!process.parent_process_id;

                  if (isParent) {
                    return (
                      <div
                        key={process.id}
                        className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-2.5 text-left"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-[13px] font-semibold text-gray-500">
                            {process.name}
                          </p>
                          <span className="text-[12px] font-medium text-gray-400">
                            {process.progress_rate}%
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={process.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleProcess(process)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleProcess(process); } }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-all cursor-pointer ${
                        selected
                          ? "border-cyan-300 bg-cyan-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/40"
                      } ${isChild ? "ml-4" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-semibold text-gray-800">
                            {isChild ? "↳ " : ""}{process.name}
                          </p>
                          <p className="mt-1 text-[11px] text-gray-400">
                            現在の公式進捗 {process.progress_rate}%
                          </p>
                        </div>
                        <span
                          className={`inline-flex min-h-[28px] items-center rounded-full px-2.5 text-[11px] font-semibold ${
                            selected
                              ? "bg-[#0EA5E9] text-white"
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {selected ? "選択中" : "未選択"}
                        </span>
                      </div>

                      {selected ? (
                        <div
                          className="mt-3 border-t border-cyan-100 pt-3"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {selected.hasChecklist && selected.checklistItems.length > 0 ? (
                            /* チェックリスト方式（孫工程あり） */
                            <div className="flex flex-col gap-2">
                              <label className="text-[12px] font-medium text-gray-500">
                                作業チェックリスト（{selected.checklistItems.filter((ci) => ci.isCompleted).length}/{selected.checklistItems.length}）
                              </label>
                              <div className="space-y-1.5">
                                {selected.checklistItems.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                      const updated = selected.checklistItems.map((ci) =>
                                        ci.id === item.id ? { ...ci, isCompleted: !ci.isCompleted } : ci
                                      );
                                      const completedCount = updated.filter((ci) => ci.isCompleted).length;
                                      const newRate = updated.length > 0 ? Math.round((completedCount / updated.length) * 100) : 0;
                                      onProcessesChange(
                                        data.selectedProcesses.map((p) =>
                                          p.processId === process.id
                                            ? { ...p, checklistItems: updated, progressRate: String(newRate) }
                                            : p
                                        )
                                      );
                                    }}
                                    className={`flex items-center gap-2.5 w-full text-left rounded-xl px-3 py-2 transition-colors ${
                                      item.isCompleted ? "bg-emerald-50" : "bg-gray-50 hover:bg-gray-100"
                                    }`}
                                  >
                                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                                      item.isCompleted ? "border-emerald-400 bg-emerald-400 text-white" : "border-gray-300 bg-white"
                                    }`}>
                                      {item.isCompleted && <CheckCircle2 size={12} />}
                                    </div>
                                    <span className={`text-[13px] ${item.isCompleted ? "text-gray-400 line-through" : "text-gray-700"}`}>
                                      {item.name}
                                    </span>
                                  </button>
                                ))}
                              </div>
                              <div className="mt-1 flex items-center gap-3">
                                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className="h-full rounded-full bg-emerald-400 transition-all duration-500 ease-out"
                                    style={{ width: `${rate}%` }}
                                  />
                                </div>
                                <span className="w-10 text-right text-[13px] font-bold text-emerald-500">
                                  {rate}%
                                </span>
                              </div>
                            </div>
                          ) : (
                            /* 従来の%入力方式（チェックリストなし） */
                            <div className="flex flex-col gap-2">
                              <label className="text-[12px] font-medium text-gray-500">
                                担当者見込み進捗
                              </label>
                              <div className="relative">
                                <select
                                  value={selected.progressRate}
                                  onChange={(event) =>
                                    handleProgressChange(process.id, event.target.value)
                                  }
                                  className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-10 text-[14px] text-gray-700 focus:border-[#0EA5E9]/50 focus:outline-none"
                                >
                                  {PROGRESS_RATE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="mt-1 flex items-center gap-3">
                                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className="h-full rounded-full bg-[#0EA5E9] transition-all duration-500 ease-out"
                                    style={{ width: `${rate}%` }}
                                  />
                                </div>
                                <span className="w-10 text-right text-[13px] font-bold text-[#0EA5E9]">
                                  {rate}%
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {errors.selectedProcesses ? (
            <p className="flex items-center gap-1 text-[12px] text-red-400">
              <AlertTriangle size={12} />
              {errors.selectedProcesses}
            </p>
          ) : null}
        </div>
      ) : null}

      <Select
        label="天候"
        options={WEATHER_OPTIONS}
        value={data.weather}
        onChange={(event) => onChange("weather", event.target.value)}
        placeholder="天候を選択"
      />

      <div className="grid grid-cols-2 gap-3">
        <TimeInput
          label="現場到着時間"
          value={data.arrivalTime}
          onChange={(val) => onChange("arrivalTime", val)}
        />
        <TimeInput
          label="現場退出時間"
          value={data.departureTime}
          onChange={(val) => onChange("departureTime", val)}
        />
      </div>

      <Textarea
        label="報告記入欄"
        placeholder="安全上の注意点や申し送り事項があれば記入してください"
        value={data.issues}
        onChange={(event) => onChange("issues", event.target.value)}
        maxLength={500}
        showCharCount
        rows={3}
      />
    </div>
  );
}

function Step2({
  data,
  errors,
  onChange,
  initialWorkers,
}: {
  data: FormData;
  errors: FormErrors;
  onChange: (field: keyof FormData, value: string) => void;
  initialWorkers: WorkerOption[];
}) {
  const [workerOptions] = useState<WorkerOption[]>(initialWorkers);
  const [customWorker, setCustomWorker] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const selectedWorkers = data.workers
    ? data.workers.split("、").map((worker) => worker.trim()).filter(Boolean)
    : [];

  const toggleWorker = (name: string) => {
    const current = new Set(selectedWorkers);
    if (current.has(name)) current.delete(name);
    else current.add(name);
    onChange("workers", Array.from(current).join("、"));
  };

  const addCustomWorker = () => {
    const name = customWorker.trim();
    if (!name) return;
    const matchedWorker = workerOptions.find((worker) => worker.name === name);
    const current = new Set(selectedWorkers);
    current.add(matchedWorker?.name ?? name);
    onChange("workers", Array.from(current).join("、"));
    setCustomWorker("");
    setShowCustomInput(false);
  };

  const removeWorker = (name: string) => {
    onChange(
      "workers",
      selectedWorkers.filter((worker) => worker !== name).join("、")
    );
  };

  const roleLabels: Record<string, string> = {
    admin: "管理者",
    manager: "マネージャー",
    worker_internal: "ワーカー",
    worker_external: "パートナー",
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="mb-1 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50">
          <ClipboardList size={20} className="text-[#0EA5E9]" />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-gray-900">作業内容</h2>
          <p className="text-[13px] text-gray-400">今日の作業内容を入力してください</p>
        </div>
      </div>

      <Textarea
        label="作業内容"
        placeholder={"本日実施した作業内容を具体的に記入してください\n例：1階部分の型枠組み立て作業を実施。柱・梁の配筋検査も行った。"}
        value={data.workDescription}
        onChange={(event) => onChange("workDescription", event.target.value)}
        error={errors.workDescription}
        maxLength={500}
        showCharCount
        rows={5}
        required
      />

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-800">材料・数量</h3>
            <p className="text-[12px] text-gray-400">材料名・数量・単位を自由入力で追加できます</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange(
                "materialMeters",
                JSON.stringify([...data.materialMeters, { material_name: "", quantity: "", unit: "" }])
              )
            }
          >
            <Plus size={16} />
            追加
          </Button>
        </div>

        <div className="space-y-3">
          {data.materialMeters.map((item, index) => (
            <div key={`material-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_100px_88px_auto]">
              <input
                type="text"
                value={item.material_name}
                onChange={(event) => {
                  const next = data.materialMeters.map((material, materialIndex) =>
                    materialIndex === index
                      ? { ...material, material_name: event.target.value }
                      : material
                  );
                  onChange("materialMeters", JSON.stringify(next));
                }}
                placeholder="材料名"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[14px] text-gray-700 focus:border-[#0EA5E9]/50 focus:outline-none"
              />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={item.quantity}
                onChange={(event) => {
                  const next = data.materialMeters.map((material, materialIndex) =>
                    materialIndex === index
                      ? { ...material, quantity: event.target.value }
                      : material
                  );
                  onChange("materialMeters", JSON.stringify(next));
                }}
                placeholder="数量"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[14px] text-gray-700 focus:border-[#0EA5E9]/50 focus:outline-none"
              />
              <input
                type="text"
                value={item.unit}
                onChange={(event) => {
                  const next = data.materialMeters.map((material, materialIndex) =>
                    materialIndex === index
                      ? { ...material, unit: event.target.value }
                      : material
                  );
                  onChange("materialMeters", JSON.stringify(next));
                }}
                placeholder="単位"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[14px] text-gray-700 focus:border-[#0EA5E9]/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const next = data.materialMeters.filter((_, materialIndex) => materialIndex !== index);
                  onChange(
                    "materialMeters",
                    JSON.stringify(next.length > 0 ? next : [{ material_name: "", quantity: "", unit: "" }])
                  );
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-200 px-3 text-gray-400 hover:bg-gray-50 hover:text-red-400"
                aria-label="材料行を削除"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function Step3({
  data,
  onPhotoAdd,
  onPhotoRemove,
  onPhotoTypeChange,
  onPhotoCaptionChange,
  onProcessPhotoAdd,
}: {
  data: FormData;
  onPhotoAdd: (files: FileList) => void;
  onPhotoRemove: (index: number) => void;
  onPhotoTypeChange: (index: number, photoType: string) => void;
  onPhotoCaptionChange: (index: number, caption: string) => void;
  onProcessPhotoAdd: (files: FileList, processId: string, processName: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files.length > 0) onPhotoAdd(event.dataTransfer.files);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onPhotoAdd(event.target.files);
      event.target.value = "";
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    fileInputRef.current?.click();
  };

  // グローバル写真（工程に紐付いていないもの）のみカウント
  const globalPhotos = data.photos.filter((item) => !item.processId);
  const photoCount = globalPhotos.filter((item) => !item.file.type.startsWith("video/")).length;
  const videoCount = globalPhotos.filter((item) => item.file.type.startsWith("video/")).length;
  const photoTypeOptionsWithEmpty: SelectOption[] = [
    { value: "", label: "未選択" },
    ...PHOTO_TYPE_OPTIONS,
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="mb-1 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50">
          <Camera size={20} className="text-[#0EA5E9]" />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-gray-900">写真・動画</h2>
          <p className="text-[13px] text-gray-400">現場の写真・動画を添付（任意）</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        className="group relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-gray-300 bg-white px-6 py-12 transition-colors hover:border-cyan-300 hover:bg-cyan-50/50"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-200 bg-gray-100 transition-all group-hover:border-cyan-200 group-hover:bg-cyan-50">
          <ImagePlus size={28} className="text-gray-400 transition-colors group-hover:text-[#0EA5E9]" />
        </div>
        <div className="text-center">
          <p className="text-[14px] font-semibold text-gray-600 transition-colors group-hover:text-gray-900">
            タップして写真・動画を選択
          </p>
          <p className="mt-1 text-[12px] text-gray-400">またはここにドラッグ＆ドロップ</p>
          <p className="mt-2 text-[11px] text-gray-300">
            写真: JPEG, PNG, HEIC（最大10MB）/ 動画: MP4等（最大50MB）
          </p>
        </div>
      </div>

      {globalPhotos.length > 0 ? (
        <div>
          <p className="mb-3 text-[13px] font-medium text-gray-400">
            選択済み: {photoCount > 0 ? `写真 ${photoCount}枚` : ""}
            {photoCount > 0 && videoCount > 0 ? " / " : ""}
            {videoCount > 0 ? `動画 ${videoCount}本` : ""}
          </p>
          <div className="space-y-3">
            {globalPhotos.map((item, _idx) => {
              const index = data.photos.indexOf(item);
              const isVideo = item.file.type.startsWith("video/");
              const url = URL.createObjectURL(item.file);

              return (
                <div
                  key={`${item.file.name}-${index}`}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                >
                  <div className="relative">
                    {isVideo ? (
                      <div className="relative">
                        <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-[11px] font-semibold text-[#0EA5E9]">
                          <Video size={12} />
                          動画
                        </div>
                        <video
                          src={url}
                          controls
                          className="max-h-48 w-full bg-black object-contain"
                          preload="metadata"
                        />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={item.caption || `選択写真 ${index + 1}`}
                        className="aspect-[16/10] w-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onPhotoRemove(index);
                      }}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500/80 text-white transition-colors hover:bg-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-2 p-3">
                    <input
                      type="text"
                      placeholder="タイトルを入力（任意）"
                      value={item.caption}
                      onChange={(event) => {
                        event.stopPropagation();
                        onPhotoCaptionChange(index, event.target.value);
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-700 placeholder-gray-300 focus:border-[#0EA5E9]/50 focus:outline-none"
                    />
                    <select
                      value={item.photoType}
                      onChange={(event) => {
                        event.stopPropagation();
                        onPhotoTypeChange(index, event.target.value);
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-600 focus:border-[#0EA5E9]/50 focus:outline-none"
                    >
                      {photoTypeOptionsWithEmpty.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-[13px] leading-relaxed text-gray-400">
            写真・動画は任意です。作業前・作業中・完了後の状況がわかるファイルを添付すると報告の精度が上がります。
          </p>
        </div>
      )}

      {/* 工程別写真添付 */}
      {data.selectedProcesses.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Camera size={16} className="text-[#0EA5E9]" />
            <h3 className="text-[14px] font-semibold text-gray-700">工程別の写真添付</h3>
          </div>
          <p className="text-[12px] text-gray-400 mb-3">各工程の施工前・施工中・施工後の写真を添付できます</p>
          <div className="space-y-3">
            {data.selectedProcesses.map((process) => {
              const processPhotos = data.photos.filter((p) => p.processId === process.processId);
              return (
                <div key={process.processId} className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-medium text-gray-700">{process.name}</span>
                    <label className="inline-flex items-center gap-1 text-[11px] text-[#0EA5E9] font-medium cursor-pointer hover:underline">
                      <ImagePlus size={12} /> 写真を追加
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        ref={(el) => { processFileInputRefs.current[process.processId] = el; }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            onProcessPhotoAdd(e.target.files, process.processId, process.name);
                            e.target.value = "";
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {processPhotos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {processPhotos.map((item, idx) => {
                        const globalIdx = data.photos.findIndex((p) => p === item || (p.file === item.file && p.processId === item.processId));
                        const url = URL.createObjectURL(item.file);
                        return (
                          <div key={`${process.processId}-${idx}`} className="relative rounded-lg overflow-hidden border border-gray-200">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="aspect-square w-full object-cover" />
                            <div className="p-1.5 space-y-1">
                              <select
                                value={item.photoType}
                                onChange={(e) => { e.stopPropagation(); onPhotoTypeChange(globalIdx, e.target.value); }}
                                className="w-full rounded border border-gray-200 bg-gray-50 px-1.5 py-1 text-[10px] focus:outline-none"
                              >
                                <option value="before">施工前</option>
                                <option value="during">施工中</option>
                                <option value="after">施工後</option>
                              </select>
                              <input
                                type="text"
                                placeholder="補足..."
                                value={item.caption}
                                onChange={(e) => { e.stopPropagation(); onPhotoCaptionChange(globalIdx, e.target.value); }}
                                className="w-full rounded border border-gray-200 bg-gray-50 px-1.5 py-1 text-[10px] focus:outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => onPhotoRemove(globalIdx)}
                              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500/80 text-white"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-300 text-center py-2">写真なし</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-[#0EA5E9]/60">{icon}</span>
      <span className="w-16 shrink-0 text-[12px] text-gray-400">{label}</span>
      <span className="text-[13px] font-medium text-gray-700">{value}</span>
    </div>
  );
}

function Step4({ data }: { data: FormData }) {
  const photoCount = data.photos.filter((item) => !item.file.type.startsWith("video/")).length;
  const videoCount = data.photos.filter((item) => item.file.type.startsWith("video/")).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="mb-1 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50">
          <Eye size={20} className="text-[#0EA5E9]" />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-gray-900">内容確認</h2>
          <p className="text-[13px] text-gray-400">送信前に内容をご確認ください</p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">
          基本情報
        </h3>
        <div className="space-y-2">
          <PreviewRow icon={<Building2 size={14} />} label="現場" value={data.siteName} />
          <PreviewRow icon={<CalendarDays size={14} />} label="報告日" value={data.reportDate} />
          {data.weather ? (
            <PreviewRow icon={<Cloud size={14} />} label="天候" value={data.weather} />
          ) : null}
          {(data.arrivalTime || data.departureTime) ? (
            <PreviewRow icon={<Clock size={14} />} label="現場時間" value={`${data.arrivalTime || "--:--"} 〜 ${data.departureTime || "--:--"}`} />
          ) : null}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">
          工程・進捗率
        </h3>
        <div className="space-y-2">
          {data.selectedProcesses.map((process) => {
            const rate = Number(process.progressRate) || 0;
            return (
              <div
                key={process.processId}
                className="rounded-xl border border-gray-200 bg-gray-50 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800">
                      {process.name}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {getCategoryLabel(process.category)}
                    </p>
                  </div>
                  <span className="text-[13px] font-bold text-[#0EA5E9]">{rate}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-[#0EA5E9]"
                    style={{ width: `${rate}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">
          作業内容
        </h3>
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">
          {data.workDescription}
        </p>
      </div>

      {data.materialMeters.some((item) => item.material_name.trim() || item.quantity.trim()) ? (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">
            材料・数量
          </h3>
          <div className="space-y-2">
            {data.materialMeters
              .filter((item) => item.material_name.trim() || item.quantity.trim())
              .map((item, index) => (
                <div key={`preview-material-${index}`} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                  <span className="text-[13px] font-medium text-gray-700">{item.material_name || "未入力"}</span>
                  <span className="text-[13px] font-semibold text-[#0EA5E9]">
                    {item.quantity || "0"}{item.unit || ""}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {data.issues ? (
        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-red-400" />
            <h3 className="text-[12px] font-semibold text-red-400">報告記入欄</h3>
          </div>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-600">
            {data.issues}
          </p>
        </div>
      ) : null}

      {data.photos.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">
            添付ファイル ({photoCount > 0 ? `写真${photoCount}枚` : ""}
            {photoCount > 0 && videoCount > 0 ? " / " : ""}
            {videoCount > 0 ? `動画${videoCount}本` : ""})
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {data.photos.map((item, index) => {
              const isVideo = item.file.type.startsWith("video/");
              const url = URL.createObjectURL(item.file);
              return (
                <div
                  key={`${item.file.name}-${index}`}
                  className="relative overflow-hidden rounded-lg border border-gray-200"
                >
                  {isVideo ? (
                    <div className="flex aspect-square w-full items-center justify-center bg-black/40">
                      <Video size={20} className="text-[#0EA5E9]" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={item.caption || `写真${index + 1}`}
                      className="aspect-square w-full object-cover"
                    />
                  )}
                  {item.caption ? (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-1.5 py-1">
                      <p className="truncate text-[10px] text-white/80">{item.caption}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CompletionScreen({ onReset, warning }: { onReset: () => void; warning?: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-500/30 bg-emerald-500/10">
        <CheckCircle2 size={40} className="text-emerald-400" />
      </div>
      <div>
        <h2 className="text-[22px] font-bold text-gray-900">報告完了</h2>
        <p className="mt-2 text-[14px] text-gray-400">日次報告が正常に送信されました</p>
      </div>
      {warning && (
        <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
          <p className="text-[13px] text-amber-600">{warning}</p>
        </div>
      )}
      <div className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm">
        <p className="text-[13px] leading-relaxed text-gray-500">
          報告内容は担当者に通知されました。内容の確認・修正は報告一覧から行えます。
        </p>
      </div>
      <Button variant="outline" size="lg" onClick={onReset} className="w-full">
        新しい報告を作成
      </Button>
    </div>
  );
}

function DraftSavedScreen({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-500/30 bg-amber-500/10">
        <Save size={40} className="text-amber-400" />
      </div>
      <div>
        <h2 className="text-[22px] font-bold text-gray-900">下書き保存完了</h2>
        <p className="mt-2 text-[14px] text-gray-400">報告が下書きとして保存されました</p>
      </div>
      <div className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm">
        <p className="text-[13px] leading-relaxed text-gray-500">
          下書きは報告一覧から確認・編集・提出できます。
        </p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <Link href="/reports">
          <Button variant="primary" size="lg" className="w-full">
            報告一覧を見る
          </Button>
        </Link>
        <Button variant="outline" size="lg" onClick={onReset} className="w-full">
          新しい報告を作成
        </Button>
      </div>
    </div>
  );
}

export function DailyReportForm({
  initialSiteId,
  initialSites,
  initialWorkers,
}: {
  initialSiteId?: string;
  initialSites: SiteOption[];
  initialWorkers: WorkerOption[];
}) {
  const [formData, setFormData] = useState<FormData>({
    ...INITIAL_FORM_DATA,
    siteId: initialSiteId ?? "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isPending, startTransition] = useTransition();
  const [isComplete, setIsComplete] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]:
        field === "materialMeters"
          ? (JSON.parse(value) as MaterialMeterItem[])
          : value,
    }));
    setErrors((prev) => {
      if (prev[field as keyof FormErrors]) {
        return { ...prev, [field]: undefined };
      }
      return prev;
    });
  }, []);

  const handleProcessesChange = useCallback((selectedProcesses: SelectedProcessItem[]) => {
    setFormData((prev) => ({ ...prev, selectedProcesses }));
    setErrors((prev) => {
      if (prev.selectedProcesses) {
        return { ...prev, selectedProcesses: undefined };
      }
      return prev;
    });
  }, []);

  const handlePhotoAdd = useCallback(async (files: FileList) => {
    const sizeErrors: string[] = [];
    const validFiles: File[] = [];
    const currentCount = formData.photos.length;

    for (const file of Array.from(files)) {
      if (currentCount + validFiles.length >= MAX_PHOTOS) {
        sizeErrors.push(`添付は最大${MAX_PHOTOS}枚までです`);
        break;
      }
      const isVideo = file.type.startsWith("video/");
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_PHOTO_SIZE;
      if (file.size > maxSize) {
        sizeErrors.push(`${file.name}: ${isVideo ? "動画" : "写真"}は${isVideo ? "50MB" : "10MB"}以下にしてください`);
      } else {
        validFiles.push(file);
      }
    }

    if (sizeErrors.length > 0) {
      setSubmitError(sizeErrors.join("\n"));
      setTimeout(() => setSubmitError(null), 5000);
    }

    if (validFiles.length > 0) {
      const compressed = await Promise.all(validFiles.map(compressImage));
      const items: PhotoItem[] = compressed.map((file) => ({ file, photoType: "", caption: "" }));
      setFormData((prev) => ({ ...prev, photos: [...prev.photos, ...items] }));
    }
  }, [formData.photos.length]);

  const handlePhotoRemove = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, photoIndex) => photoIndex !== index),
    }));
  }, []);

  const handlePhotoTypeChange = useCallback((index: number, photoType: string) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.map((item, photoIndex) =>
        photoIndex === index ? { ...item, photoType } : item
      ),
    }));
  }, []);

  const handlePhotoCaptionChange = useCallback((index: number, caption: string) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.map((item, photoIndex) =>
        photoIndex === index ? { ...item, caption } : item
      ),
    }));
  }, []);

  const validateAll = () => {
    const nextErrors: FormErrors = {};
    if (!formData.siteId) nextErrors.siteName = "現場を選択してください";
    if (!formData.reportDate) nextErrors.reportDate = "報告日を選択してください";
    if (formData.selectedProcesses.length === 0) {
      nextErrors.selectedProcesses = "工程を1つ以上選択してください";
    }
    if (!formData.workDescription.trim()) {
      nextErrors.workDescription = "作業内容を入力してください";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // 下書き用バリデーション（現場と日付のみ必須）
  const validateForDraft = () => {
    const nextErrors: FormErrors = {};
    if (!formData.siteId) nextErrors.siteName = "現場を選択してください";
    if (!formData.reportDate) nextErrors.reportDate = "報告日を選択してください";
    if (formData.selectedProcesses.length === 0) {
      nextErrors.selectedProcesses = "工程を1つ以上選択してください";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleSaveDraft = async () => {
    if (!validateForDraft()) return;
    setSubmitError(null);
    setIsSavingDraft(true);

    try {
      const result = await createDailyReport({
        siteName: formData.siteName,
        siteId: formData.siteId || undefined,
        reportDate: formData.reportDate,
        workDescription: formData.workDescription,
        workers: formData.workers,
        weather: formData.weather,
        arrivalTime: formData.arrivalTime,
        departureTime: formData.departureTime,
        issues: formData.issues,
        isDraft: true,
        processes: formData.selectedProcesses.map((process) => ({
          processId: process.processId,
          workProcess: process.category,
          progressRate: process.progressRate,
          name: process.name,
        })),
      });

      if (!result.success) {
        setSubmitError(result.error || "下書き保存に失敗しました");
        return;
      }

      const targetReportIds = result.reportIds ?? (result.reportId ? [result.reportId] : []);

      const materialsResult = await replaceReportMaterials(
        targetReportIds,
        formData.materialMeters
      );
      if (!materialsResult.success) {
        await deleteCreatedReports(targetReportIds);
        setSubmitError(materialsResult.error || "材料の保存に失敗しました");
        return;
      }

      // 写真をクライアントから直接アップロード
      if (formData.photos.length > 0 && targetReportIds.length > 0) {
        const supabase = createBrowserClient();
        const firstReportId = targetReportIds[0];
        const VALID_PHOTO_TYPES = ["before", "during", "after", "corner_ne", "corner_nw", "corner_se", "corner_sw"];

        for (let i = 0; i < formData.photos.length; i++) {
          const item = formData.photos[i];
          const file = item.file;
          if (!file || file.size === 0) continue;

          const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const storagePath = `reports/${firstReportId}/${Date.now()}_${i}.${ext}`;
          const mediaType = file.type.startsWith("video/") ? "video" : "photo";
          const photoType = VALID_PHOTO_TYPES.includes(item.photoType) ? item.photoType : "during";

          const { error: uploadError } = await supabase.storage
            .from("report-photos")
            .upload(storagePath, file, { cacheControl: "3600", upsert: false });

          if (uploadError) {
            await deleteCreatedReports(targetReportIds);
            setSubmitError(`写真のアップロードに失敗しました: ${uploadError.message}`);
            return;
          }

          const insertData: Record<string, unknown> = {
            report_id: firstReportId,
            storage_path: storagePath,
            photo_type: photoType,
            media_type: mediaType,
            caption: item.caption || null,
          };
          if (item.processId) insertData.process_id = item.processId;

          const { error: dbError } = await supabase.from("report_photos").insert(insertData);
          if (dbError) {
            await supabase.storage.from("report-photos").remove([storagePath]);
            await deleteCreatedReports(targetReportIds);
            setSubmitError(`写真の保存に失敗しました: ${dbError.message}`);
            return;
          }
        }
      }

      setDraftSaved(true);
    } catch (err) {
      setSubmitError(`保存中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePreSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateAll()) return;
    setShowPreview(true);
  };

  const handleSubmit = async () => {
    setSubmitError(null);

    startTransition(async () => {
      try {
        const result = await createDailyReport({
          siteName: formData.siteName,
          siteId: formData.siteId || undefined,
          reportDate: formData.reportDate,
          workDescription: formData.workDescription,
          workers: formData.workers,
          weather: formData.weather,
          arrivalTime: formData.arrivalTime,
          departureTime: formData.departureTime,
          issues: formData.issues,
          processes: formData.selectedProcesses.map((process) => ({
            processId: process.processId,
            workProcess: process.category,
            progressRate: process.progressRate,
            name: process.name,
          })),
        });

        if (!result.success) {
          setSubmitError(result.error || "報告の送信に失敗しました");
          return;
        }

        const targetReportIds = result.reportIds ?? (result.reportId ? [result.reportId] : []);

        const materialsResult = await replaceReportMaterials(
          targetReportIds,
          formData.materialMeters
        );
        if (!materialsResult.success) {
          await deleteCreatedReports(targetReportIds);
          setSubmitError(materialsResult.error || "材料の保存に失敗しました");
          return;
        }

        // 写真をクライアントから直接Supabase Storageにアップロード
        if (formData.photos.length > 0 && targetReportIds.length > 0) {
          const supabase = createBrowserClient();
          const firstReportId = targetReportIds[0];
          const VALID_PHOTO_TYPES = ["before", "during", "after", "corner_ne", "corner_nw", "corner_se", "corner_sw"];

          for (let i = 0; i < formData.photos.length; i++) {
            const item = formData.photos[i];
            const file = item.file;
            if (!file || file.size === 0) continue;

            const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
            const storagePath = `reports/${firstReportId}/${Date.now()}_${i}.${ext}`;
            const mediaType = file.type.startsWith("video/") ? "video" : "photo";
            const photoType = VALID_PHOTO_TYPES.includes(item.photoType) ? item.photoType : "during";

            // Storageにアップロード
            const { error: uploadError } = await supabase.storage
              .from("report-photos")
              .upload(storagePath, file, { cacheControl: "3600", upsert: false });

            if (uploadError) {
              await deleteCreatedReports(targetReportIds);
              setSubmitError(`写真のアップロードに失敗しました: ${uploadError.message}`);
              return;
            }

            // report_photosテーブルにINSERT
            const insertData: Record<string, unknown> = {
              report_id: firstReportId,
              storage_path: storagePath,
              photo_type: photoType,
              media_type: mediaType,
              caption: item.caption || null,
            };
            if (item.processId) insertData.process_id = item.processId;

            const { error: dbError } = await supabase.from("report_photos").insert(insertData);

            if (dbError) {
              // DB保存失敗 → アップロード済みファイルを削除
              await supabase.storage.from("report-photos").remove([storagePath]);
              await deleteCreatedReports(targetReportIds);
              setSubmitError(`写真の保存に失敗しました: ${dbError.message}`);
              return;
            }

            // ストレージフォルダに自動反映
            if (formData.siteId) {
              syncReportPhotoToStorage({
                siteId: formData.siteId,
                processId: item.processId || undefined,
                photoType: photoType,
                storagePath,
                fileName: file.name,
                fileSize: file.size,
              }).catch((err) => console.error("[StorageSync] Error:", err));
            }
          }
        }

        setIsComplete(true);
      } catch (err) {
        setSubmitError(`送信中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  };

  const handleReset = () => {
    setFormData({
      ...INITIAL_FORM_DATA,
      siteId: initialSiteId ?? "",
    });
    setErrors({});
    setIsComplete(false);
    setDraftSaved(false);
  };

  return (
    <div className="flex flex-1 items-start justify-center overflow-x-hidden px-5 py-8 md:px-8 md:py-10">
      <div className="min-w-0 w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold tracking-tight text-gray-900">日次報告</h1>
          <p className="text-[13px] text-gray-400">現場作業報告システム</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
          {isComplete || draftSaved ? (
            draftSaved ? (
              <DraftSavedScreen onReset={handleReset} />
            ) : (
              <CompletionScreen onReset={handleReset} warning={submitError} />
            )
          ) : showPreview ? (
            /* プレビュー確認画面（別画面） */
            <div>
              <Step4 data={formData} />

              {submitError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="whitespace-pre-line text-[13px] text-red-400">
                    {submitError}
                  </p>
                </div>
              ) : null}

              <div className="mt-8 flex flex-col gap-3">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  loading={isPending}
                  className="w-full"
                  onClick={handleSubmit}
                >
                  {isPending ? "送信中..." : "送信する"}
                  {!isPending ? <CheckCircle2 size={20} /> : null}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  disabled={isPending}
                  onClick={() => setShowPreview(false)}
                >
                  <ChevronLeft size={20} />
                  修正する
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePreSubmit} noValidate>
              <div className="space-y-8">
                <Step1
                  data={formData}
                  errors={errors}
                  onChange={handleChange}
                  onProcessesChange={handleProcessesChange}
                  initialSites={initialSites}
                />

                <div className="border-t border-gray-100" />

                <Step2
                  data={formData}
                  errors={errors}
                  onChange={handleChange}
                  initialWorkers={initialWorkers}
                />

                <div className="border-t border-gray-100" />

                <Step3
                  data={formData}
                  onPhotoAdd={handlePhotoAdd}
                  onPhotoRemove={handlePhotoRemove}
                  onPhotoTypeChange={handlePhotoTypeChange}
                  onPhotoCaptionChange={handlePhotoCaptionChange}
                  onProcessPhotoAdd={async (files, processId, processName) => {
                    const compressed = await Promise.all(Array.from(files).map(compressImage));
                    const newPhotos: PhotoItem[] = compressed.map((file) => ({
                      file,
                      photoType: "during",
                      caption: "",
                      processId,
                      processName,
                    }));
                    setFormData((prev) => ({
                      ...prev,
                      photos: [...prev.photos, ...newPhotos],
                    }));
                  }}
                />
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={isSavingDraft}
                >
                  確認する
                  <Eye size={20} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  loading={isSavingDraft}
                  disabled={isPending}
                  className="w-full"
                  onClick={handleSaveDraft}
                >
                  {isSavingDraft ? "保存中..." : "下書き保存"}
                  {!isSavingDraft ? <Save size={20} /> : null}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
