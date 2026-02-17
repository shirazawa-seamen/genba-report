import React, { useId } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

export function Select({
  label,
  options,
  error,
  placeholder = "選択してください",
  id: externalId,
  className = "",
  required,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  const selectStateClasses = error
    ? "border-red-500/70 text-gray-100 focus:border-red-400 focus:ring-red-500/30"
    : "border-gray-600/70 text-gray-100 focus:border-amber-400/80 focus:ring-amber-500/20";

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-semibold text-gray-300 tracking-wide"
        >
          {label}
          {required && (
            <span className="ml-1 text-amber-400 text-xs font-bold">必須</span>
          )}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          required={required}
          className={[
            // タッチターゲット 48px 以上
            "w-full min-h-[48px] px-4 py-3 pr-10",
            "rounded-xl border bg-gray-800/80 transition-all duration-200",
            "text-base leading-relaxed appearance-none cursor-pointer",
            "focus:outline-none focus:ring-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            selectStateClasses,
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        >
          <option value="" className="bg-gray-800 text-gray-400">
            {placeholder}
          </option>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-gray-800 text-gray-100"
            >
              {option.label}
            </option>
          ))}
        </select>
        {/* カスタム矢印アイコン */}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          {error ? (
            <AlertCircle size={20} className="text-red-400" aria-hidden="true" />
          ) : (
            <ChevronDown size={20} aria-hidden="true" />
          )}
        </span>
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
