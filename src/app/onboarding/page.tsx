import { Wizard } from "./wizard";
import { Logo } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getPrefs } from "@/lib/data";

export const metadata = { title: "Welcome" };

export default async function Onboarding({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser("/onboarding");
  const sp = (await searchParams) as { next?: string };
  const next = sp.next?.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "";
  return (
    <div className="min-h-dvh px-4 py-8 sm:py-14">
      <div className="mx-auto mb-8 max-w-2xl"><Logo /></div>
      <Wizard prefs={await getPrefs(user.id)} name={user.full_name} next={next} />
    </div>
  );
}
