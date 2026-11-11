import { getSessionUser } from "@/lib/auth/session";
import { isUuid, withUser } from "@/lib/db";
import { getFile } from "@/lib/storage";

/** Private document download. Membership is re-checked by RLS on every request; nothing is ever public. */
export async function GET(_: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const [doc] = await withUser(user.id, (q) => q<{ name: string; mime_type: string; storage_path: string }>("select name, mime_type, storage_path from uploaded_documents where id = $1", [id]));
  const data = doc ? await getFile(doc.storage_path) : null;
  if (!doc || !data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mime_type,
      "Content-Disposition": `inline; filename="${doc.name.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
