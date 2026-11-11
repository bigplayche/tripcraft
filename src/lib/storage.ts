/**
 * Private document storage. Files are never given public URLs: downloads go through
 * /api/documents/[id], which re-checks trip membership (RLS) on every request.
 *  - Supabase configured: private bucket `trip-documents`, accessed with the user's own session
 *    so storage RLS applies as a second layer.
 *  - Otherwise (demo mode, or self-hosting on plain Postgres such as Neon): the bytes live in the
 *    server-only table tripcraft_meta.files, which no signed-in role can read directly.
 */
import { asService } from "@/lib/db";
import { usesBuiltInAuth } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";

const BUCKET = "trip-documents";

export async function putFile(p: string, data: Buffer, mime: string) {
  if (usesBuiltInAuth()) {
    await asService((q) => q("insert into tripcraft_meta.files (path, mime_type, data) values ($1,$2,$3)", [p, mime, data]));
    return;
  }
  const { error } = await (await supabaseServer()).storage.from(BUCKET).upload(p, data, { contentType: mime, upsert: false });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
}

export async function getFile(p: string): Promise<Buffer | null> {
  if (usesBuiltInAuth()) {
    const [row] = await asService((q) => q<{ data: Uint8Array }>("select data from tripcraft_meta.files where path = $1", [p]));
    return row ? Buffer.from(row.data) : null;
  }
  const { data, error } = await (await supabaseServer()).storage.from(BUCKET).download(p);
  return error || !data ? null : Buffer.from(await data.arrayBuffer());
}

export async function removeFile(p: string) {
  if (usesBuiltInAuth()) return void (await asService((q) => q("delete from tripcraft_meta.files where path = $1", [p])));
  await (await supabaseServer()).storage.from(BUCKET).remove([p]);
}
