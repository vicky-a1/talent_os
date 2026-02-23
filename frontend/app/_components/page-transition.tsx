"use client";

import React from "react";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="nefera-page-fade motion-reduce:animate-none">
      {children}
    </div>
  );
}

