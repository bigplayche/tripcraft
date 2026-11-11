/**
 * Private document storage. Files are never given public URLs: downloads go through
 * /api/documents/[id], which re-checks trip membership (RLS) on every request.
 *  - Supabase configured: private bucket `trip-documents`, accessed with the user's own session
 *    so storage RLS applies as a second layer.
 *  - Demo mode: ./.data/uploads on the local disk.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { isDemoMode } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";

const BUCKET = "trip-documents";
const localPath = (p: string) => {
  const root = path.join(process.cwd(), ".data", "uploads");
  const full = path.join(root, p);
  if (!full.startsWith(root + path.sep)) throw new Error("invalid path");
  return full;
};

export async function putFile(p: string, data: Buffer, mime: string) {
  if (isDemoMode()) {
    await fs.mkdir(path.dirname(localPath(p)), { recursive: true });
    await fs.writeFile(localPath(p), data, { mode: 0o600 });
    return;
  }
  const { error } = await (await supabaseServer()).storage.from(BUCKET).upload(p, data, { contentType: mime, upsert: false });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
}

export async function getFile(p: string): Promise<Buffer | null> {
  if (isDemoMode()) return fs.readFile(localPath(p)).catch(() => null);
  const { data, error } = await (await supabaseServer()).storage.from(BUCKET).download(p);
  return error || !data ? null : Buffer.from(await data.arrayBuffer());
}

export async function removeFile(p: string) {
  if (isDemoMode()) return void (await fs.rm(localPath(p), { force: true }));
  await (await supabaseServer()).storage.from(BUCKET).remove([p]);
}
