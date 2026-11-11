import { ConciergeChat } from "@/components/concierge-chat";
import { requireUser } from "@/lib/auth/session";
import { isUuid, withUser } from "@/lib/db";
import { listTrips } from "@/lib/data";
import { getEntitlements, usageThisMonth } from "@/lib/entitlements";
import { integrations } from "@/lib/env";
import type { ChatMessage } from "@/lib/concierge";

export const metadata = { title: "AI Concierge" };
export const maxDuration = 120;

export default async function ConciergePage({ searchParams }: PageProps<"/concierge">) {
  const sp = (await searchParams) as { trip?: string; c?: string };
  const user = await requireUser("/concierge");
  const [trips, ent, usage, data] = await Promise.all([
    listTrips(user.id),
    getEntitlements(user.id),
    usageThisMonth(user.id),
    withUser(user.id, async (q) => {
      const conversations = await q<{ id: string; title: string | null; trip_id: string | null }>("select id, title, trip_id from chat_conversations where user_id = $1 order by updated_at desc limit 30", [user.id]);
      const current = isUuid(sp.c) ? conversations.find((c) => c.id === sp.c) : undefined;
      const messages = current ? await q<ChatMessage>("select * from chat_messages where conversation_id = $1 order by created_at", [current.id]) : [];
      return { conversations, current, messages };
    }),
  ]);
  const tripId = data.current ? data.current.trip_id : trips.find((t) => t.id === sp.trip)?.id ?? (sp.trip === undefined && trips.length === 1 ? trips[0].id : null);
  return (
    <ConciergeChat
      key={`${data.current?.id ?? "new"}-${tripId}`}
      trips={trips.map((t) => ({ id: t.id, title: t.title }))}
      conversations={data.conversations}
      initial={JSON.parse(JSON.stringify(data.messages))}
      tripId={tripId}
      conversationId={data.current?.id ?? null}
      aiConnected={integrations().openai}
      usage={{ used: usage.concierge, limit: ent.limits.conciergePerMonth }}
    />
  );
}
