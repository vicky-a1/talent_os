import React from "react";

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "min-w-0 rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur",
        "transition-shadow duration-200 hover:shadow-md active:shadow-lg motion-reduce:transition-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">{children}</div>;
}

export function Badge({
  tone = "slate",
  children,
  className,
}: {
  tone?: "slate" | "emerald" | "amber" | "rose" | "violet" | "sky";
  children: React.ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        tones[tone] ?? tones.slate,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  className,
  variant = "primary",
  disabled,
  type,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 active:scale-[0.98] active:shadow-lg motion-reduce:transition-none motion-reduce:active:scale-100";
  const styles =
    variant === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : variant === "secondary"
        ? "bg-white text-slate-900 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
        : "bg-transparent text-slate-700 hover:bg-slate-100";

  return (
    <button
      type={type ?? "button"}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        base,
        styles,
        disabled ? "cursor-not-allowed opacity-60 active:scale-100" : "",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx("h-px bg-slate-200/80", className)} />;
}
