import Link from "next/link";
import type React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { X } from "lucide-react";
import { statusLabel } from "@/lib/election";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const variants = {
    primary: "bg-primary-700 text-white hover:bg-primary-800",
    secondary: "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50",
    danger: "bg-danger text-white hover:bg-red-700",
    success: "bg-success text-white hover:bg-green-700",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100"
  };
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    lg: "min-h-14 px-6 text-base"
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

type LinkButtonProps = React.ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function LinkButton({
  className,
  variant = "primary",
  size = "md",
  ...props
}: LinkButtonProps) {
  const variants = {
    primary: "bg-primary-700 text-white hover:bg-primary-800",
    secondary: "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50",
    danger: "bg-danger text-white hover:bg-red-700",
    success: "bg-success text-white hover:bg-green-700",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100"
  };
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    lg: "min-h-14 px-6 text-base"
  };

  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-5 shadow-soft",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  value,
  tone
}: {
  value: string;
  tone?: "blue" | "green" | "red" | "amber" | "gray";
}) {
  const inferredTone =
    tone ??
    (value.includes("berjalan") || value.includes("hadir")
      ? "green"
      : value.includes("tidak") || value.includes("ditutup")
        ? "red"
        : value.includes("belum")
          ? "amber"
          : "blue");
  const styles = {
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    green: "bg-green-50 text-green-700 ring-green-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    gray: "bg-slate-100 text-slate-700 ring-slate-200"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1",
        styles[inferredTone]
      )}
    >
      {statusLabel(value)}
    </span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const bounded = Math.max(0, Math.min(value, 100));
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-primary-700 transition-all"
        style={{ width: `${bounded}%` }}
      />
    </div>
  );
}

export function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: React.ReactNode;
  tone?: "blue" | "green" | "red" | "amber" | "gray";
}) {
  const tones = {
    blue: "text-primary-700",
    green: "text-success",
    red: "text-danger",
    amber: "text-warning",
    gray: "text-slate-700"
  };
  return (
    <div className="min-w-0">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className={cn("mt-1 text-3xl font-bold", tone && tones[tone])}>
        {value}
      </div>
    </div>
  );
}

export function PageShell({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("min-h-screen bg-slate-50 px-4 py-6 sm:px-6", className)}>
      <div className="mx-auto w-full max-w-7xl">{children}</div>
    </main>
  );
}

export function Modal({
  title,
  description,
  children,
  onClose
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">{title}</h2>
            {description ? (
              <p className="mt-2 text-sm text-slate-600">{description}</p>
            ) : null}
          </div>
          <Button
            aria-label="Tutup"
            title="Tutup"
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="text-lg font-bold text-slate-900">{title}</div>
      {body ? <p className="mt-2 text-sm text-slate-500">{body}</p> : null}
    </div>
  );
}
