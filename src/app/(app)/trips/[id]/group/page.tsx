import { notFound } from "next/navigation";
import { GroupView, type Comment, type Invite, type Poll } from "@/components/trip/group-view";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { loadExpenses, loadMembers, tripRow } from "@/lib/data";
import { appUrl } from "@/lib/env";

export const metadata = { title: "Group" };

export default async function GroupPage({ params }: PageProps<"/trips/[id]/group">) {
  const { id } = await params;
  const user = await requireUser(`/trips/${id}/group`);
  const data = await withUser(user.id, async (q) => {
    const trip = await tripRow(q, user.id, id).catch(() => null);
    if (!trip) return null;
    const [members, money, polls, votes, comments, invites] = await Promise.all([
      loadMembers(q, id), loadExpenses(q, id),
      q<Poll>("select * from group_polls where trip_id = $1 order by closed, created_at desc", [id]),
      q<{ poll_id: string; user_id: string; option_id: string }>("select poll_id, user_id, option_id from group_votes where trip_id = $1", [id]),
      q<Comment>("select * from trip_comments where trip_id = $1 order by created_at desc limit 100", [id]),
      q<Invite>("select * from trip_invites where trip_id = $1 and not revoked and (expires_at is null or expires_at > now()) order by created_at desc", [id]),
    ]);
    return { trip, members, ...money, polls: polls.map((p) => ({ ...p, votes: votes.filter((v) => v.poll_id === p.id) })), comments, invites };
  });
  if (!data) notFound();
  const d = JSON.parse(JSON.stringify(data)) as typeof data;
  return <GroupView tripId={id} me={user.id} role={d.trip.role ?? "viewer"} members={d.members} invites={d.invites} polls={d.polls} comments={d.comments} expenses={d.expenses} splits={d.splits} appUrl={appUrl()} />;
}
