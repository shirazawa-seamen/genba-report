"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  createDailyReport,
  fetchProcesses,
  uploadReportPhotos,
} from "@/app/(dashboard)/reports/new/actions";
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
  UserCheck,
  Users,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
};
type WorkerOption = { id: string; name: string; role: string };
type PhotoItem = { file: File; photoType: string; caption: string };
type SelectedProcessItem = {
  processId: string;
  category: string;
  name: string;
  progressRate: string;
};

interface FormData {
  siteName: string;
  siteId: string;
  selectedProcesses: SelectedProcessItem[];
  reportDate: string;
  workDescription: string;
  workers: string;
  weather: string;
  workHours: string;
  issues: string;
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
  workHours: "",
  issues: "",
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
  }, [processes]);

  const handleSiteChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const siteId = event.target.value;
    const site = sites.find((item) => item.id === siteId);
    onChange("siteId", siteId);
    onChange("siteName", site?.name ?? "");
    onProcessesChange([]);
    setProcesses([]);
    setProcessesLoading(Boolean(siteId));
  };

  const toggleProcess = (process: ProcessOption) => {
    const current = selectedProcessMap.get(process.id);

    if (current) {
      onProcessesChange(
        data.selectedProcesses.filter((item) => item.processId !== process.id)
      );
      return;
    }

    onProcessesChange([
      ...data.selectedProcesses,
      {
        processId: process.id,
        category: process.category,
        name: process.name,
        progressRate: String(process.progress_rate),
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

                  return (
                    <button
                      key={process.id}
                      type="button"
                      onClick={() => toggleProcess(process)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                        selected
                          ? "border-cyan-300 bg-cyan-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-semibold text-gray-800">
                            {process.name}
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
                        </div>
                      ) : null}
                    </button>
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

      <Input
        label="作業時間（時間）"
        type="number"
        placeholder="例：8"
        value={data.workHours}
        onChange={(event) => onChange("workHours", event.target.value)}
        min={0}
        max={24}
        step={0.5}
      />

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

    </div>
  );
}

function Step3({
  data,
  onPhotoAdd,
  onPhotoRemove,
  onPhotoTypeChange,
  onPhotoCaptionChange,
}: {
  data: FormData;
  onPhotoAdd: (files: FileList) => void;
  onPhotoRemove: (index: number) => void;
  onPhotoTypeChange: (index: number, photoType: string) => void;
  onPhotoCaptionChange: (index: number, caption: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const photoCount = data.photos.filter((item) => !item.file.type.startsWith("video/")).length;
  const videoCount = data.photos.filter((item) => item.file.type.startsWith("video/")).length;
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

      {data.photos.length > 0 ? (
        <div>
          <p className="mb-3 text-[13px] font-medium text-gray-400">
            選択済み: {photoCount > 0 ? `写真 ${photoCount}枚` : ""}
            {photoCount > 0 && videoCount > 0 ? " / " : ""}
            {videoCount > 0 ? `動画 ${videoCount}本` : ""}
          </p>
          <div className="space-y-3">
            {data.photos.map((item, index) => {
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
          {data.workHours ? (
            <PreviewRow icon={<Clock size={14} />} label="作業時間" value={`${data.workHours}時間`} />
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

function CompletionScreen({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-500/30 bg-emerald-500/10">
        <CheckCircle2 size={40} className="text-emerald-400" />
      </div>
      <div>
        <h2 className="text-[22px] font-bold text-gray-900">報告完了</h2>
        <p className="mt-2 text-[14px] text-gray-400">日次報告が正常に送信されました</p>
      </div>
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

export function DailyReportForm({
  initialSiteId,
  initialSites,
  initialWorkers,
}: {
  initialSiteId?: string;
  initialSites: SiteOption[];
  initialWorkers: WorkerOption[];
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    ...INITIAL_FORM_DATA,
    siteId: initialSiteId ?? "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isPending, startTransition] = useTransition();
  const [isComplete, setIsComplete] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleChange = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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

  const handlePhotoAdd = useCallback((files: FileList) => {
    const validItems: PhotoItem[] = [];
    const sizeErrors: string[] = [];

    Array.from(files).forEach((file) => {
      const isVideo = file.type.startsWith("video/");
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_PHOTO_SIZE;
      if (file.size > maxSize) {
        sizeErrors.push(
          `${file.name}: ${isVideo ? "動画" : "写真"}は${isVideo ? "50MB" : "10MB"}以下にしてください`
        );
      } else {
        validItems.push({ file, photoType: "", caption: "" });
      }
    });

    if (sizeErrors.length > 0) {
      setSubmitError(sizeErrors.join("\n"));
      setTimeout(() => setSubmitError(null), 5000);
    }

    if (validItems.length > 0) {
      setFormData((prev) => ({ ...prev, photos: [...prev.photos, ...validItems] }));
    }
  }, []);

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

  const validateStep = (targetStep: number) => {
    const nextErrors: FormErrors = {};

    if (targetStep === 1) {
      if (!formData.siteId) nextErrors.siteName = "現場を選択してください";
      if (!formData.reportDate) nextErrors.reportDate = "報告日を選択してください";
      if (formData.selectedProcesses.length === 0) {
        nextErrors.selectedProcesses = "工程を1つ以上選択してください";
      } else if (
        formData.selectedProcesses.some((process) => process.progressRate.trim() === "")
      ) {
        nextErrors.selectedProcesses = "選択した工程の進捗率を設定してください";
      }
    }

    if (targetStep === 2) {
      if (!formData.workDescription.trim()) {
        nextErrors.workDescription = "作業内容を入力してください";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (isNavigating) return;
    if (!validateStep(step)) return;
    setIsNavigating(true);
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    setTimeout(() => setIsNavigating(false), 300);
  };

  const handleBack = () => {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step !== TOTAL_STEPS || isNavigating) return;

    setSubmitError(null);

    startTransition(async () => {
      const result = await createDailyReport({
        siteName: formData.siteName,
        siteId: formData.siteId || undefined,
        reportDate: formData.reportDate,
        workDescription: formData.workDescription,
        workers: formData.workers,
        weather: formData.weather,
        workHours: formData.workHours,
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

      if (formData.photos.length > 0 && targetReportIds.length > 0) {
        for (const reportId of targetReportIds) {
          const photoFormData = new FormData();
          formData.photos.forEach((item) => {
            photoFormData.append("photos", item.file);
            photoFormData.append("photoTypes", item.photoType || "other");
            photoFormData.append("captions", item.caption || "");
          });

          const uploadResult = await uploadReportPhotos({
            reportId,
            photos: photoFormData,
          });

          if (!uploadResult.success) {
            console.warn("アップロードエラー:", uploadResult.error);
          }
        }
      }

      setIsComplete(true);
    });
  };

  const handleReset = () => {
    setFormData({
      ...INITIAL_FORM_DATA,
      siteId: initialSiteId ?? "",
    });
    setErrors({});
    setStep(1);
    setIsComplete(false);
  };

  return (
    <div className="flex flex-1 items-start justify-center overflow-x-hidden px-5 py-8 md:px-8 md:py-10">
      <div className="min-w-0 w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold tracking-tight text-gray-900">日次報告</h1>
          <p className="text-[13px] text-gray-400">現場作業報告システム</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
          {isComplete ? (
            <CompletionScreen onReset={handleReset} />
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <StepIndicator
                currentStep={step}
                totalSteps={TOTAL_STEPS}
                labels={STEP_LABELS}
              />

              <div className="min-h-[360px]">
                {step === 1 ? (
                  <Step1
                    data={formData}
                    errors={errors}
                    onChange={handleChange}
                    onProcessesChange={handleProcessesChange}
                    initialSites={initialSites}
                  />
                ) : null}
                {step === 2 ? (
                  <Step2
                    data={formData}
                    errors={errors}
                    onChange={handleChange}
                    initialWorkers={initialWorkers}
                  />
                ) : null}
                {step === 3 ? (
                  <Step3
                    data={formData}
                    onPhotoAdd={handlePhotoAdd}
                    onPhotoRemove={handlePhotoRemove}
                    onPhotoTypeChange={handlePhotoTypeChange}
                    onPhotoCaptionChange={handlePhotoCaptionChange}
                  />
                ) : null}
                {step === 4 ? <Step4 data={formData} /> : null}
              </div>

              {submitError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="whitespace-pre-line text-[13px] text-red-400">
                    {submitError}
                  </p>
                </div>
              ) : null}

              <div className="mt-8 flex gap-3">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={handleBack}
                    className="flex-1"
                  >
                    <ChevronLeft size={20} />
                    戻る
                  </Button>
                ) : null}

                {step < TOTAL_STEPS ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={handleNext}
                    disabled={isNavigating}
                    className="flex-1"
                  >
                    次へ
                    <ChevronRight size={20} />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={isPending}
                    disabled={isNavigating}
                    className="flex-1"
                  >
                    {isPending ? "送信中..." : "報告を送信"}
                    {!isPending ? <CheckCircle2 size={20} /> : null}
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
