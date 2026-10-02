"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./auth";
import { Avatar, PageLoader, cx } from "./ui";
import { Wordmark } from "./logo";

const tabs = [
  { href: "/", label: "Pacts", icon: (a: boolean) => <IconHome active={a} /> },
  { href: "/pacts/new", label: "New", icon: (a: boolean) => <IconPlus active={a} /> },
  { href: "/friends", label: "Friends", icon: (a: boolean) => <IconFriends active={a} /> },
  { href: "/me", label: "Me", icon: (a: boolean) => <IconMe active={a} /> },
];

/** Wraps every signed-in page: guards auth, renders header and bottom tabs. */
export function Shell({ children, title, back }: { children: ReactNode; title?: string; back?: string }) {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!loading && !session) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, session, router, path]);

  if (loading || !session) return <PageLoader />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4">
          {back ? (
            <Link href={back} className="-ml-2 flex items-center gap-1 rounded-xl px-2 py-1 font-semibold text-muted hover:text-ink">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              {title ?? "Back"}
            </Link>
          ) : (
            <Link href="/" aria-label="Pinky home">
              <Wordmark />
            </Link>
          )}
          <Link href="/me" aria-label="Your profile">
            <Avatar profile={profile} size={32} />
          </Link>
        </div>
      </header>
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg justify-around px-2 pt-1.5">
          {tabs.map((t) => {
            const active = t.href === "/" ? path === "/" || (path.startsWith("/pacts/") && path !== "/pacts/new") : path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cx("flex w-16 flex-col items-center gap-0.5 rounded-xl py-1 text-[11px] font-semibold", active ? "text-pink" : "text-muted")}
              >
                {t.icon(active)}
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

const ic = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconHome({ active }: { active: boolean }) {
  return (
    <svg {...ic} strokeWidth={active ? 2.4 : 2}>
      <path d="M8 21V12a4 4 0 0 1 8 0v4" />
      <path d="M16 3v9a4 4 0 0 1-8 0V8" />
    </svg>
  );
}
function IconPlus({ active }: { active: boolean }) {
  return (
    <svg {...ic} strokeWidth={active ? 2.4 : 2}>
      <rect x="3" y="3" width="18" height="18" rx="6" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
function IconFriends({ active }: { active: boolean }) {
  return (
    <svg {...ic} strokeWidth={active ? 2.4 : 2}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </svg>
  );
}
function IconMe({ active }: { active: boolean }) {
  return (
    <svg {...ic} strokeWidth={active ? 2.4 : 2}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
