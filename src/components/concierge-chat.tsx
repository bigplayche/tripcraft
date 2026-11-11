"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Bookmark, MapPin, MessageCircle, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { deleteConversation, savePlace, sendMessage } from "@/app/actions/trips";
import { useAction, useToast } from "@/components/client-ui";
import { Badge, Button, Select } from "@/components/ui";
import { MapCanvas } from "@/components/trip/map-canvas";
import type { ChatMessage } from "@/lib/concierge";
import type { ConciergePlaceOut } from "@/lib/ai/schemas";
import type { MapPoint } from "@/lib/types";
import { cn, money } from "@/lib/utils";

const STARTERS = ["Find me a romantic restaurant near my hotel", "What should I do if it rains tomorrow?", "Find activities under $20", "How is my budget looking?", "What should I pack?", "Give me something fun to do tonight"];
type Conv = { id: string; title: string | null; trip_id: string | null };

export function ConciergeChat({ trips, conversations, initial, tripId, conversationId, aiConnected, usage }: { trips: { id: string; title: string }[]; conversations: Conv[]; initial: ChatMessage[]; tripId: string | null; conversationId: string | null; aiConnected: boolean; usage: { used: number; limit: number } }) {
  const [messages, setMessages] = useState(initial);
  const [convId, setConvId] = useState(conversationId);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [mapFor, setMapFor] = useState<ConciergePlaceOut | null>(null);
  const [used, setUsed] = useState(usage.used);
  const end = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const toast = useToast();
  const { run } = useAction();
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView, and effects must not return one.
    void end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const send = async (body: string) => {
    const message = body.trim();
    if (!message || busy) return;
    setText("");
    setBusy(true);
    setMessages((m) => [...m, { id: `tmp${Date.now()}`, role: "user", content: message, places: [], meta: {}, created_at: new Date().toISOString() }]);
    try {
      const r = await sendMessage({ conversationId: convId, tripId, message });
      if (!r.ok) {
        toast(r.error, r.code === "upgrade_required" ? "upgrade" : "error");
        setMessages((m) => m.slice(0, -1));
        setText(message);
      } else if (r.data) {
        setMessages((m) => [...m, r.data!.reply]);
        setUsed((u) => u + 1);
        if (!convId) {
          setConvId(r.data.conversationId);
          window.history.replaceState(null, "", `/concierge?c=${r.data.conversationId}`);
        }
        if (r.data.reply.meta.changed) toast("Your itinerary was updated");
        router.refresh();
      }
    } catch {
      toast("The concierge couldn't answer. Please try again.", "error");
      setMessages((m) => m.slice(0, -1));
      setText(message);
    } finally {
      setBusy(false);
    }
  };
  const point = (p: ConciergePlaceOut): MapPoint[] => (p.lat != null && p.lng != null ? [{ id: "p", kind: p.kind === "restaurant" ? "restaurant" : p.kind === "hotel" ? "hotel" : /bar|night/.test(p.kind) ? "nightlife" : "activity", name: p.name, lat: p.lat, lng: p.lng }] : []);

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside className="hidden content-start gap-2 lg:grid">
        <Link href={`/concierge${tripId ? `?trip=${tripId}` : ""}`} className="mb-2 flex items-center justify-center gap-2 rounded-full border border-line bg-surface py-2 text-sm font-medium hover:bg-muted"><Plus className="h-4 w-4" />New conversation</Link>
        {conversations.map((c) => (
          <div key={c.id} className={cn("group flex items-center rounded-xl text-sm", c.id === convId ? "bg-accent-soft text-accent-strong" : "text-ink-soft hover:bg-muted")}>
            <Link href={`/concierge?c=${c.id}`} className="min-w-0 flex-1 truncate px-3 py-2">{c.title || "Conversation"}</Link>
            <button aria-label="Delete conversation" className="px-2 opacity-0 focus:opacity-100 group-hover:opacity-100" onClick={() => run(() => deleteConversation(c.id), { onDone: () => c.id === convId && router.push("/concierge") })}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {conversations.length === 0 && <p className="px-3 text-xs text-ink-faint">Your conversations will appear here.</p>}
      </aside>

      <section className="card flex h-[calc(100dvh-13.5rem)] min-h-[28rem] flex-col overflow-hidden lg:h-[calc(100dvh-11rem)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-on-accent"><Sparkles className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">TripCraft Concierge</p>
            <p className="text-xs text-ink-faint">{aiConnected ? "Knows your trip, budget and preferences" : "Demo mode: answers from your stored plan only"}</p>
          </div>
          <Select aria-label="Trip this conversation is about" value={tripId ?? ""} disabled={!!convId} onChange={(e) => router.push(`/concierge${e.target.value ? `?trip=${e.target.value}` : ""}`)} className="h-9 min-h-0 w-auto max-w-44 py-1 text-sm">
            <option value="">No trip selected</option>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
          {messages.length === 0 && (
            <div className="mx-auto max-w-md py-6 text-center">
              <MessageCircle className="mx-auto h-8 w-8 text-accent" />
              <h2 className="display mt-3 text-2xl">How can I help with your trip?</h2>
              <p className="mt-1 text-sm text-ink-soft">{tripId ? "Ask anything. I already know your itinerary, stay and budget." : "Select a trip above so I can answer with your itinerary and budget in mind."}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:border-accent hover:text-accent">{s}</button>)}
              </div>
            </div>
          )}
          <div className="grid gap-4">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex animate-rise flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                <div className={cn("max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed sm:max-w-[75%]", m.role === "user" ? "rounded-br-md bg-ink text-bg" : "rounded-bl-md bg-muted")}>{m.content}</div>
                {m.places.length > 0 && (
                  <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                    {m.places.map((p, i) => (
                      <div key={i} className="rounded-2xl border border-line bg-surface p-3.5 text-sm">
                        <div className="flex items-start justify-between gap-2"><p className="font-semibold leading-snug">{p.name}</p>{p.verified ? <span title={`${p.source}${p.fetched_at ? `, fetched ${new Date(p.fetched_at).toLocaleString()}` : ""}`}><BadgeCheck className="h-4 w-4 shrink-0 text-ok" /></span> : <Badge tone="outline" className="shrink-0">Unverified</Badge>}</div>
                        <p className="text-xs capitalize text-ink-faint">{p.kind}{p.rating != null ? ` · ${p.rating}★ (Google)` : ""}{p.est_cost_pp_usd != null ? ` · ~${money(p.est_cost_pp_usd)}` : ""}</p>
                        {p.why && <p className="mt-1.5 text-ink-soft">{p.why}</p>}
                        {p.address && <p className="mt-1 text-xs text-ink-faint">{p.address}</p>}
                        <div className="mt-2.5 flex gap-3 text-xs font-medium text-accent">
                          {p.lat != null && <button onClick={() => setMapFor(mapFor === p ? null : p)} className="flex items-center gap-1 hover:underline"><MapPin className="h-3.5 w-3.5" />{mapFor === p ? "Hide map" : "View on map"}</button>}
                          <button onClick={() => run(() => savePlace({ tripId, name: p.name, kind: p.kind, note: p.why, address: p.address, lat: p.lat, lng: p.lng, url: p.url }), { success: "Saved. It now appears on your trip map.", refresh: false })} className="flex items-center gap-1 hover:underline"><Bookmark className="h-3.5 w-3.5" />Save</button>
                        </div>
                        {mapFor === p && <MapCanvas points={point(p)} selectedId="p" onSelect={() => {}} path={null} fallbackCenter={[p.lat!, p.lng!]} className="mt-3 h-44 w-full overflow-hidden rounded-xl" />}
                      </div>
                    ))}
                  </div>
                )}
                {m.role === "assistant" && (
                  <p className="text-[0.7rem] text-ink-faint">
                    {m.meta.mode === "demo" ? "Demo concierge · from your stored plan" : "AI concierge"}
                    {m.meta.sources?.length ? ` · sources: ${m.meta.sources.join(", ")}` : ""} · estimates unless marked verified
                  </p>
                )}
                {m.role === "assistant" && m === messages[messages.length - 1] && m.meta.follow_ups?.length ? (
                  <div className="flex flex-wrap gap-1.5">{m.meta.follow_ups.map((f) => <button key={f} onClick={() => send(f)} className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft hover:border-accent hover:text-accent">{f}</button>)}</div>
                ) : null}
              </div>
            ))}
            {busy && <div className="flex w-16 items-center justify-center gap-1 rounded-2xl rounded-bl-md bg-muted py-3.5" aria-label="Concierge is typing">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint" style={{ animationDelay: `${i * 120}ms` }} />)}</div>}
            <div ref={end} />
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="border-t border-line p-3">
          <div className="flex items-end gap-2 rounded-3xl border border-line bg-surface px-4 py-2 focus-within:border-accent">
            <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }} rows={1} maxLength={2000} placeholder="Ask about your trip…" aria-label="Message the concierge" className="max-h-32 min-h-8 flex-1 resize-none bg-transparent py-1 text-[0.95rem] focus:outline-none" />
            <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
          </div>
          <p className="mt-1.5 px-2 text-[0.7rem] text-ink-faint">{used} of {usage.limit} messages used this month. The concierge never confirms bookings, prices or availability: check with the provider.</p>
        </form>
      </section>
    </div>
  );
}
