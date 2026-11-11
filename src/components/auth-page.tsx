import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "./auth-form";
import { Logo } from "./ui";
import { DestinationImage } from "./destination-image";
import { getSessionUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { DESTINATIONS } from "@/lib/catalog";

export async function AuthPage({ mode, searchParams }: { mode: "login" | "signup"; searchParams: Promise<{ next?: string }> }) {
  const { next: raw } = await searchParams;
  const next = raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/home";
  if (await getSessionUser()) redirect(next);
  const d = DESTINATIONS[mode === "login" ? 0 : 5];
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/"><Logo /></Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <AuthForm mode={mode} next={next} oauth={!isDemoMode()} />
        </div>
      </div>
      <div className="relative hidden lg:block">
        <DestinationImage src={`/destinations/${d.slug}.jpg`} name={d.name} art={d.art} className="absolute inset-0" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <p className="display text-4xl leading-tight">Plan less.<br />Travel more.</p>
          <p className="mt-3 text-white/80">{d.name}, {d.country}</p>
        </div>
      </div>
    </div>
  );
}
