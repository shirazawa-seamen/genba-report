import React, { useId } from "react";
import { AlertCircle } from "lucide-react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  maxLength?: number;
  showCharCount?: boolean;
}

export function Textarea({
  label,
  error,
  helperText,
  maxLength,
  showCharCount = false,
  id: externalId,
  className = "",
  required,
  value,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  const charCount = typeof value === "string" ? value.length : 0;

  const textareaStateClasses = error
    ? "border-red-500/70 bg-gray-800/80 text-gray-100 placeholder-gray-500 focus:border-red-400 focus:ring-red-500/30"
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
      <textarea
        id={id}
        required={required}
        value={value}
        maxLength={maxLength}
        className={[
          "w-full px-4 py-3",
          "rounded-xl border transition-all duration-200",
          "text-base leading-relaxed resize-y",
          // 最低タッチターゲット高さ
          "min-h-[120px]",
          "focus:outline-none focus:ring-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          textareaStateClasses,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
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
        {showCharCount && maxLength && (
          <p
            className={[
              "text-xs shrink-0",
              charCount >= maxLength
                ? "text-red-400 font-semibold"
                : charCount >= maxLength * 0.9
                  ? "text-amber-400"
                  : "text-gray-500",
            ].join(" ")}
          >
            {charCount} / {maxLength}
          </p>
        )}
      </div>
    </div>
  );
}
