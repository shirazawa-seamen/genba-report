import React, { useId } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  success?: boolean;
}

export function Input({
  label,
  error,
  helperText,
  success,
  id: externalId,
  className = "",
  required,
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  const inputStateClasses = error
    ? "border-red-500/70 bg-gray-800/80 text-gray-100 placeholder-gray-500 focus:border-red-400 focus:ring-red-500/30"
    : success
      ? "border-emerald-500/70 bg-gray-800/80 text-gray-100 placeholder-gray-500 focus:border-emerald-400 focus:ring-emerald-500/30"
      : "border-gray-600/70 bg-gray-800/80 text-gray-100 placeholder-gray-500 focus:border-amber-400/80 focus:ring-amber-500/20";

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
        <input
          id={id}
          required={required}
          className={[
            // タッチターゲット 48px 以上を確保
            "w-full min-h-[48px] px-4 py-3",
            "rounded-xl border transition-all duration-200",
            "text-base leading-relaxed",
            "focus:outline-none focus:ring-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            inputStateClasses,
            // アイコン用パディング
            (error || success) ? "pr-11" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {error && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
            <AlertCircle size={20} aria-hidden="true" />
          </span>
        )}
        {success && !error && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400">
            <CheckCircle2 size={20} aria-hidden="true" />
          </span>
        )}
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  );
}
