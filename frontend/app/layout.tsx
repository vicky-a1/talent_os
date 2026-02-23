import type { Metadata } from "next";
import "./globals.css";
import { Header } from "./_components/header";
import { PageTransition } from "./_components/page-transition";

export const metadata: Metadata = {
  title: "Nefera AI",
  description: "Agentic intelligence for modern talent acquisition.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-dvh overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-white text-slate-900 antialiased">
        <Header />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </body>
    </html>
  );
}
