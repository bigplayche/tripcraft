"use client";
import { useState } from "react";
import { Lock, Pencil, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { deleteExpense, saveExpense, setExpenseStatus } from "@/app/actions/budget";
import { getBudgetAdvice, updateTrip } from "@/app/actions/trips";
import { Modal, Spinner, useAction } from "@/components/client-ui";
import { Badge, Button, EmptyState, Field, Input, LinkButton, Notice, SectionTitle, Select, SourceNote } from "@/components/ui";
import { EXPENSE_CATEGORIES } from "@/lib/plans";
import type { BudgetAdvice } from "@/lib/ai/schemas";
import type { Expense, Hotel, Member } from "@/lib/types";
import { cn, money } from "@/lib/utils";

type Summary = { total: number; estimated: number; booked: number; paid: number; byCategory: Record<string, number>; days: number; remaining: number; perTraveler: number; perDay: number; pct: number };
const label = (id: string) => EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
const STATUS_TONE = { estimated: "neutral", booked: "accent", paid: "ok" } as const;

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" | "ok" }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <p className={cn("display mt-1 text-2xl sm:text-3xl", tone === "danger" && "text-danger", tone === "ok" && "text-ok")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-faint">{sub}</p>}
    </div>
  );
}

export function BudgetView({ tripId, budget, travelers, s, expenses, members, hotels, canEdit, canCompare, me, nights, budgetAtGeneration }: { tripId: string; budget: number; travelers: number; s: Summary; expenses: Expense[]; members: Member[]; hotels: Hotel[]; canEdit: boolean; canCompare: boolean; me: string; nights: number; budgetAtGeneration: number | null }) {
  const { run, pending } = useAction();
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [editBudget, setEditBudget] = useState(false);
  const [advice, setAdvice] = useState<(BudgetAdvice & { mode: string }) | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const cats = EXPENSE_CATEGORIES.map((c) => ({ ...c, amount: s.byCategory[c.id] ?? 0 })).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const max = Math.max(1, ...cats.map((c) => c.amount));
  const over = s.remaining < 0;
  const selected = hotels.find((h) => h.selected);
  const rooms = Math.ceil(travelers / 2);
  const name = (id: string | null) => { const m = members.find((x) => x.user_id === id); return m ? (m.user_id === me ? "You" : m.full_name || m.email.split("@")[0]) : "—"; };

  return (
    <div className="grid gap-10">
      <section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Estimated total trip cost" value={money(s.total)} sub={`of ${money(budget)} budget`} />
          <Stat label={over ? "Over budget by" : "Remaining budget"} value={money(Math.abs(s.remaining))} tone={over ? "danger" : "ok"} sub={over ? "Trim costs or raise the budget" : "Not yet allocated"} />
          <Stat label="Cost per traveler" value={money(s.perTraveler)} sub={`${travelers} traveler${travelers > 1 ? "s" : ""}`} />
          <Stat label="Cost per day" value={money(s.perDay)} sub={`${s.days} day${s.days > 1 ? "s" : ""}`} />
        </div>

        <div className="card mt-3 p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{Math.round(s.pct)}% of budget planned</p>
            {canEdit && <Button variant="ghost" size="sm" onClick={() => setEditBudget(true)}><Pencil className="h-3.5 w-3.5" />Edit budget</Button>}
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(s.pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Share of budget planned">
            <div className={cn("h-full rounded-full transition-all duration-700", over ? "bg-danger" : "bg-accent")} style={{ width: `${Math.min(100, s.pct)}%` }} />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            {(["estimated", "booked", "paid"] as const).map((k) => (
              <div key={k}><dt className="flex items-center gap-1.5 text-xs capitalize text-ink-soft"><Badge tone={STATUS_TONE[k]}>{k}</Badge></dt><dd className="mt-1 font-semibold tabular-nums">{money(s[k])}</dd></div>
            ))}
          </dl>
        </div>
        {budgetAtGeneration != null && budgetAtGeneration !== budget && canEdit && (
          <div className="mt-3"><Notice tone="accent" title="Budget changed since the itinerary was built" action={<LinkButton href={`/trips/${tripId}`} size="sm">Review &amp; regenerate</LinkButton>}>Your plan was built for {money(budgetAtGeneration)}. You can regenerate the itinerary around {money(budget)} from the Itinerary tab.</Notice></div>
        )}
      </section>

      <section>
        <SectionTitle title="Where the money goes" hint="Total for the whole group, by category" />
        {cats.length === 0 ? <EmptyState title="No expenses yet" body="Generate the itinerary for an estimated budget, or add expenses yourself." /> : (
          <div className="card p-5">
            <ul className="grid gap-3">
              {cats.map((c) => (
                <li key={c.id} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-sm" onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)}>
                  <span className="truncate text-ink-soft">{c.label}</span>
                  <span className="relative h-6" title={`${c.label}: ${money(c.amount)} (${Math.round((c.amount / Math.max(1, s.total)) * 100)}% of planned spend)`}>
                    <span className={cn("absolute inset-y-1 left-0 rounded-r-[4px] bg-accent transition-opacity", hover && hover !== c.id && "opacity-40")} style={{ width: `${Math.max(1.5, (c.amount / max) * 100)}%` }} />
                  </span>
                  <span className="w-28 text-right tabular-nums"><span className="font-medium">{money(c.amount)}</span> <span className="text-xs text-ink-faint">{Math.round((c.amount / Math.max(1, s.total)) * 100)}%</span></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <SectionTitle title="Expenses" hint="Move each line from estimated to booked to paid as your plans firm up." action={canEdit && <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Add expense</Button>} />
        {expenses.length === 0 ? <EmptyState title="Nothing here yet" /> : (
          <div className="card divide-y divide-line">
            {expenses.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{label(e.category)}{e.source === "ai" && <Badge tone="outline">Plan estimate</Badge>}{e.is_shared && <Badge tone="outline"><Users className="h-3 w-3" />Shared · paid by {name(e.paid_by)}</Badge>}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{e.description}</p>
                </div>
                <p className="w-24 text-right font-semibold tabular-nums">{money(e.amount, "USD", e.amount % 1 ? 2 : 0)}</p>
                {canEdit ? (
                  <Select aria-label={`Status of ${e.description}`} value={e.status} disabled={pending} onChange={(ev) => run(() => setExpenseStatus(e.id, ev.target.value as Expense["status"]))} className="h-9 min-h-0 w-32 py-1 text-sm capitalize">
                    <option value="estimated">Estimated</option><option value="booked">Booked</option><option value="paid">Paid</option>
                  </Select>
                ) : <Badge tone={STATUS_TONE[e.status]} className="capitalize">{e.status}</Badge>}
                {canEdit && (
                  <div className="flex">
                    <Button variant="ghost" size="icon" aria-label="Edit expense" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete expense" disabled={pending} onClick={() => run(() => deleteExpense(e.id), { success: "Expense deleted" })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <SourceNote className="mt-3">“Plan estimate” lines come from your itinerary and are estimates or allowances, never live prices.</SourceNote>
      </section>

      <section>
        <SectionTitle title="Save without sacrificing the trip" hint="Where you could trim, ranked by how little it changes the experience." action={<Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => getBudgetAdvice(tripId), { refresh: false, onDone: (d) => d && setAdvice(d) })}>{pending ? <Spinner /> : <Sparkles className="h-4 w-4" />}Get savings advice</Button>} />
        {advice ? (
          <div className="card p-5">
            {advice.mode === "demo" && <Badge tone="warn" className="mb-3">Rule-based suggestions · AI not connected</Badge>}
            <p className="text-sm">{advice.summary}</p>
            <ul className="mt-4 grid gap-3">
              {advice.savings.map((x, i) => (
                <li key={i} className="flex items-start gap-4 rounded-xl bg-muted p-4">
                  <div className="min-w-0 flex-1"><p className="font-medium">{x.title}</p><p className="mt-0.5 text-sm text-ink-soft">{x.detail}</p><p className="mt-1 text-xs text-ink-faint">{label(x.category)} · impact on the experience: {x.experience_impact}</p></div>
                  <p className="shrink-0 text-right"><span className="block font-semibold text-ok">~{money(x.est_saving_usd)}</span><span className="text-xs text-ink-faint">est. saving</span></p>
                </li>
              ))}
            </ul>
            {advice.keep.length > 0 && <p className="mt-4 text-sm text-ink-soft"><span className="font-medium text-ink">Worth keeping: </span>{advice.keep.join(" ")}</p>}
          </div>
        ) : <p className="rounded-[1.25rem] border border-dashed border-line px-5 py-6 text-sm text-ink-soft">Ask TripCraft to review your plan and explain where money can be saved.</p>}
      </section>

      {hotels.length > 1 && (
        <section>
          <SectionTitle title="Compare stay scenarios" hint="How your total changes with each stay option (estimates)." />
          {canCompare ? (
            <div className="card divide-y divide-line">
              {hotels.map((h) => {
                const total = s.total - (selected?.est_nightly ?? 0) * nights * rooms + (h.est_nightly ?? 0) * nights * rooms;
                return (
                  <div key={h.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                    <p className="min-w-0 flex-1 basis-48"><span className="font-medium">{h.name}</span>{h.selected && <Badge tone="accent" className="ml-2">Current</Badge>}<span className="block text-xs capitalize text-ink-soft">{h.tier} · ~{money(h.est_nightly)}/night</span></p>
                    <p className="tabular-nums"><span className="font-semibold">{money(total)}</span> total</p>
                    <p className={cn("w-32 text-right text-xs font-medium", total > budget ? "text-danger" : "text-ok")}>{total > budget ? `${money(total - budget)} over` : `${money(budget - total)} under`} budget</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <Notice title="Budget comparisons are part of TripCraft Pro" action={<LinkButton href="/profile/billing" size="sm" variant="outline"><Lock className="h-3.5 w-3.5" />See plans</LinkButton>}>Compare your total across every stay option side by side.</Notice>
          )}
        </section>
      )}

      <Modal open={editBudget} onClose={() => setEditBudget(false)} title="Edit trip budget">
        <form action={(f) => run(() => updateTrip(tripId, { budget: Number(f.get("budget")) }), { success: "Budget updated", onDone: () => setEditBudget(false) })} className="grid gap-4">
          <Field label="Total budget for the whole group (USD)"><Input name="budget" type="number" min={50} step={50} defaultValue={budget} required /></Field>
          <p className="text-sm text-ink-soft">After saving you can regenerate the itinerary around the new budget.</p>
          <Button type="submit" disabled={pending}>Save budget</Button>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add expense" : "Edit expense"}>
        {editing && <ExpenseForm tripId={tripId} expense={editing === "new" ? null : editing} members={members} me={me} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

export function ExpenseForm({ tripId, expense, members, me, onDone, forceShared }: { tripId: string; expense: Expense | null; members: Member[]; me: string; onDone: () => void; forceShared?: boolean }) {
  const { run, pending } = useAction();
  const [shared, setShared] = useState(forceShared || !!expense?.is_shared);
  return (
    <form
      className="grid gap-4"
      action={(f) =>
        run(() => saveExpense({ id: expense?.id, tripId, category: String(f.get("category")) as never, description: String(f.get("description")), amount: Number(f.get("amount")), status: String(f.get("status")) as never, incurredOn: String(f.get("date") || "") || null, shared, paidBy: shared ? String(f.get("paidBy")) : null, splitWith: shared ? f.getAll("split").map(String) : [] }), { success: expense ? "Expense updated" : "Expense added", onDone })
      }
    >
      <Field label="Description"><Input name="description" required maxLength={300} defaultValue={expense?.description} placeholder="Airport transfer" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (USD)"><Input name="amount" type="number" min={0} step="0.01" required defaultValue={expense?.amount} /></Field>
        <Field label="Category"><Select name="category" defaultValue={expense?.category ?? "misc"}>{EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
        <Field label="Status"><Select name="status" defaultValue={expense?.status ?? (forceShared ? "paid" : "estimated")}><option value="estimated">Estimated</option><option value="booked">Booked</option><option value="paid">Paid</option></Select></Field>
        <Field label="Date (optional)"><Input name="date" type="date" defaultValue={expense?.incurred_on ?? ""} /></Field>
      </div>
      {members.length > 1 && (
        <div className="rounded-xl bg-muted p-3">
          <label className="flex items-center gap-2.5 text-sm font-medium"><input type="checkbox" checked={shared} disabled={forceShared} onChange={(e) => setShared(e.target.checked)} className="h-4 w-4 accent-(--accent)" />Shared expense, split equally</label>
          {shared && (
            <div className="mt-3 grid gap-3">
              <Field label="Paid by"><Select name="paidBy" defaultValue={expense?.paid_by ?? me}>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.user_id === me ? "You" : m.full_name || m.email}</option>)}</Select></Field>
              <fieldset><legend className="mb-1.5 text-[0.8rem] font-medium text-ink-soft">Split between</legend><div className="flex flex-wrap gap-x-4 gap-y-1.5">{members.map((m) => <label key={m.user_id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="split" value={m.user_id} defaultChecked className="h-4 w-4 accent-(--accent)" />{m.user_id === me ? "You" : m.full_name || m.email.split("@")[0]}</label>)}</div></fieldset>
            </div>
          )}
        </div>
      )}
      <Button type="submit" disabled={pending}>{pending && <Spinner />}{expense ? "Save changes" : "Add expense"}</Button>
    </form>
  );
}
