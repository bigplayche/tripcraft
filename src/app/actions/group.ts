"use server";
import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { act, changed, no, ok } from "@/lib/action";
import { withUser, j } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getEntitlements, LimitError } from "@/lib/entitlements";
import { PLANS } from "@/lib/plans";
import { appUrl } from "@/lib/env";

export async function createInvite(input: { tripId: string; role: "editor" | "viewer"; email?: string }) {
  return act(async (u) => {
    const role = z.enum(["editor", "viewer"]).parse(input.role);
    const email = input.email?.trim() ? z.string().email().parse(input.email.trim().toLowerCase()) : null;
    const ent = await getEntitlements(u.id);
    return withUser(u.id, async (q) => {
      const [t] = await q("select id, title from trips where id = $1 and owner_id = $2", [input.tripId, u.id]);
      if (!t) return no("Only the trip owner can invite people.");
      // Group-trip allowance: trips this user owns that already have invites or other members.
      const [{ n }] = await q<{ n: number }>(
        `select count(*)::int as n from trips t where t.owner_id = $1 and t.id <> $2 and t.status <> 'archived' and
           (exists (select 1 from trip_members m where m.trip_id = t.id and m.user_id <> $1) or exists (select 1 from trip_invites i where i.trip_id = t.id and not i.revoked))`,
        [u.id, input.tripId],
      );
      if (n >= ent.limits.groupTrips) throw new LimitError(ent.limits.groupTrips === 0 ? "Group trips are part of Traveler Plus. Upgrade to invite friends and family." : `${PLANS[ent.plan].name} includes ${ent.limits.groupTrips} group trip. Upgrade to TripCraft Pro for more.`);
      const token = crypto.randomBytes(24).toString("base64url");
      await q("insert into trip_invites (trip_id, token, email, role, created_by, expires_at) values ($1,$2,$3,$4,$5, now() + interval '30 days')", [input.tripId, token, email, role, u.id]);
      return ok({ url: `${appUrl()}/invite/${token}`, email, title: t.title as string });
    });
  });
}

export async function revokeInvite(id: string) {
  return act(async (u) => changed(await withUser(u.id, (q) => q("update trip_invites set revoked = true where id = $1 returning id", [id]))));
}

export async function acceptInvite(form: FormData) {
  const token = String(form.get("token") ?? "");
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  let tripId: string | null = null;
  try {
    const [r] = await withUser(user.id, (q) => q<{ accept_invite: string }>("select accept_invite($1)", [token]));
    tripId = r.accept_invite;
  } catch {
    redirect(`/invite/${token}?error=1`);
  }
  redirect(`/trips/${tripId}/group`);
}

export async function setMemberRole(tripId: string, userId: string, role: "editor" | "viewer") {
  return act(async (u) => changed(await withUser(u.id, (q) => q("update trip_members set role = $3 where trip_id = $1 and user_id = $2 returning user_id", [tripId, userId, z.enum(["editor", "viewer"]).parse(role)]))));
}
export async function removeMember(tripId: string, userId: string) {
  return act(async (u) => changed(await withUser(u.id, (q) => q("delete from trip_members where trip_id = $1 and user_id = $2 returning user_id", [tripId, userId]))));
}

export async function createPoll(input: { tripId: string; question: string; kind: string; options: string[] }) {
  return act((u) =>
    withUser(u.id, async (q) => {
      const p = z.object({ question: z.string().trim().min(3).max(200), kind: z.enum(["destination", "activity", "restaurant", "other"]), options: z.array(z.string().trim().min(1).max(120)).min(2).max(8) }).parse({ ...input, options: input.options.map((o) => o.trim()).filter(Boolean) });
      await q("insert into group_polls (trip_id, created_by, question, kind, options) values ($1,$2,$3,$4,$5::jsonb)", [input.tripId, u.id, p.question, p.kind, j(p.options.map((label, i) => ({ id: `o${i + 1}`, label })))]);
      await q("select notify_trip_members($1, 'poll', $2, '/group')", [input.tripId, `New vote: ${p.question}`]);
      return ok();
    }),
  );
}

export async function castVote(pollId: string, optionId: string) {
  return act((u) =>
    withUser(u.id, async (q) => {
      const [p] = await q("select trip_id, options, closed from group_polls where id = $1", [pollId]);
      if (!p) return no("Vote not found.");
      if (p.closed) return no("This vote is closed.");
      if (!(p.options as { id: string }[]).some((o) => o.id === optionId)) return no("Unknown option.");
      await q("insert into group_votes (poll_id, trip_id, user_id, option_id) values ($1,$2,$3,$4) on conflict (poll_id, user_id) do update set option_id = excluded.option_id, created_at = now()", [pollId, p.trip_id, u.id, optionId]);
      return ok();
    }),
  );
}
export async function closePoll(pollId: string, closed: boolean) {
  return act(async (u) => changed(await withUser(u.id, (q) => q("update group_polls set closed = $2 where id = $1 returning id", [pollId, closed]))));
}
export async function deletePoll(pollId: string) {
  return act(async (u) => changed(await withUser(u.id, (q) => q("delete from group_polls where id = $1 returning id", [pollId]))));
}

export async function addComment(tripId: string, body: string) {
  return act((u) =>
    withUser(u.id, async (q) => {
      const text = body.trim().slice(0, 2000);
      if (!text) return no("Write a comment first.");
      await q("insert into trip_comments (trip_id, user_id, body) values ($1,$2,$3)", [tripId, u.id, text]);
      await q("select notify_trip_members($1, 'comment', $2, '/group')", [tripId, `${u.full_name || u.email.split("@")[0]} commented on the trip`]);
      return ok();
    }),
  );
}
export async function deleteComment(id: string) {
  return act(async (u) => changed(await withUser(u.id, (q) => q("delete from trip_comments where id = $1 returning id", [id]))));
}
