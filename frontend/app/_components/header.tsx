"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

import { NavLink } from "./nav-link";
import { cx } from "./ui";

export function Header() {
  const [open, setOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    const el = document.documentElement;
    if (open) el.style.overflow = "hidden";
    return () => {
      el.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/65 backdrop-blur supports-[backdrop-filter]:bg-white/55">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-sm">
            N
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">Nefera AI</div>
            <div className="text-xs text-slate-500">Talent OS</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 text-sm font-medium md:flex" aria-label="Primary">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/evaluate">Evaluate</NavLink>
          <NavLink href="/analytics">Analytics</NavLink>
          <NavLink href="/settings">Settings</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/evaluate"
            className="hidden items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 active:shadow-lg motion-reduce:transition-none md:inline-flex"
          >
            New Evaluation
          </Link>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm transition duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 active:shadow-lg motion-reduce:transition-none md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" strokeLinecap="round" />
                <path d="M6 6l12 12" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16" strokeLinecap="round" />
                <path d="M4 12h16" strokeLinecap="round" />
                <path d="M4 18h16" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div
        className={cx(
          "fixed inset-0 z-50 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          className={cx(
            "absolute inset-0 bg-slate-900/20 transition-opacity duration-200 motion-reduce:transition-none",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />

        <div
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          className={cx(
            "absolute right-0 top-0 h-full w-[min(22rem,100%)] border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 motion-reduce:transition-none",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">Menu</div>
            <button
              ref={closeBtnRef}
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm transition duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 active:shadow-lg motion-reduce:transition-none"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" strokeLinecap="round" />
                <path d="M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <nav className="grid gap-2 px-4 py-4 text-sm font-medium" aria-label="Mobile primary">
            <NavLink href="/dashboard" className="py-3" onClick={() => setOpen(false)}>
              Dashboard
            </NavLink>
            <NavLink href="/evaluate" className="py-3" onClick={() => setOpen(false)}>
              Evaluate
            </NavLink>
            <NavLink href="/analytics" className="py-3" onClick={() => setOpen(false)}>
              Analytics
            </NavLink>
            <NavLink href="/settings" className="py-3" onClick={() => setOpen(false)}>
              Settings
            </NavLink>
          </nav>

          <div className="px-4 pb-6">
            <Link
              href="/evaluate"
              onClick={() => setOpen(false)}
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 active:shadow-lg motion-reduce:transition-none"
            >
              New Evaluation
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
