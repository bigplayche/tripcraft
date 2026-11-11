"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, Compass, Home, Luggage, MessageCircle, User, Users } from "lucide-react";
import { Logo } from "./ui";
import { ThemeToggle } from "./client-ui";
import { markNotificationsRead } from "@/app/actions/trips";
import { cn, timeAgo } from "@/lib/utils";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/trips", label: "My Trips", icon: Luggage },
  { href: "/group", label: "Group", long: "Group Trips", icon: Users },
  { href: "/concierge", label: "Concierge", long: "AI Concierge", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: User },
];

export type Notif = { id: string; title: string; link: string | null; read_at: string | null; created_at: string };

export function AppShell({ children, user, plan, demo, notifications }: { children: React.ReactNode; user: { name: string; email: string }; plan: string; demo: boolean; notifications: Notif[] }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(notifications.filter((n) => !n.read_at).length);
  const toggleBell = () => {
    setOpen((o) => !o);
    if (unread) {
      setUnread(0);
      void markNotificationsRead();
    }
  };

  const bell = (
    <div className="relative">
      <button onClick={toggleBell} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-muted hover:text-ink">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-bg" />}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden tabIndex={-1} onClick={() => setOpen(false)} />
          <div className="card absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-2rem)] animate-fade p-2 shadow-pop lg:left-0 lg:right-auto">
            <p className="eyebrow px-3 py-2">Notifications</p>
            {notifications.length === 0 && <p className="px-3 pb-3 text-sm text-ink-soft">Nothing yet. Activity from your group trips shows up here.</p>}
            {notifications.map((n) => (
              <Link key={n.id} href={n.link ?? "/trips"} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-muted">
                <span className="block">{n.title}</span>
                <span className="text-xs text-ink-faint">{timeAgo(n.created_at)}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <div className="flex items-center justify-between px-2">
          <Link href="/home"><Logo /></Link>
          {bell}
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, long, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-medium transition-colors", active(href) ? "bg-accent-soft text-accent-strong" : "text-ink-soft hover:bg-muted hover:text-ink")}>
              <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={active(href) ? 2.2 : 1.8} />
              {long ?? label}
            </Link>
          ))}
        </nav>
        {plan === "free" && (
          <Link href="/profile/billing" className="mb-4 block rounded-2xl bg-muted p-4 transition-colors hover:bg-accent-soft">
            <p className="text-sm font-semibold">Traveler Plus</p>
            <p className="mt-0.5 text-xs text-ink-soft">Unlimited trips, group planning and the full concierge.</p>
            <p className="mt-2 text-xs font-semibold text-accent">See plans →</p>
          </Link>
        )}
        <div className="flex items-center gap-3 border-t border-line px-2 pt-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-bg">{user.name[0]?.toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs capitalize text-ink-faint">{plan === "free" ? "Free Explorer" : plan === "plus" ? "Traveler Plus" : "TripCraft Pro"}</p>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-2.5 backdrop-blur-md lg:hidden">
        <Link href="/home"><Logo /></Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {bell}
        </div>
      </header>

      {demo && (
        <div className="border-b border-line bg-warn-soft px-4 py-1.5 text-center text-xs text-warn">
          Demo mode: local database and sign-in, sample data where live providers aren&apos;t connected.{" "}
          <Link href="/profile#integrations" className="font-semibold underline">Integration status</Link>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">{children}</main>

      {/* Mobile bottom navigation */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden" aria-label="Primary">
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[0.62rem] font-medium", active(href) ? "text-accent" : "text-ink-faint")}>
              <Icon className="h-5 w-5" strokeWidth={active(href) ? 2.3 : 1.7} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
