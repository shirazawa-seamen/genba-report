"use client";

import React, { useState, useRef, useEffect, useCallback, useTransition } from "react";
import {
  createDailyReport,
  uploadReportPhotos,
  saveReportMaterials,
  fetchSites,
  fetchProcesses,
  createProcess,
  fetchLatestProgress,
} from "@/app/(dashboard)/reports/new/actions";
import {
  Building2,
  HardHat,
  Users,
  TrendingUp,
  Camera,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  ImagePlus,
  ClipboardList,
  Cloud,
  Clock,
  AlertTriangle,
  Loader2,
  Plus,
  Video,
  Package,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WORK_PROCESS_OPTIONS, PHOTO_TYPE_OPTIONS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SiteOption = { id: string; name: string };
type ProcessOption = { id: string; category: string; name: string; progress_rate: number; status: string };
type PhotoItem = { file: File; photoType: string };
type MaterialItem = { material_name: string; product_number: string; quantity: string; unit: string; supplier: string; note: string };

interface FormData {
  siteName: string;
  siteId: string;
  processId: string;
  reportDate: string;
  workProcess: string;
  workDescription: string;
  workers: string;
  progressRate: string;
  weather: string;
  workHours: string;
  issues: string;
  materials: MaterialItem[];
  photos: PhotoItem[];
}

interface FormErrors {
  siteName?: string;
  reportDate?: string;
  workProcess?: string;
  workDescription?: string;
  workers?: string;
  progressRate?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PROGRESS_RATE_OPTIONS: SelectOption[] = Array.from(
  { length: 11 },
  (_, i) => {
    const val = i * 10;
    return { value: String(val), label: `${val}%` };
  }
);

const WEATHER_OPTIONS: SelectOption[] = [
  { value: "sunny", label: "晴れ" },
  { value: "cloudy", label: "曇り" },
  { value: "rainy", label: "雨" },
  { value: "snowy", label: "雪" },
];

const STEP_LABELS = ["基本情報", "作業内容", "写真・動画"];
const TOTAL_STEPS = 3;
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

// ---------------------------------------------------------------------------
// StepIndicator
// ---------------------------------------------------------------------------
function StepIndicator({ currentStep, totalSteps, labels }: { currentStep: number; totalSteps: number; labels: string[] }) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-white/[0.08] z-0" />
        <div className="absolute left-0 top-5 h-0.5 bg-[#00D9FF] z-0 transition-all duration-500 ease-out" style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }} />
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isDone = step < currentStep;
          const isActive = step === currentStep;
          return (
            <div key={step} className="flex flex-col items-center gap-2 z-10">
              <div className={[
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                isDone ? "bg-[#00D9FF] text-[#0e0e0e] shadow-lg shadow-[#00D9FF]/30"
                  : isActive ? "bg-[#00D9FF] text-[#0e0e0e] ring-4 ring-[#00D9FF]/20 shadow-lg shadow-[#00D9FF]/30 scale-110"
                    : "bg-white/[0.08] text-white/35 border border-white/[0.1]",
              ].join(" ")}>
                {isDone ? <CheckCircle2 size={20} /> : step}
              </div>
              <span className={["text-[11px] font-semibold", isActive ? "text-[#00D9FF]" : isDone ? "text-white/50" : "text-white/25"].join(" ")}>
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-center mt-4 text-[11px] text-white/30">ステップ {currentStep} / {totalSteps}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1
// ---------------------------------------------------------------------------
function Step1({ data, errors, onChange }: { data: FormData; errors: FormErrors; onChange: (field: keyof FormData, value: string) => void }) {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [processes, setProcesses] = useState<ProcessOption[]>([]);
  const [processesLoading, setProcessesLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showNewProcess, setShowNewProcess] = useState(false);
  const [newProcessName, setNewProcessName] = useState("");
  const [creatingProcess, setCreatingProcess] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSitesLoading(true);
    fetchSites().then((result) => { if (!cancelled) { setSites(result); if (data.siteId) { const m = result.find((s) => s.id === data.siteId); if (m) onChange("siteName", m.name); } } })
      .catch(() => { if (!cancelled) setSitesError("現場一覧の取得に失敗しました"); })
      .finally(() => { if (!cancelled) setSitesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!data.siteId) { setProcesses([]); setSelectedCategory(""); return; }
    let cancelled = false;
    setProcessesLoading(true);
    fetchProcesses(data.siteId).then((d) => { if (!cancelled) setProcesses(d); })
      .catch(() => { if (!cancelled) setProcessError("工程一覧の取得に失敗しました"); })
      .finally(() => { if (!cancelled) setProcessesLoading(false); });
    return () => { cancelled = true; };
  }, [data.siteId]);

  const handleSiteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const siteId = e.target.value;
    const site = sites.find((s) => s.id === siteId);
    onChange("siteId", siteId); onChange("siteName", site?.name ?? "");
    onChange("processId", ""); onChange("workProcess", "");
    setSelectedCategory(""); setShowNewProcess(false); setNewProcessName("");
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value;
    setSelectedCategory(category); onChange("workProcess", category); onChange("processId", "");
    setShowNewProcess(false); setNewProcessName("");
  };

  const filteredProcesses = processes.filter((p) => p.category === selectedCategory);

  const handleProcessChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "__new__") { setShowNewProcess(true); onChange("processId", ""); return; }
    setShowNewProcess(false); setNewProcessName(""); onChange("processId", value);
    if (value) { try { const rate = await fetchLatestProgress(value); onChange("progressRate", String(rate)); } catch { /* ignore */ } }
  };

  const handleCreateProcess = async () => {
    const name = newProcessName.trim();
    if (!name || !data.siteId || !selectedCategory) return;
    setCreatingProcess(true); setProcessError(null);
    try {
      const result = await createProcess(data.siteId, selectedCategory, name);
      if (!result.success) { setProcessError(result.error ?? "工程の作成に失敗しました"); return; }
      const newProc = result.process as ProcessOption;
      setProcesses((prev) => [...prev, newProc]);
      onChange("processId", newProc.id); onChange("progressRate", "0");
      setShowNewProcess(false); setNewProcessName("");
    } catch { setProcessError("工程の作成に失敗しました"); } finally { setCreatingProcess(false); }
  };

  const siteOptions: SelectOption[] = sites.map((s) => ({ value: s.id, label: s.name }));
  const processOptions: SelectOption[] = [...filteredProcesses.map((p) => ({ value: p.id, label: `${p.name}（${p.progress_rate}%）` })), { value: "__new__", label: "＋ 新規工程を作成" }];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00D9FF]/10">
          <Building2 size={20} className="text-[#00D9FF]" />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-white/90">基本情報</h2>
          <p className="text-[13px] text-white/40">現場と日付を入力してください</p>
        </div>
      </div>

      {sitesLoading ? (
        <div className="flex items-center gap-2 text-[13px] text-white/40 py-3"><Loader2 size={16} className="animate-spin text-[#00D9FF]" />現場一覧を読み込み中...</div>
      ) : sitesError ? (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4"><p className="text-[13px] text-red-400">{sitesError}</p></div>
      ) : siteOptions.length === 0 ? (
        <div className="rounded-xl bg-[#00D9FF]/[0.06] border border-[#00D9FF]/15 p-4">
          <p className="text-[13px] text-[#00D9FF] font-semibold">現場が未登録です</p>
          <p className="text-[12px] text-white/40 mt-1">管理者に現場の登録を依頼してください。</p>
        </div>
      ) : (
        <Select label="現場名" options={siteOptions} value={data.siteId} onChange={handleSiteChange} error={errors.siteName} placeholder="現場を選択してください" required />
      )}

      <Input label="報告日" type="date" value={data.reportDate} onChange={(e) => onChange("reportDate", e.target.value)} error={errors.reportDate} required />

      <Select label="作業工程（種別）" options={WORK_PROCESS_OPTIONS} value={selectedCategory} onChange={handleCategoryChange} error={!selectedCategory && errors.workProcess ? errors.workProcess : undefined} placeholder="工程種別を選択" required disabled={!data.siteId} />

      {selectedCategory && data.siteId && (
        <>
          {processesLoading ? (
            <div className="flex items-center gap-2 text-[13px] text-white/40 py-3"><Loader2 size={16} className="animate-spin text-[#00D9FF]" />工程一覧を読み込み中...</div>
          ) : (
            <Select label="工程" options={processOptions} value={data.processId} onChange={handleProcessChange} placeholder="工程を選択" required />
          )}
          {showNewProcess && (
            <div className="flex flex-col gap-3 rounded-xl bg-white/[0.03] border border-white/[0.08] p-4">
              <p className="text-[13px] font-semibold text-white/70">新規工程を作成</p>
              <Input placeholder="工程名を入力（例：1階柱配筋）" value={newProcessName} onChange={(e) => setNewProcessName(e.target.value)} autoFocus />
              {processError && <p className="text-[13px] text-red-400 flex items-center gap-1.5"><AlertTriangle size={14} />{processError}</p>}
              <Button type="button" variant="primary" size="sm" onClick={handleCreateProcess} disabled={!newProcessName.trim() || creatingProcess} loading={creatingProcess}>
                <Plus size={16} />{creatingProcess ? "作成中..." : "作成して選択"}
              </Button>
            </div>
          )}
        </>
      )}

      <Select label="天候" options={WEATHER_OPTIONS} value={data.weather} onChange={(e) => onChange("weather", e.target.value)} placeholder="天候を選択" />
      <Input label="作業時間（時間）" type="number" placeholder="例：8" value={data.workHours} onChange={(e) => onChange("workHours", e.target.value)} min={0} max={24} step={0.5} />
      <Textarea label="特記事項" placeholder="安全上の注意点や申し送り事項があれば記入してください" value={data.issues} onChange={(e) => onChange("issues", e.target.value)} maxLength={500} showCharCount rows={3} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2
