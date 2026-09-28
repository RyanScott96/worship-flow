import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cookies } from "next/headers";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { MODE_COOKIE, SKIN_COOKIE, parseMode, parseSkin } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Worship Team",
  description: "Song library, transposition, and setlists",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Theme is rendered server-side from cookies so the first paint is right (D-24).
  const jar = await cookies();
  const mode = parseMode(jar.get(MODE_COOKIE)?.value);
  const skin = parseSkin(jar.get(SKIN_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-skin={skin}
      data-mode={mode === "system" ? undefined : mode}
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="surface-inverse flex flex-wrap items-center gap-x-6 gap-y-3 bg-background px-6 py-4 text-foreground">
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
          <ThemeSwitcher mode={mode} skin={skin} />
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
