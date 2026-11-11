import Link from "next/link";
import { Users } from "lucide-react";
import { acceptInvite } from "@/app/actions/group";
import { SubmitButton } from "@/components/client-ui";
import { LinkButton, Logo } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/session";
import { asService, withUser } from "@/lib/db";

export const metadata = { title: "You're invited" };

export default async function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const sp = (await searchParams) as { error?: string };
  const user = await getSessionUser();
  const sql = "select * from peek_invite($1)";
  // peek_invite() only reveals the trip title and inviter name, and only for a valid, unexpired token.
  const [inv] = /^[\w-]{20,80}$/.test(token) ? (user ? await withUser(user.id, (q) => q(sql, [token])) : await asService((q) => q(sql, [token]))) : [];
  const next = encodeURIComponent(`/invite/${token}`);
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="mb-8 inline-block"><Logo /></Link>
        <div className="card p-8 shadow-float">
          <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent"><Users className="h-6 w-6" /></span>
          {!inv || sp.error ? (
            <>
              <h1 className="display text-2xl">This invitation isn&apos;t valid</h1>
              <p className="mt-2 text-ink-soft">It may have expired or been revoked. Ask the trip owner for a new link.</p>
              <LinkButton href={user ? "/home" : "/"} variant="outline" className="mt-6">Go to TripCraft</LinkButton>
            </>
          ) : (
            <>
              <p className="eyebrow mb-2">You&apos;re invited</p>
              <h1 className="display text-3xl">{inv.trip_title}</h1>
              <p className="mt-2 text-ink-soft">{inv.inviter_name} invited you to plan a trip to {inv.destination_name} together as {inv.role === "editor" ? "an editor" : "a viewer"}.</p>
              {user ? (
                <form action={acceptInvite} className="mt-6"><input type="hidden" name="token" value={token} /><SubmitButton className="w-full">Join this trip</SubmitButton></form>
              ) : (
                <div className="mt-6 grid gap-2">
                  <LinkButton href={`/signup?next=${next}`}>Create a free account to join</LinkButton>
                  <LinkButton href={`/login?next=${next}`} variant="ghost">I already have an account</LinkButton>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
