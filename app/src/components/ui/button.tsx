import React from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#00D9FF] text-[#0e0e0e] font-semibold hover:bg-[#00c4e6] active:bg-[#00b0cc]",
  secondary:
    "bg-white/[0.08] text-white/90 font-medium hover:bg-white/[0.12] active:bg-white/[0.06] border border-white/[0.1]",
  outline:
    "bg-transparent text-white/70 font-medium hover:bg-white/[0.06] active:bg-white/[0.04] border border-white/[0.12] hover:border-white/[0.2]",
  ghost:
    "bg-transparent text-white/60 font-medium hover:bg-white/[0.06] hover:text-white/80",
  danger:
    "bg-red-600 text-white font-semibold hover:bg-red-500 active:bg-red-700",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-[44px] px-4 text-[13px] rounded-xl gap-2",
  md: "min-h-[44px] px-5 text-[14px] rounded-xl gap-2",
  lg: "min-h-[48px] px-6 text-[15px] rounded-xl gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={[
        "inline-flex items-center justify-center transition-all duration-150 cursor-pointer select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D9FF]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
