"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { PageLoader, cx } from "./ui";
import { supabase } from "@/lib/supabase";

const tabs = [
  { href: "/", label: "Pacts", icon: (a: boolean) => <IconPacts active={a} /> },
  { href: "/friends", label: "Friends", icon: (a: boolean) => <IconFriends active={a} /> },
  { href: "/me", label: "Me", icon: (a: boolean) => <IconMe active={a} /> },
];

/**
 * Wraps every signed-in page: guards auth, renders the nav bar (on pushed pages)
 * and the tab bar. Top-level tabs draw their own large title instead of a nav bar.
 */
export function Shell({
  children,
  title,
  back,
  navTitle,
  action,
}: {
  children: ReactNode;
  /** Label next to the back chevron */
  title?: string;
  back?: string;
  /** Small centered title in the nav bar */
  navTitle?: ReactNode;
  /** Right side of the nav bar */
  action?: ReactNode;
}) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [requests, setRequests] = useState(0);

  useEffect(() => {
    if (!loading && !session) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, session, router, path]);

  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    supabase
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("addressee", uid)
      .eq("status", "pending")
      .then(({ count }) => setRequests(count ?? 0));
  }, [uid, path]);

  if (loading || !session) return <PageLoader />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      {back ? (
        <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="relative flex h-12 items-center justify-between px-2">
            <Link href={back} className="flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-[17px] text-pink active:opacity-60">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              {title ?? "Back"}
            </Link>
            {navTitle ? (
              <span className="pointer-events-none absolute inset-x-24 truncate text-center text-[17px] font-semibold">{navTitle}</span>
            ) : null}
            <div className="flex items-center gap-1 pr-1">{action}</div>
          </div>
        </header>
      ) : (
        <div className="pt-[max(12px,env(safe-area-inset-top))]" />
      )}
      <main className="flex-1 px-4 pb-32 pt-3">{children}</main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/60 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg justify-around px-6 pt-1.5">
          {tabs.map((t) => {
            const active = t.href === "/" ? path === "/" || path.startsWith("/pacts") : path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cx("relative flex w-20 flex-col items-center gap-0.5 py-1 text-[11px] font-medium", active ? "text-pink" : "text-faint")}
              >
                {t.icon(active)}
                {t.label}
                {t.href === "/friends" && requests > 0 ? (
                  <span className="absolute right-4 top-0 min-w-[18px] rounded-full bg-broke px-1 text-center text-[11px] font-semibold leading-[18px] text-white">
                    {requests}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

const ic = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconPacts({ active }: { active: boolean }) {
  return (
    <svg {...ic} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true">
      <path d="M8 21V12a4 4 0 0 1 8 0v4" />
      <path d="M16 3v9a4 4 0 0 1-8 0V8" />
    </svg>
  );
}
function IconFriends({ active }: { active: boolean }) {
  return (
    <svg {...ic} aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" fill={active ? "currentColor" : "none"} />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0Z" fill={active ? "currentColor" : "none"} />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </svg>
  );
}
function IconMe({ active }: { active: boolean }) {
  return (
    <svg {...ic} aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill={active ? "currentColor" : "none"} />
      <path d="M4 21a8 8 0 0 1 16 0Z" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}
