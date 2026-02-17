"use client";

import React, { useState, useRef, useTransition } from "react";
import { createDailyReport, uploadReportPhotos } from "@/app/(dashboard)/reports/new/actions";
import {
  Building2,
  CalendarDays,
  HardHat,
  Users,
  TrendingUp,
  Camera,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  ImagePlus,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface FormData {
  // Step 1: 基本情報
  siteName: string;
  reportDate: string;
  workProcess: string;

  // Step 2: 作業内容
  workDescription: string;
  workers: string;
  progressRate: string;

  // Step 3: 写真（プレースホルダー）
  photos: File[];
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
// 定数
// ---------------------------------------------------------------------------
const WORK_PROCESS_OPTIONS: SelectOption[] = [
  { value: "foundation", label: "基礎工事" },
  { value: "framing", label: "躯体工事" },
  { value: "exterior", label: "外装工事" },
  { value: "interior", label: "内装工事" },
  { value: "electrical", label: "電気工事" },
  { value: "plumbing", label: "配管工事" },
  { value: "finishing", label: "仕上げ工事" },
  { value: "cleanup", label: "清掃・片付け" },
];

const PROGRESS_RATE_OPTIONS: SelectOption[] = Array.from(
  { length: 11 },
  (_, i) => {
    const val = i * 10;
    return { value: String(val), label: `${val}%` };
  }
);

const STEP_LABELS = ["基本情報", "作業内容", "写真"];
const TOTAL_STEPS = 3;

// ---------------------------------------------------------------------------
// ステップインジケーター
// ---------------------------------------------------------------------------
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
    <div className="w-full mb-8">
      {/* ステップ番号とラベル */}
      <div className="flex items-center justify-between relative">
        {/* 接続ライン（背景） */}
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-700 z-0" />
        {/* 接続ライン（進捗） */}
        <div
          className="absolute left-0 top-5 h-0.5 bg-amber-500 z-0 transition-all duration-500 ease-out"
          style={{
            width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
          }}
        />
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isDone = step < currentStep;
          const isActive = step === currentStep;
          return (
            <div key={step} className="flex flex-col items-center gap-2 z-10">
              <div
                className={[
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                  isDone
                    ? "bg-amber-500 text-gray-900 shadow-lg shadow-amber-500/40"
                    : isActive
                      ? "bg-amber-500 text-gray-900 ring-4 ring-amber-500/30 shadow-lg shadow-amber-500/40 scale-110"
                      : "bg-gray-700 text-gray-500 border border-gray-600",
                ].join(" ")}
              >
                {isDone ? (
                  <CheckCircle2 size={20} aria-hidden="true" />
                ) : (
                  step
                )}
              </div>
              <span
                className={[
                  "text-xs font-semibold tracking-wide",
                  isActive ? "text-amber-400" : isDone ? "text-gray-400" : "text-gray-600",
                ].join(" ")}
              >
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>
      {/* 現在ステップ表示 */}
      <p className="text-center mt-4 text-xs text-gray-500">
        ステップ {currentStep} / {totalSteps}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: 基本情報
// ---------------------------------------------------------------------------
function Step1({
  data,
  errors,
  onChange,
}: {
  data: FormData;
  errors: FormErrors;
  onChange: (field: keyof FormData, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30">
          <Building2 size={20} className="text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-100">基本情報</h2>
          <p className="text-sm text-gray-500">現場と日付を入力してください</p>
        </div>
      </div>

      <Input
        label="現場名"
        placeholder="例：〇〇マンション新築工事"
        value={data.siteName}
        onChange={(e) => onChange("siteName", e.target.value)}
        error={errors.siteName}
        required
        autoComplete="off"
      />

      <Input
        label="報告日"
        type="date"
        value={data.reportDate}
        onChange={(e) => onChange("reportDate", e.target.value)}
        error={errors.reportDate}
        required
      />

      <Select
        label="作業工程"
        options={WORK_PROCESS_OPTIONS}
        value={data.workProcess}
        onChange={(e) => onChange("workProcess", e.target.value)}
        error={errors.workProcess}
        required
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: 作業内容
// ---------------------------------------------------------------------------
function Step2({
  data,
  errors,
  onChange,
}: {
  data: FormData;
  errors: FormErrors;
  onChange: (field: keyof FormData, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30">
          <ClipboardList size={20} className="text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-100">作業内容</h2>
          <p className="text-sm text-gray-500">今日の作業を入力してください</p>
        </div>
      </div>

      <Textarea
        label="作業内容"
        placeholder="本日実施した作業内容を具体的に記入してください&#10;例：1階部分の型枠組み立て作業を実施。柱・梁の配筋検査も行った。"
        value={data.workDescription}
        onChange={(e) => onChange("workDescription", e.target.value)}
        error={errors.workDescription}
        maxLength={500}
        showCharCount
        rows={5}
        required
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-gray-300 tracking-wide flex items-center gap-2">
          <Users size={16} className="text-gray-400" aria-hidden="true" />
          作業者名
          <span className="ml-1 text-amber-400 text-xs font-bold">必須</span>
        </label>
        <Input
          placeholder="例：田中 太郎、鈴木 次郎"
          value={data.workers}
          onChange={(e) => onChange("workers", e.target.value)}
          error={errors.workers}
          helperText="複数名の場合は読点（、）で区切ってください"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-gray-300 tracking-wide flex items-center gap-2">
          <TrendingUp size={16} className="text-gray-400" aria-hidden="true" />
          進捗率
          <span className="ml-1 text-amber-400 text-xs font-bold">必須</span>
        </label>
        <Select
          options={PROGRESS_RATE_OPTIONS}
          placeholder="進捗率を選択"
          value={data.progressRate}
          onChange={(e) => onChange("progressRate", e.target.value)}
          error={errors.progressRate}
        />
        {/* 進捗バービジュアル */}
        {data.progressRate && (
          <div className="mt-1 flex items-center gap-3">
            <div className="flex-1 h-3 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500 ease-out"
                style={{ width: `${data.progressRate}%` }}
              />
            </div>
            <span className="text-sm font-bold text-amber-400 w-10 text-right">
              {data.progressRate}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: 写真アップロード（プレースホルダー）
// ---------------------------------------------------------------------------
function Step3({
  data,
  onPhotoAdd,
  onPhotoRemove,
}: {
  data: FormData;
  onPhotoAdd: (files: FileList) => void;
  onPhotoRemove: (index: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) {
      onPhotoAdd(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onPhotoAdd(e.target.files);
      // 入力をリセットして同じファイルを再選択可能に
      e.target.value = "";
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30">
          <Camera size={20} className="text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-100">写真アップロード</h2>
          <p className="text-sm text-gray-500">現場の写真を添付してください（任意）</p>
        </div>
      </div>

      {/* 隠れたファイル入力 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
        aria-label="写真を選択"
      />

      {/* ドロップゾーン */}
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-gray-600 bg-gray-800/40 px-6 py-12 transition-colors hover:border-amber-500/60 hover:bg-gray-800/60 cursor-pointer group"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-700/80 border border-gray-600 group-hover:border-amber-500/40 group-hover:bg-amber-500/10 transition-all duration-200">
          <ImagePlus size={32} className="text-gray-500 group-hover:text-amber-400 transition-colors" aria-hidden="true" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-gray-300 group-hover:text-gray-100 transition-colors">
            タップして写真を選択
          </p>
          <p className="mt-1 text-sm text-gray-500">
            またはここにドラッグ＆ドロップ
          </p>
          <p className="mt-2 text-xs text-gray-600">
            JPEG, PNG, HEIC 対応 / 最大 10MB
          </p>
        </div>
      </div>

      {/* 選択済み写真プレビュー */}
      {data.photos.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold text-gray-400">
            選択済み: {data.photos.length} 枚
          </p>
          <div className="grid grid-cols-3 gap-3">
            {data.photos.map((file, index) => {
              const url = URL.createObjectURL(file);
              return (
                <div
                  key={index}
                  className="relative aspect-square rounded-xl overflow-hidden border border-gray-700 bg-gray-800 group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`選択写真 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {/* 削除ボタン */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPhotoRemove(index);
                    }}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`写真${index + 1}を削除`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 写真がない場合のヒント */}
      {data.photos.length === 0 && (
        <div className="rounded-xl bg-gray-800/60 border border-gray-700/50 p-4">
          <p className="text-sm text-gray-500 leading-relaxed">
            写真は任意です。作業前・作業中・完了後の状況がわかる写真を添付すると報告の精度が上がります。
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 完了画面
// ---------------------------------------------------------------------------
function CompletionScreen({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 border-2 border-emerald-500/40">
        <CheckCircle2 size={48} className="text-emerald-400" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-100">報告完了</h2>
        <p className="mt-2 text-base text-gray-400">
          日次報告が正常に送信されました
        </p>
      </div>
      <div className="w-full rounded-2xl bg-gray-800/60 border border-gray-700/50 p-6 text-left">
        <p className="text-sm text-gray-400 leading-relaxed">
          報告内容は担当者に通知されました。内容の確認・修正は報告一覧から行えます。
        </p>
      </div>
      <Button variant="outline" size="lg" onClick={onReset} className="w-full">
        新しい報告を作成
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// メインフォームコンポーネント
// ---------------------------------------------------------------------------
const INITIAL_FORM_DATA: FormData = {
  siteName: "",
  reportDate: new Date().toISOString().split("T")[0],
  workProcess: "",
  workDescription: "",
  workers: "",
  progressRate: "",
  photos: [],
};

export function DailyReportForm() {
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isPending, startTransition] = useTransition();
  const [isComplete, setIsComplete] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // フィールド更新
  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // エラーをクリア
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // 写真追加
  const handlePhotoAdd = (files: FileList) => {
    const newFiles = Array.from(files);
    setFormData((prev) => ({ ...prev, photos: [...prev.photos, ...newFiles] }));
  };

  // 写真削除
  const handlePhotoRemove = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  // バリデーション
  const validateStep = (targetStep: number): boolean => {
    const newErrors: FormErrors = {};
    if (targetStep === 1) {
      if (!formData.siteName.trim()) newErrors.siteName = "現場名を入力してください";
      if (!formData.reportDate) newErrors.reportDate = "報告日を選択してください";
      if (!formData.workProcess) newErrors.workProcess = "作業工程を選択してください";
    }
    if (targetStep === 2) {
      if (!formData.workDescription.trim())
        newErrors.workDescription = "作業内容を入力してください";
      if (!formData.workers.trim())
        newErrors.workers = "作業者名を入力してください";
      if (!formData.progressRate)
        newErrors.progressRate = "進捗率を選択してください";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 次へ（連打防止付き）
  const [isNavigating, setIsNavigating] = useState(false);
  const handleNext = () => {
    if (isNavigating) return;
    if (!validateStep(step)) return;
    setIsNavigating(true);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    // 短いディレイ後にナビゲーション可能に
    setTimeout(() => setIsNavigating(false), 300);
  };

  // 戻る
  const handleBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 1));
  };

  // 送信（Step 3でのみ実行）
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Step 3以外では送信しない（Enterキー対策）
    if (step !== TOTAL_STEPS) {
      handleNext();
      return;
    }
    if (!validateStep(step)) return;
    setSubmitError(null);

    startTransition(async () => {
      // 1. 日次報告を作成
      const result = await createDailyReport({
        siteName: formData.siteName,
        reportDate: formData.reportDate,
        workProcess: formData.workProcess,
        workDescription: formData.workDescription,
        workers: formData.workers,
        progressRate: formData.progressRate,
      });

      if (!result.success) {
        setSubmitError(result.error || "報告の送信に失敗しました");
        return;
      }

      // 2. 写真があればアップロード
      if (formData.photos.length > 0 && result.reportId) {
        const photoFormData = new FormData();
        formData.photos.forEach((file) => {
          photoFormData.append("photos", file);
        });

        const uploadResult = await uploadReportPhotos({
          reportId: result.reportId,
          photos: photoFormData,
        });

        if (!uploadResult.success) {
          // 写真アップロード失敗は警告として扱う（報告自体は成功）
          console.warn("写真アップロードエラー:", uploadResult.error);
        }
      }

      setIsComplete(true);
    });
  };

  // リセット
  const handleReset = () => {
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
    setStep(1);
    setIsComplete(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-start justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* ヘッダー */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 shadow-lg shadow-amber-500/30">
            <HardHat size={24} className="text-gray-900" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-100 tracking-tight">
              日次報告
            </h1>
            <p className="text-sm text-gray-500">現場作業報告システム</p>
          </div>
        </div>

        {/* カード */}
        <div className="rounded-3xl border border-gray-800/80 bg-gray-900/90 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm">
          {isComplete ? (
            <CompletionScreen onReset={handleReset} />
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {/* ステップインジケーター */}
              <StepIndicator
                currentStep={step}
                totalSteps={TOTAL_STEPS}
                labels={STEP_LABELS}
              />

              {/* ステップコンテンツ */}
              <div className="min-h-[360px]">
                {step === 1 && (
                  <Step1
                    data={formData}
                    errors={errors}
                    onChange={handleChange}
                  />
                )}
                {step === 2 && (
                  <Step2
                    data={formData}
                    errors={errors}
                    onChange={handleChange}
                  />
                )}
                {step === 3 && (
                  <Step3
                    data={formData}
                    onPhotoAdd={handlePhotoAdd}
                    onPhotoRemove={handlePhotoRemove}
                  />
                )}
              </div>

              {/* エラー表示 */}
              {submitError && (
                <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/30 p-4">
                  <p className="text-sm text-red-400">{submitError}</p>
                </div>
              )}

              {/* ナビゲーションボタン */}
              <div className="mt-8 flex gap-3">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={handleBack}
                    className="flex-1"
                  >
                    <ChevronLeft size={20} aria-hidden="true" />
                    戻る
                  </Button>
                )}
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
                    <ChevronRight size={20} aria-hidden="true" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={isPending}
                    className="flex-1"
                  >
                    {isPending ? "送信中..." : "報告を送信"}
                    {!isPending && <CheckCircle2 size={20} aria-hidden="true" />}
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>

        {/* フッター */}
        <p className="mt-6 text-center text-xs text-gray-700">
          現場報告システム v1.0
        </p>
      </div>
    </div>
  );
}
