import React, { useMemo } from "react";

import { cx } from "./ui";

export function ScoreRing({
  value0to100,
  size = 140,
  stroke = 12,
  label,
  tone,
  animatedValue0to100,
}: {
  value0to100: number;
  animatedValue0to100: number;
  size?: number;
  stroke?: number;
  label?: string;
  tone: "emerald" | "amber" | "rose" | "slate";
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, Number.isFinite(animatedValue0to100) ? animatedValue0to100 : 0)) / 100;
  const dashOffset = circumference * (1 - pct);

  const colors = useMemo(() => {
    if (tone === "emerald") return { track: "stroke-emerald-100", ring: "stroke-emerald-500" };
    if (tone === "amber") return { track: "stroke-amber-100", ring: "stroke-amber-500" };
    if (tone === "rose") return { track: "stroke-rose-100", ring: "stroke-rose-500" };
    return { track: "stroke-slate-200", ring: "stroke-slate-600" };
  }, [tone]);

  const safeValue = Math.min(100, Math.max(0, Number.isFinite(value0to100) ? value0to100 : 0));
  const displayValue = Math.min(100, Math.max(0, Number.isFinite(animatedValue0to100) ? animatedValue0to100 : safeValue));

  return (
    <div className="relative grid place-items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={cx("opacity-70", colors.track)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          className={cx("transition-[stroke-dashoffset] duration-200 ease-out motion-reduce:transition-none", colors.ring)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div className="grid gap-1">
          {label ? <div className="text-xs font-semibold text-slate-500">{label}</div> : null}
          <div className="text-4xl font-semibold tracking-tight text-slate-900">{Math.round(displayValue)}</div>
          <div className="text-xs font-medium text-slate-500">/ 100</div>
        </div>
      </div>
    </div>
  );
}
