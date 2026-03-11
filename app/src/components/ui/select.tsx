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
    : "border-gray-200 focus:border-[#0EA5E9]/50";

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-gray-500">
          {label}
          {required && <span className="ml-1 text-[#0EA5E9] text-xs">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          required={required}
          className={[
            "w-full min-h-[44px] px-4 pr-10",
            "rounded-xl border bg-white transition-all duration-150",
            "text-[16px] text-gray-900 appearance-none cursor-pointer",
            "focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]/20",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            borderClass,
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        >
          <option value="" className="bg-white text-gray-400">
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-white text-gray-900">
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          <ChevronDown size={16} aria-hidden="true" />
        </span>
      </div>
      {error && (
        <p className="text-[13px] text-red-400" role="alert">{error}</p>
      )}
    </div>
  );
}
