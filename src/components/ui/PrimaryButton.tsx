import type { ButtonHTMLAttributes, ReactNode } from "react";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export const primaryButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-pill bg-ink px-5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-black focus:outline-none focus:ring-2 focus:ring-orange focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function PrimaryButton({ children, className = "", ...props }: PrimaryButtonProps) {
  return (
    <button
      className={[
        primaryButtonClassName,
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
