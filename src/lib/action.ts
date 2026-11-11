import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { fail } from "@/lib/planner";
import type { ActionResult } from "@/lib/utils";

/** Wraps a server action: requires a session, converts thrown errors (incl. RLS denials) into results. */
export async function act<T = unknown>(fn: (user: SessionUser) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Your session has expired. Please sign in again." };
  try {
    return await fn(user);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/row-level security|permission denied|forbidden/i.test(msg)) return { ok: false, error: "You don't have permission to do that on this trip." };
    if (e && typeof e === "object" && "issues" in e) return { ok: false, error: "Please check the form and try again.", code: "validation" };
    return fail(e);
  }
}
export const ok = <T,>(data?: T): ActionResult<T> => ({ ok: true, data });
export const no = (error: string): ActionResult<never> => ({ ok: false, error });
/** For updates/deletes where RLS silently filters rows instead of raising. */
export const changed = (rows: unknown[]): ActionResult<never> | { ok: true } => (rows.length ? { ok: true } : no("You don't have permission to do that on this trip."));
