"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import { cx } from "./ui";

export function NavLink({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cx(
        "rounded-lg px-3 py-2 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 motion-reduce:transition-none",
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        className,
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
