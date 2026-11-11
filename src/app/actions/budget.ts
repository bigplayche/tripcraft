"use server";
import { z } from "zod";
import { act, changed, no, ok } from "@/lib/action";
import { withUser } from "@/lib/db";
import { loadMembers } from "@/lib/data";

const Expense = z.object({
  tripId: z.string().uuid(),
  category: z.enum(["flights", "hotel", "food", "transportation", "activities", "shopping", "nightlife", "misc", "emergency"]),
  description: z.string().trim().min(1).max(300),
  amount: z.number().min(0).max(10_000_000),
  status: z.enum(["estimated", "booked", "paid"]),
  incurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  shared: z.boolean().optional(),
  paidBy: z.string().uuid().nullable().optional(),
  splitWith: z.array(z.string().uuid()).max(30).optional(),
});

export async function saveExpense(input: z.input<typeof Expense> & { id?: string }) {
  return act((u) =>
    withUser(u.id, async (q) => {
      const e = Expense.parse(input);
      const members = await loadMembers(q, e.tripId);
      const ids = new Set(members.map((m) => m.user_id));
      if (e.paidBy && !ids.has(e.paidBy)) return no("The payer must be a member of this trip.");
      let id = input.id;
      if (id) {
        const rows = await q("update trip_expenses set category=$2, description=$3, amount=$4, status=$5, incurred_on=$6, is_shared=$7, paid_by=$8 where id=$1 and trip_id=$9 returning id", [id, e.category, e.description, e.amount, e.status, e.incurredOn ?? null, !!e.shared, e.paidBy ?? null, e.tripId]);
        if (!rows.length) return no("You don't have permission to edit expenses on this trip.");
      } else {
        const [row] = await q<{ id: string }>("insert into trip_expenses (trip_id, created_by, paid_by, category, description, amount, status, is_shared, incurred_on) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id", [e.tripId, u.id, e.paidBy ?? null, e.category, e.description, e.amount, e.status, !!e.shared, e.incurredOn ?? null]);
        id = row.id;
      }
      // Equal split across the chosen members; the payer's own share is settled by definition.
      await q("delete from expense_splits where expense_id = $1", [id]);
      const among = e.shared ? (e.splitWith?.length ? e.splitWith : [...ids]).filter((x) => ids.has(x)) : [];
      if (among.length) {
        const cents = Math.round(e.amount * 100), base = Math.floor(cents / among.length);
        for (let i = 0; i < among.length; i++) {
          const share = (base + (i < cents - base * among.length ? 1 : 0)) / 100;
          await q("insert into expense_splits (expense_id, trip_id, user_id, amount, settled, settled_at) values ($1,$2,$3,$4,$5,case when $5 then now() end)", [id, e.tripId, among[i], share, among[i] === e.paidBy]);
        }
      }
      return ok();
    }),
  );
}

export async function deleteExpense(id: string) {
  return act(async (u) => changed(await withUser(u.id, (q) => q("delete from trip_expenses where id = $1 returning id", [id]))));
}
export async function setExpenseStatus(id: string, status: "estimated" | "booked" | "paid") {
  return act(async (u) => changed(await withUser(u.id, (q) => q("update trip_expenses set status = $2 where id = $1 returning id", [id, z.enum(["estimated", "booked", "paid"]).parse(status)]))));
}
export async function settleSplit(id: string, settled: boolean) {
  return act(async (u) => changed(await withUser(u.id, (q) => q("update expense_splits set settled = $2, settled_at = case when $2 then now() end where id = $1 returning id", [id, settled]))));
}
