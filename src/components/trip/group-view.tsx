"use client";
import { useState } from "react";
import { Check, Copy, Crown, Link2, Mail, MessageSquare, Plus, Trash2, UserMinus, Vote } from "lucide-react";
import { addComment, castVote, closePoll, createInvite, createPoll, deleteComment, deletePoll, removeMember, revokeInvite, setMemberRole } from "@/app/actions/group";
import { suggestPlace } from "@/app/actions/itinerary";
import { settleSplit } from "@/app/actions/budget";
import { Modal, Spinner, useAction, useToast } from "@/components/client-ui";
import { Badge, Button, EmptyState, Field, Input, SectionTitle, Select, Textarea } from "@/components/ui";
import { ExpenseForm } from "./budget-view";
import type { Expense, Member, Split } from "@/lib/types";
import { cn, money, timeAgo } from "@/lib/utils";

export type Poll = { id: string; question: string; kind: string; options: { id: string; label: string }[]; closed: boolean; created_by: string | null; votes: { user_id: string; option_id: string }[] };
export type Comment = { id: string; user_id: string; body: string; created_at: string };
export type Invite = { id: string; token: string; email: string | null; role: string; uses: number; expires_at: string | null };

export function GroupView({ tripId, me, role, members, invites, polls, comments, expenses, splits, appUrl }: { tripId: string; me: string; role: string; members: Member[]; invites: Invite[]; polls: Poll[]; comments: Comment[]; expenses: Expense[]; splits: Split[]; appUrl: string }) {
  const { run, pending } = useAction();
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [link, setLink] = useState<{ url: string; email: string | null; title: string } | null>(null);
  const isOwner = role === "owner", canEdit = role !== "viewer";
  const name = (id: string | null) => { const m = members.find((x) => x.user_id === id); return m ? (m.user_id === me ? "You" : m.full_name || m.email.split("@")[0]) : "Former member"; };
  const copy = async (url: string) => { try { await navigator.clipboard.writeText(url); toast("Invite link copied"); } catch { toast("Copy the link from the box", "error"); } };
  const shared = expenses.filter((e) => e.is_shared);
  const paid = (id: string) => shared.filter((e) => e.paid_by === id).reduce((a, e) => a + e.amount, 0);
  const owes = (id: string) => splits.filter((s) => s.user_id === id && !s.settled).reduce((a, s) => a + s.amount, 0);

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_20rem]">
      <div className="grid min-w-0 content-start gap-12">
        {/* Votes */}
        <section>
          <SectionTitle title="Group votes" hint="Everyone on the trip can vote. The leading choice is highlighted." action={canEdit && <Button size="sm" onClick={() => setPollOpen(true)}><Plus className="h-4 w-4" />New vote</Button>} />
          {polls.length === 0 ? <EmptyState icon={<Vote className="h-5 w-5" />} title="No votes yet" body="Can't agree on a restaurant or an activity? Put it to a vote." /> : (
            <div className="grid gap-4">
              {polls.map((p) => {
                const total = p.votes.length;
                const counts = p.options.map((o) => p.votes.filter((v) => v.option_id === o.id).length);
                const top = Math.max(...counts);
                const mine = p.votes.find((v) => v.user_id === me)?.option_id;
                return (
                  <div key={p.id} className="card p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div><Badge tone="outline" className="mb-1.5 capitalize">{p.kind}</Badge><h3 className="font-semibold">{p.question}</h3></div>
                      <div className="flex shrink-0 items-center gap-1">
                        {p.closed && <Badge>Closed</Badge>}
                        {(p.created_by === me || isOwner) && <><Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => closePoll(p.id, !p.closed))}>{p.closed ? "Reopen" : "Close"}</Button><Button variant="ghost" size="icon" aria-label="Delete vote" disabled={pending} onClick={() => run(() => deletePoll(p.id))}><Trash2 className="h-4 w-4" /></Button></>}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      {p.options.map((o, i) => {
                        const lead = top > 0 && counts[i] === top;
                        return (
                          <button key={o.id} disabled={pending || p.closed} aria-pressed={mine === o.id} onClick={() => run(() => castVote(p.id, o.id))} className={cn("relative overflow-hidden rounded-xl border px-4 py-2.5 text-left text-sm transition-colors", mine === o.id ? "border-accent" : "border-line hover:border-ink-faint", p.closed && "cursor-default")}>
                            <span className={cn("absolute inset-y-0 left-0 transition-all duration-500", lead ? "bg-accent-soft" : "bg-muted")} style={{ width: `${total ? (counts[i] / total) * 100 : 0}%` }} />
                            <span className="relative flex items-center justify-between gap-3">
                              <span className="flex items-center gap-2 font-medium">{mine === o.id && <Check className="h-4 w-4 text-accent" />}{o.label}{lead && <Badge tone="accent">Leading</Badge>}</span>
                              <span className="tabular-nums text-ink-soft">{counts[i]} vote{counts[i] !== 1 ? "s" : ""}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-ink-faint">{total} of {members.length} voted{mine ? " · tap another option to change your vote" : ""}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Shared expenses */}
        <section>
          <SectionTitle title="Shared expenses" hint="Split costs equally and track who has settled up." action={canEdit && <Button size="sm" variant="outline" onClick={() => setExpenseOpen(true)}><Plus className="h-4 w-4" />Add shared expense</Button>} />
          {shared.length === 0 ? <EmptyState title="No shared expenses yet" body="Add something one person paid for, and TripCraft splits it between the group." /> : (
            <div className="grid gap-3">
              <div className="card grid gap-2 p-4 sm:grid-cols-2">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2 text-sm">
                    <span className="font-medium">{name(m.user_id)}</span>
                    <span className="text-right text-xs text-ink-soft">paid {money(paid(m.user_id), "USD", 2)}<br />{owes(m.user_id) > 0 ? <span className="font-medium text-danger">owes {money(owes(m.user_id), "USD", 2)}</span> : <span className="text-ok">all settled</span>}</span>
                  </div>
                ))}
              </div>
              {shared.map((e) => (
                <div key={e.id} className="card p-4">
                  <div className="flex items-baseline justify-between gap-3"><p className="font-medium">{e.description}</p><p className="font-semibold tabular-nums">{money(e.amount, "USD", 2)}</p></div>
                  <p className="text-xs text-ink-soft">Paid by {name(e.paid_by)}</p>
                  <ul className="mt-3 grid gap-1.5">
                    {splits.filter((s) => s.expense_id === e.id).map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                        <span>{name(s.user_id)} <span className="text-ink-soft">· {money(s.amount, "USD", 2)}</span></span>
                        {s.user_id === e.paid_by ? <Badge tone="ok">Paid</Badge> : s.settled ? (
                          <button disabled={pending || !(canEdit || s.user_id === me)} onClick={() => run(() => settleSplit(s.id, false))}><Badge tone="ok"><Check className="h-3 w-3" />Settled</Badge></button>
                        ) : canEdit || s.user_id === me ? <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => settleSplit(s.id, true), { success: "Marked as settled" })}>Mark settled</Button> : <Badge tone="warn">Owes</Badge>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Comments */}
        <section>
          <SectionTitle title="Trip discussion" action={<Button size="sm" variant="outline" onClick={() => setSuggestOpen(true)}>Suggest a place</Button>} />
          <form action={(f) => run(() => addComment(tripId, String(f.get("body"))), { onDone: () => (document.getElementById("comment-box") as HTMLTextAreaElement).value = "" })} className="card mb-4 p-3">
            <Textarea id="comment-box" name="body" required maxLength={2000} placeholder="Share a thought with the group…" className="min-h-16 border-0 shadow-none focus:shadow-none" />
            <div className="flex justify-end"><Button size="sm" type="submit" disabled={pending}>Post</Button></div>
          </form>
          {comments.length === 0 ? <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No comments yet" /> : (
            <ul className="grid gap-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-bg">{name(c.user_id)[0]?.toUpperCase()}</span>
                  <div className="min-w-0 flex-1 rounded-2xl bg-muted px-4 py-2.5">
                    <p className="flex items-center justify-between gap-2 text-xs text-ink-soft"><span><span className="font-semibold text-ink">{name(c.user_id)}</span> · {timeAgo(c.created_at)}</span>{(c.user_id === me || isOwner) && <button aria-label="Delete comment" disabled={pending} onClick={() => run(() => deleteComment(c.id))}><Trash2 className="h-3.5 w-3.5" /></button>}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Members & invitations */}
      <aside className="grid content-start gap-4 lg:sticky lg:top-8 lg:self-start">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Who&apos;s coming</h2><span className="text-xs text-ink-faint">{members.length} member{members.length > 1 ? "s" : ""}</span></div>
          <ul className="grid gap-3">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-strong">{(m.full_name || m.email)[0].toUpperCase()}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{name(m.user_id)}</p><p className="truncate text-xs text-ink-faint">{m.email}</p></div>
                {m.role === "owner" ? <Badge tone="accent"><Crown className="h-3 w-3" />Owner</Badge> : isOwner ? (
                  <div className="flex items-center">
                    <Select aria-label={`Role for ${name(m.user_id)}`} value={m.role} disabled={pending} onChange={(e) => run(() => setMemberRole(tripId, m.user_id, e.target.value as "editor" | "viewer"), { success: "Permissions updated" })} className="h-8 min-h-0 w-24 py-0.5 pl-2 text-xs"><option value="editor">Editor</option><option value="viewer">Viewer</option></Select>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${name(m.user_id)}`} disabled={pending} onClick={() => run(() => removeMember(tripId, m.user_id), { success: "Member removed" })}><UserMinus className="h-4 w-4" /></Button>
                  </div>
                ) : <Badge className="capitalize">{m.role}</Badge>}
              </li>
            ))}
          </ul>
          {isOwner && <Button className="mt-5 w-full" onClick={() => { setLink(null); setInviteOpen(true); }}><Link2 className="h-4 w-4" />Invite friends &amp; family</Button>}
          <p className="mt-3 text-xs text-ink-faint">Owners manage people and permissions. Editors change the plan and expenses. Viewers can see everything, vote, comment and suggest.</p>
        </div>
        {isOwner && invites.length > 0 && (
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Active invitations</h2>
            <ul className="grid gap-3">
              {invites.map((i) => (
                <li key={i.id} className="text-sm">
                  <p className="flex items-center justify-between gap-2"><span className="truncate">{i.email ?? "Invite link"} <span className="text-ink-faint">· {i.role}</span></span><span className="shrink-0 text-xs text-ink-faint">{i.uses} joined</span></p>
                  <div className="mt-1 flex gap-1"><Button size="sm" variant="outline" onClick={() => copy(`${appUrl}/invite/${i.token}`)}><Copy className="h-3.5 w-3.5" />Copy</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => revokeInvite(i.id), { success: "Invitation revoked" })}>Revoke</Button></div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite to this trip">
        {link ? (
          <div className="grid gap-4">
            <p className="text-sm text-ink-soft">Anyone with this link can join after signing in. It expires in 30 days and you can revoke it at any time.</p>
            <Input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label="Invite link" />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => copy(link.url)}><Copy className="h-4 w-4" />Copy link</Button>
              <a className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-line text-[0.95rem] font-medium hover:bg-muted" href={`mailto:${link.email ?? ""}?subject=${encodeURIComponent(`Join me on TripCraft: ${link.title}`)}&body=${encodeURIComponent(`I'm planning a trip on TripCraft and would love your input.\n\nJoin here: ${link.url}`)}`}><Mail className="h-4 w-4" />Email it</a>
            </div>
            <p className="text-xs text-ink-faint">“Email it” opens your own mail app with the link filled in. TripCraft doesn&apos;t send invitation emails itself.</p>
          </div>
        ) : (
          <form action={(f) => run(() => createInvite({ tripId, role: String(f.get("role")) as "editor" | "viewer", email: String(f.get("email") ?? "") }), { onDone: (d) => d && setLink(d) })} className="grid gap-4">
            <Field label="They can"><Select name="role" defaultValue="editor"><option value="editor">Edit the plan and expenses (Editor)</option><option value="viewer">View, vote and comment (Viewer)</option></Select></Field>
            <Field label="Their email (optional)" hint="Used to pre-fill an email draft. The link works for anyone you share it with."><Input name="email" type="email" placeholder="friend@example.com" /></Field>
            <Button type="submit" disabled={pending}>{pending && <Spinner />}Create invite link</Button>
          </form>
        )}
      </Modal>

      <Modal open={pollOpen} onClose={() => setPollOpen(false)} title="Start a vote">
        <form action={(f) => run(() => createPoll({ tripId, question: String(f.get("question")), kind: String(f.get("kind")), options: f.getAll("option").map(String) }), { success: "Vote created", onDone: () => setPollOpen(false) })} className="grid gap-4">
          <Field label="What are you deciding?"><Input name="question" required maxLength={200} placeholder="Where should we have dinner on Friday?" /></Field>
          <Field label="About"><Select name="kind" defaultValue="restaurant"><option value="restaurant">A restaurant</option><option value="activity">An activity</option><option value="destination">A destination</option><option value="other">Something else</option></Select></Field>
          <fieldset className="grid gap-2"><legend className="mb-1.5 text-[0.8rem] font-medium text-ink-soft">Options (at least two)</legend>{[1, 2, 3, 4].map((n) => <Input key={n} name="option" required={n <= 2} maxLength={120} placeholder={`Option ${n}${n > 2 ? " (optional)" : ""}`} />)}</fieldset>
          <Button type="submit" disabled={pending}>Create vote</Button>
        </form>
      </Modal>

      <Modal open={expenseOpen} onClose={() => setExpenseOpen(false)} title="Add a shared expense">
        <ExpenseForm tripId={tripId} expense={null} members={members} me={me} forceShared onDone={() => setExpenseOpen(false)} />
      </Modal>

      <Modal open={suggestOpen} onClose={() => setSuggestOpen(false)} title="Suggest a place">
        <form action={(f) => run(() => suggestPlace({ tripId, type: String(f.get("type")) as "activity" | "restaurant", name: String(f.get("name")), note: String(f.get("note") ?? "") }), { success: "Suggestion shared with the group", onDone: () => setSuggestOpen(false) })} className="grid gap-4">
          <Field label="Type"><Select name="type"><option value="activity">Activity</option><option value="restaurant">Restaurant</option></Select></Field>
          <Field label="Name"><Input name="name" required maxLength={200} /></Field>
          <Field label="Why? (optional)"><Textarea name="note" maxLength={500} /></Field>
          <p className="text-xs text-ink-faint">Suggestions appear on the Places tab for an owner or editor to accept.</p>
          <Button type="submit" disabled={pending}>Share suggestion</Button>
        </form>
      </Modal>
    </div>
  );
}
