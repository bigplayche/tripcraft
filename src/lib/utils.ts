import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export function money(n: number | null | undefined, currency = "USD", digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

const parse = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`);

export function fmtDate(d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(parse(d));
}

export function dateRange(a: string, b: string) {
  return `${fmtDate(a)} – ${fmtDate(b, { month: "short", day: "numeric", year: "numeric" })}`;
}

export const nightsBetween = (a: string, b: string) => Math.max(0, Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000));
export const tripDays = (a: string, b: string) => nightsBetween(a, b) + 1;

export function addDays(d: string, n: number) {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function timeAgo(d: string | Date) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string; code?: "upgrade_required" | "rate_limited" | "validation" };
