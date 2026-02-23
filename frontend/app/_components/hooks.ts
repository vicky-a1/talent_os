import { useEffect, useMemo, useState } from "react";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(Boolean(mq.matches));
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

export function useAnimatedNumber(target: number, durationMs: number, enabled: boolean) {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const [value, setValue] = useState(0);

  const seed = useMemo(() => Math.random().toString(36).slice(2), []);

  useEffect(() => {
    if (!enabled) {
      setValue(safeTarget);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const from = 0;
    const to = safeTarget;

    const step = (t: number) => {
      const elapsed = Math.min(1, (t - start) / Math.max(1, durationMs));
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setValue(from + (to - from) * eased);
      if (elapsed < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, enabled, safeTarget, seed]);

  return value;
}

export function useFakeProgress(active: boolean) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }

    let raf = 0;
    const start = performance.now();

    const step = (t: number) => {
      const elapsed = t - start;
      const s = Math.min(1, elapsed / 18000);
      const eased = 1 - Math.pow(1 - s, 3);
      const value = Math.min(0.92, 0.08 + eased * 0.92);
      setProgress(value);
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return progress;
}

