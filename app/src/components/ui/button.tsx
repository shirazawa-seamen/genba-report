import React from "react";

type ButtonVariant = "primary" | "secondary" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-gray-900 font-bold shadow-lg shadow-amber-500/30 hover:shadow-amber-400/40 border border-amber-400/50",
  secondary:
    "bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-gray-100 font-semibold border border-gray-600/50",
  outline:
    "bg-transparent hover:bg-gray-800 active:bg-gray-900 text-gray-300 hover:text-gray-100 font-semibold border border-gray-600 hover:border-gray-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm rounded-lg",
  md: "h-12 px-6 text-base rounded-xl",
  lg: "h-14 px-8 text-lg rounded-xl",
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
        "inline-flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer select-none",
        "focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:ring-offset-2 focus:ring-offset-gray-900",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
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
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
