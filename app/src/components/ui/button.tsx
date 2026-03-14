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
    "bg-[#0EA5E9] text-white font-semibold hover:bg-[#0284C7] active:bg-[#0369A1] shadow-sm",
  secondary:
    "bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 active:bg-gray-100 border border-gray-200",
  outline:
    "bg-transparent text-gray-600 font-medium hover:bg-gray-50 active:bg-gray-100 border border-gray-300 hover:border-gray-400",
  ghost:
    "bg-transparent text-gray-500 font-medium hover:bg-gray-100 hover:text-gray-700",
  danger:
    "bg-red-600 text-white font-semibold hover:bg-red-500 active:bg-red-700",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-[44px] px-4 text-[13px] rounded-xl gap-2",
  md: "min-h-[44px] px-5 text-[14px] rounded-xl gap-2",
  lg: "min-h-[48px] px-6 text-[15px] rounded-xl gap-2.5",
};

export const Button = React.memo(function Button({
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
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
});
