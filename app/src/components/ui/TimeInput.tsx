"use client";

import React, { useId } from "react";

interface TimeInputProps {
  label?: string;
  value: string; // "HH:MM" format
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  className?: string;
}

/**
 * カスタム時間入力コンポーネント
 * Androidのネイティブ時間ピッカーがはみ出す問題を回避するため
 * 時と分のセレクトボックスで入力する
 */
export const TimeInput = React.memo(function TimeInput({
  label,
  value,
  onChange,
  required,
  error,
  className = "",
}: TimeInputProps) {
  const id = useId();
  const [hour, minute] = (value || "").split(":").map((v) => v || "");

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const h = e.target.value;
    if (!h) { onChange(""); return; }
    onChange(`${h}:${minute || "00"}`);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const m = e.target.value;
    if (!hour) { onChange(`00:${m}`); return; }
    onChange(`${hour}:${m}`);
  };

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

  const borderClass = error
    ? "border-red-500/50"
    : "border-gray-200 focus-within:border-[#0EA5E9]/50";

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label htmlFor={`${id}-h`} className="text-[13px] font-medium text-gray-500">
          {label}
          {required && <span className="ml-1 text-[#0EA5E9] text-xs">*</span>}
        </label>
      )}
      <div className={`flex items-center gap-1 rounded-xl border bg-white px-3 min-h-[44px] transition-all duration-150 ${borderClass}`}>
        <select
          id={`${id}-h`}
          value={hour}
          onChange={handleHourChange}
          className="bg-transparent text-[16px] text-gray-900 py-2 outline-none appearance-none text-center w-[3ch]"
        >
          <option value="">--</option>
          {hours.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <span className="text-gray-400 text-[16px] font-medium">:</span>
        <select
          id={`${id}-m`}
          value={minute}
          onChange={handleMinuteChange}
          className="bg-transparent text-[16px] text-gray-900 py-2 outline-none appearance-none text-center w-[3ch]"
        >
          <option value="">--</option>
          {minutes.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      {error && (
        <p className="text-[13px] text-red-400" role="alert">{error}</p>
      )}
    </div>
  );
});
