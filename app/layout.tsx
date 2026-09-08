import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Worship Team",
  description: "Song library, transposition, and setlists",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="flex items-center gap-6 border-b border-black/10 px-6 py-4 dark:border-white/15">
          <Link href="/" className="font-semibold">
            Worship Team
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/" className="hover:underline">
              Songs
            </Link>
            <Link href="/services" className="hover:underline">
              Services
            </Link>
          </nav>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