// ---------------------------------------------------------------------------
function Step2({ data, errors, onChange, onMaterialAdd, onMaterialRemove, onMaterialChange }: {
  data: FormData; errors: FormErrors; onChange: (field: keyof FormData, value: string) => void;
  onMaterialAdd: () => void; onMaterialRemove: (index: number) => void; onMaterialChange: (index: number, field: keyof MaterialItem, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00D9FF]/10"><ClipboardList size={20} className="text-[#00D9FF]" /></div>
        <div>
          <h2 className="text-[18px] font-bold text-white/90">作業内容</h2>
          <p className="text-[13px] text-white/40">今日の作業を入力してください</p>
        </div>
      </div>

      <Textarea label="作業内容" placeholder={"本日実施した作業内容を具体的に記入してください\n例：1階部分の型枠組み立て作業を実施。柱・梁の配筋検査も行った。"} value={data.workDescription} onChange={(e) => onChange("workDescription", e.target.value)} error={errors.workDescription} maxLength={500} showCharCount rows={5} required />
      <Input label="作業者名" placeholder="例：田中 太郎、鈴木 次郎" value={data.workers} onChange={(e) => onChange("workers", e.target.value)} error={errors.workers} helperText="複数名の場合は読点（、）で区切ってください" required />

      <div className="flex flex-col gap-1.5">
        <Select label="進捗率" options={PROGRESS_RATE_OPTIONS} placeholder="進捗率を選択" value={data.progressRate} onChange={(e) => onChange("progressRate", e.target.value)} error={errors.progressRate} required />
        {data.progressRate && (
          <div className="mt-1.5 flex items-center gap-3">
            <div className="flex-1 h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-[#00D9FF] transition-all duration-500 ease-out" style={{ width: `${data.progressRate}%` }} />
            </div>
            <span className="text-[13px] font-bold text-[#00D9FF] w-10 text-right">{data.progressRate}%</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-[13px] font-medium text-white/50 flex items-center gap-2">
          <Package size={14} className="text-white/35" /> 使用材料 <span className="text-white/25 text-[11px]">任意</span>
        </label>
        {data.materials.map((mat, idx) => (
          <div key={idx} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/35 font-medium">材料 {idx + 1}</span>
              <button type="button" onClick={() => onMaterialRemove(idx)} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:bg-red-500/15 hover:text-red-400 transition-colors"><X size={14} /></button>
            </div>
            <Input placeholder="材料名（例：塩ビ管 VU100）" value={mat.material_name} onChange={(e) => onMaterialChange(idx, "material_name", e.target.value)} />
            <Input placeholder="品番" value={mat.product_number} onChange={(e) => onMaterialChange(idx, "product_number", e.target.value)} />
            <div className="flex gap-2">
              <div className="flex-1"><Input type="number" placeholder="数量" value={mat.quantity} onChange={(e) => onMaterialChange(idx, "quantity", e.target.value)} min={0} step={0.1} /></div>
              <div className="w-24"><Input placeholder="単位" value={mat.unit} onChange={(e) => onMaterialChange(idx, "unit", e.target.value)} /></div>
            </div>
            <Input placeholder="納入元" value={mat.supplier} onChange={(e) => onMaterialChange(idx, "supplier", e.target.value)} />
          </div>
        ))}
        <button type="button" onClick={onMaterialAdd} className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 min-h-[48px] text-[13px] text-white/40 hover:border-[#00D9FF]/30 hover:text-[#00D9FF]/70 transition-colors">
          <Plus size={16} /> 材料を追加
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3
// ---------------------------------------------------------------------------
function Step3({ data, onPhotoAdd, onPhotoRemove, onPhotoTypeChange }: {
  data: FormData; onPhotoAdd: (files: FileList) => void; onPhotoRemove: (index: number) => void; onPhotoTypeChange: (index: number, photoType: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files.length > 0) onPhotoAdd(e.dataTransfer.files); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) { onPhotoAdd(e.target.files); e.target.value = ""; } };
  const handleClick = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); };
  const photoCount = data.photos.filter((p) => !p.file.type.startsWith("video/")).length;
  const videoCount = data.photos.filter((p) => p.file.type.startsWith("video/")).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00D9FF]/10"><Camera size={20} className="text-[#00D9FF]" /></div>
        <div>
          <h2 className="text-[18px] font-bold text-white/90">写真・動画</h2>
          <p className="text-[13px] text-white/40">現場の写真・動画を添付（任意）</p>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileChange} className="hidden" />

      <div onClick={handleClick} onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-white/[0.12] bg-white/[0.02] px-6 py-12 transition-colors hover:border-[#00D9FF]/30 hover:bg-[#00D9FF]/[0.02] cursor-pointer group">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/[0.08] group-hover:border-[#00D9FF]/20 group-hover:bg-[#00D9FF]/10 transition-all">
          <ImagePlus size={28} className="text-white/30 group-hover:text-[#00D9FF] transition-colors" />
        </div>
        <div className="text-center">
          <p className="text-[14px] font-semibold text-white/70 group-hover:text-white/90 transition-colors">タップして写真・動画を選択</p>
          <p className="mt-1 text-[12px] text-white/30">またはここにドラッグ＆ドロップ</p>
          <p className="mt-2 text-[11px] text-white/20">写真: JPEG, PNG, HEIC（最大10MB）/ 動画: MP4等（最大50MB）</p>
        </div>
      </div>

      {data.photos.length > 0 && (
        <div>
          <p className="mb-3 text-[13px] font-medium text-white/45">
            選択済み: {photoCount > 0 && `写真 ${photoCount}枚`}{photoCount > 0 && videoCount > 0 && " / "}{videoCount > 0 && `動画 ${videoCount}本`}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {data.photos.map((item, index) => {
              const isVideo = item.file.type.startsWith("video/");
              const url = URL.createObjectURL(item.file);
              return (
                <div key={index} className={["relative rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.03] group", isVideo ? "col-span-2" : ""].join(" ")}>
                  {isVideo ? (
                    <div className="relative">
                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[11px] text-[#00D9FF] font-semibold"><Video size={12} />動画</div>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video src={url} controls className="w-full max-h-48 object-contain bg-black" preload="metadata" />
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={url} alt={`選択写真 ${index + 1}`} className="w-full aspect-square object-cover" />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2.5 py-2">
                    <select value={item.photoType} onChange={(e) => { e.stopPropagation(); onPhotoTypeChange(index, e.target.value); }}
                      className="w-full text-[11px] bg-white/[0.08] text-white/80 border border-white/[0.1] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#00D9FF]/50">
                      {PHOTO_TYPE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onPhotoRemove(index); }}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.photos.length === 0 && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-[13px] text-white/35 leading-relaxed">写真・動画は任意です。作業前・作業中・完了後の状況がわかるファイルを添付すると報告の精度が上がります。</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------
function CompletionScreen({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 border-2 border-emerald-500/30">
        <CheckCircle2 size={40} className="text-emerald-400" />
      </div>
      <div>
        <h2 className="text-[22px] font-bold text-white/90">報告完了</h2>
        <p className="mt-2 text-[14px] text-white/40">日次報告が正常に送信されました</p>
      </div>
      <div className="w-full rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 text-left">
        <p className="text-[13px] text-white/40 leading-relaxed">報告内容は担当者に通知されました。内容の確認・修正は報告一覧から行えます。</p>
      </div>
      <Button variant="outline" size="lg" onClick={onReset} className="w-full">新しい報告を作成</Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Form
// ---------------------------------------------------------------------------
const INITIAL_FORM_DATA: FormData = {
  siteName: "", siteId: "", processId: "",
  reportDate: new Date().toISOString().split("T")[0],
  workProcess: "", workDescription: "", workers: "", progressRate: "",
  weather: "", workHours: "", issues: "", materials: [], photos: [],
};

export function DailyReportForm({ initialSiteId }: { initialSiteId?: string }) {
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<FormData>({ ...INITIAL_FORM_DATA, siteId: initialSiteId ?? "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isPending, startTransition] = useTransition();
  const [isComplete, setIsComplete] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { if (prev[field as keyof FormErrors]) return { ...prev, [field]: undefined }; return prev; });
  }, []);

  const handlePhotoAdd = useCallback((files: FileList) => {
    const validItems: PhotoItem[] = []; const sizeErrors: string[] = [];
    Array.from(files).forEach((file) => {
      const isVideo = file.type.startsWith("video/"); const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_PHOTO_SIZE;
      if (file.size > maxSize) sizeErrors.push(`${file.name}: ${isVideo ? "動画" : "写真"}は${isVideo ? "50MB" : "10MB"}以下にしてください`);
      else validItems.push({ file, photoType: "after" });
    });
    if (sizeErrors.length > 0) { setSubmitError(sizeErrors.join("\n")); setTimeout(() => setSubmitError(null), 5000); }
    if (validItems.length > 0) setFormData((prev) => ({ ...prev, photos: [...prev.photos, ...validItems] }));
  }, []);

  const handlePhotoRemove = useCallback((index: number) => { setFormData((prev) => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) })); }, []);
  const handlePhotoTypeChange = useCallback((index: number, photoType: string) => { setFormData((prev) => ({ ...prev, photos: prev.photos.map((item, i) => i === index ? { ...item, photoType } : item) })); }, []);
  const handleMaterialAdd = useCallback(() => { setFormData((prev) => ({ ...prev, materials: [...prev.materials, { material_name: "", product_number: "", quantity: "", unit: "", supplier: "", note: "" }] })); }, []);
  const handleMaterialRemove = useCallback((index: number) => { setFormData((prev) => ({ ...prev, materials: prev.materials.filter((_, i) => i !== index) })); }, []);
  const handleMaterialChange = useCallback((index: number, field: keyof MaterialItem, value: string) => { setFormData((prev) => ({ ...prev, materials: prev.materials.map((item, i) => i === index ? { ...item, [field]: value } : item) })); }, []);

  const validateStep = (targetStep: number): boolean => {
    const newErrors: FormErrors = {};
    if (targetStep === 1) {
      if (!formData.siteId) newErrors.siteName = "現場を選択してください";
      if (!formData.reportDate) newErrors.reportDate = "報告日を選択してください";
      if (!formData.workProcess) newErrors.workProcess = "作業工程を選択してください";
    }
    if (targetStep === 2) {
      if (!formData.workDescription.trim()) newErrors.workDescription = "作業内容を入力してください";
      if (!formData.workers.trim()) newErrors.workers = "作業者名を入力してください";
      if (!formData.progressRate) newErrors.progressRate = "進捗率を選択してください";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [isNavigating, setIsNavigating] = useState(false);
  const handleNext = () => { if (isNavigating) return; if (!validateStep(step)) return; setIsNavigating(true); setStep((s) => Math.min(s + 1, TOTAL_STEPS)); setTimeout(() => setIsNavigating(false), 300); };
  const handleBack = () => { setErrors({}); setStep((s) => Math.max(s - 1, 1)); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== TOTAL_STEPS || isNavigating) return;
    if (!validateStep(step)) return;
    setSubmitError(null);
    startTransition(async () => {
      const result = await createDailyReport({
        siteName: formData.siteName, siteId: formData.siteId || undefined, processId: formData.processId,
        reportDate: formData.reportDate, workProcess: formData.workProcess, workDescription: formData.workDescription,
        workers: formData.workers, progressRate: formData.progressRate, weather: formData.weather,
        workHours: formData.workHours, issues: formData.issues,
      });
      if (!result.success) { setSubmitError(result.error || "報告の送信に失敗しました"); return; }
      if (formData.photos.length > 0 && result.reportId) {
        const photoFormData = new FormData();
        formData.photos.forEach((item) => { photoFormData.append("photos", item.file); photoFormData.append("photoTypes", item.photoType); });
        const uploadResult = await uploadReportPhotos({ reportId: result.reportId, photos: photoFormData });
        if (!uploadResult.success) console.warn("アップロードエラー:", uploadResult.error);
      }
      const validMaterials = formData.materials.filter((m) => m.material_name.trim());
      if (validMaterials.length > 0 && result.reportId) {
        const materialsResult = await saveReportMaterials(result.reportId, validMaterials);
        if (!materialsResult.success) console.warn("材料保存エラー:", materialsResult.error);
      }
      setIsComplete(true);
    });
  };

  const handleReset = () => { setFormData(INITIAL_FORM_DATA); setErrors({}); setStep(1); setIsComplete(false); };

  return (
    <div className="flex-1 flex items-start justify-center px-5 py-8 md:px-8 md:py-10 overflow-x-hidden">
      <div className="w-full max-w-lg min-w-0">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00D9FF]">
            <HardHat size={24} className="text-[#0e0e0e]" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-white/95 tracking-tight">日次報告</h1>
            <p className="text-[13px] text-white/40">現場作業報告システム</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 md:p-6 overflow-hidden">
          {isComplete ? (
            <CompletionScreen onReset={handleReset} />
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <StepIndicator currentStep={step} totalSteps={TOTAL_STEPS} labels={STEP_LABELS} />
              <div className="min-h-[360px]">
                {step === 1 && <Step1 data={formData} errors={errors} onChange={handleChange} />}
                {step === 2 && <Step2 data={formData} errors={errors} onChange={handleChange} onMaterialAdd={handleMaterialAdd} onMaterialRemove={handleMaterialRemove} onMaterialChange={handleMaterialChange} />}
                {step === 3 && <Step3 data={formData} onPhotoAdd={handlePhotoAdd} onPhotoRemove={handlePhotoRemove} onPhotoTypeChange={handlePhotoTypeChange} />}
              </div>
              {submitError && (
                <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                  <p className="text-[13px] text-red-400 whitespace-pre-line">{submitError}</p>
                </div>
              )}
              <div className="mt-8 flex gap-3">
                {step > 1 && <Button type="button" variant="outline" size="lg" onClick={handleBack} className="flex-1"><ChevronLeft size={20} />戻る</Button>}
                {step < TOTAL_STEPS ? (
                  <Button key="btn-next" type="button" variant="primary" size="lg" onClick={handleNext} disabled={isNavigating} className="flex-1">次へ<ChevronRight size={20} /></Button>
                ) : (
                  <Button key="btn-submit" type="submit" variant="primary" size="lg" loading={isPending} disabled={isNavigating} className="flex-1">
                    {isPending ? "送信中..." : "報告を送信"}{!isPending && <CheckCircle2 size={20} />}
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
