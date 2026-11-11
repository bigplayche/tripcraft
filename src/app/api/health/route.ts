import { asService } from "@/lib/db";
import { integrations, isDemoMode } from "@/lib/env";

/** Liveness + which integrations are configured (booleans only, never values). */
export async function GET() {
  try {
    await asService((q) => q("select 1"));
    return Response.json({ ok: true, demoMode: isDemoMode(), integrations: integrations() });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
