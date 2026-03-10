import React, { useId } from "react";

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

  const borderClass = error
    ? "border-red-500/50 focus:border-red-400"
    : "border-white/[0.1] focus:border-[#00D9FF]/50";

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-white/50">
          {label}
          {required && <span className="ml-1 text-[#00D9FF] text-xs">*</span>}
        </label>
      )}
      <textarea
        id={id}
        required={required}
        value={value}
        maxLength={maxLength}
        className={[
          "w-full px-4 py-3 min-h-[100px]",
          "rounded-xl border bg-white/[0.05] transition-all duration-150",
          "text-[16px] text-white/90 placeholder-white/25 leading-relaxed resize-y",
          "focus:outline-none focus:ring-1 focus:ring-[#00D9FF]/20",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          borderClass,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {error && <p className="text-[13px] text-red-400" role="alert">{error}</p>}
          {helperText && !error && <p className="text-xs text-white/30">{helperText}</p>}
        </div>
        {showCharCount && maxLength && (
          <p className={`text-xs shrink-0 ${charCount >= maxLength ? "text-red-400" : "text-white/30"}`}>
            {charCount}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
}
