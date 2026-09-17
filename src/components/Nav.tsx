"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "觀測看板" },
  { href: "/portfolio", label: "虛擬倉" },
  { href: "/daily", label: "今日觀察" },
] as const;

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/$/, "") || "/";
}

export function Nav() {
  const pathname = normalizePath(usePathname());

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-amber-300">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/15 text-sm">幣</span>
          <span className="hidden sm:inline">幣市觀測＋虛擬倉</span>
          <span className="sm:hidden">幣市觀測</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 transition ${
                  active
                    ? "bg-zinc-800 text-amber-200"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
