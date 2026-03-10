import React, { useId } from "react";

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

  const borderClass = error
    ? "border-red-500/50 focus:border-red-400"
    : success
      ? "border-emerald-500/50 focus:border-emerald-400"
      : "border-white/[0.1] focus:border-[#00D9FF]/50";

  return (
    <div className="flex flex-col gap-1.5 w-full overflow-hidden">
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-white/50">
          {label}
          {required && <span className="ml-1 text-[#00D9FF] text-xs">*</span>}
        </label>
      )}
      <input
        id={id}
        required={required}
        className={[
          "w-full min-h-[44px] px-4 py-2.5",
          "rounded-xl border bg-white/[0.05] transition-all duration-150",
          "text-[16px] text-white/90 placeholder-white/25",
          "focus:outline-none focus:ring-1 focus:ring-[#00D9FF]/20",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          borderClass,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
      {error && (
        <p className="text-[13px] text-red-400" role="alert">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-xs text-white/30">{helperText}</p>
      )}
    </div>
  );
}
