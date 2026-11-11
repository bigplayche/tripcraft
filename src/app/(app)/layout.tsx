import { redirect } from "next/navigation";
import { AppShell, type Notif } from "@/components/app-shell";
import { displayName, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { getEntitlements } from "@/lib/entitlements";
import { isDemoMode } from "@/lib/env";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  if (!user.onboarded) redirect("/onboarding");
  const [ent, notifications] = await Promise.all([
    getEntitlements(user.id),
    withUser(user.id, (q) => q<Notif>("select id, title, link, read_at, created_at from notifications where user_id = $1 order by created_at desc limit 12", [user.id])),
  ]);
  return (
    <AppShell user={{ name: displayName(user), email: user.email }} plan={ent.plan} demo={isDemoMode()} notifications={JSON.parse(JSON.stringify(notifications))}>
      {children}
    </AppShell>
  );
}
