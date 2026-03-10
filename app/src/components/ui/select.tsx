import React, { useId } from "react";
import { ChevronDown } from "lucide-react";

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
      <div className="relative">
        <select
          id={id}
          required={required}
          className={[
            "w-full min-h-[44px] px-4 pr-10",
            "rounded-xl border bg-white/[0.05] transition-all duration-150",
            "text-[16px] text-white/90 appearance-none cursor-pointer",
            "focus:outline-none focus:ring-1 focus:ring-[#00D9FF]/20",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            borderClass,
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        >
          <option value="" className="bg-[#222222] text-white/40">
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-[#222222] text-white/90">
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
          <ChevronDown size={16} aria-hidden="true" />
        </span>
      </div>
      {error && (
        <p className="text-[13px] text-red-400" role="alert">{error}</p>
      )}
    </div>
  );
}
