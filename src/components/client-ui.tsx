"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Moon, Sun, X, Sparkles } from "lucide-react";
import { Button, buttonClass } from "./ui";
import { cn, type ActionResult } from "@/lib/utils";

/* ---------- toasts ---------- */
type Toast = { id: number; message: string; tone: "ok" | "error" | "upgrade" };
const ToastCtx = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const box = useRef<HTMLDivElement>(null);
  // Toasts live in the browser top layer (popover) and are re-shown on every push so they
  // always sit above an open modal dialog instead of hiding behind its backdrop.
  useEffect(() => {
    const el = box.current;
    if (!el?.showPopover) return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      if (toasts.length) el.showPopover();
    } catch {}
  }, [toasts]);
  const push = useCallback((message: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "upgrade" ? 9000 : 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div ref={box} popover="manual" className="pointer-events-none fixed inset-x-0 bottom-24 top-auto z-[100] m-0 flex w-full max-w-none flex-col items-center gap-2 border-0 bg-transparent p-0 px-4 lg:bottom-8" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cn("pointer-events-auto flex max-w-md animate-rise items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-pop", t.tone === "ok" ? "bg-ink text-bg" : t.tone === "error" ? "bg-danger text-white" : "border border-line bg-surface text-ink")}>
            {t.tone === "upgrade" && <Sparkles className="h-4 w-4 shrink-0 text-accent" />}
            <span>{t.message}</span>
            {t.tone === "upgrade" && (
              <Link href="/profile/billing" className="shrink-0 font-semibold text-accent underline-offset-2 hover:underline">
                See plans
              </Link>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- server action runner ---------- */
export function useAction() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; onDone?: (data: T | undefined) => void; refresh?: boolean } = {}) =>
      start(async () => {
        try {
          const r = await fn();
          if (!r.ok) return toast(r.error, r.code === "upgrade_required" ? "upgrade" : "error");
          if (opts.success) toast(opts.success);
          if (opts.refresh !== false) router.refresh();
          opts.onDone?.(r.data);
        } catch (e) {
          // redirect() from a server action surfaces as a thrown navigation signal: let it through.
          if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
          toast("Something went wrong. Please try again.", "error");
        }
      }),
    [router, toast],
  );
  return { run, pending };
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function SubmitButton({ children, className, variant, size, pendingText }: { children: ReactNode; className?: string; variant?: "primary" | "dark" | "outline"; size?: "sm" | "md" | "lg"; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass({ variant, size }, className)}>
      {pending && <Spinner />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/* ---------- modal (native <dialog>: focus trap + Esc for free) ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn("m-auto w-[calc(100%-1.5rem)] rounded-3xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-black/40 backdrop:backdrop-blur-sm open:animate-rise max-sm:mb-3", wide ? "max-w-2xl" : "max-w-lg")}
    >
      {open && (
        <div className="p-5 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="display text-2xl">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/* ---------- theme ---------- */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    // The theme is set by an inline script before hydration; sync once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);
  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("tc-theme", next);
    } catch {}
    setDark(!dark);
  };
  return (
    <button onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} className={buttonClass({ variant: "ghost", size: "icon" }, className)}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

/* ---------- chip multi-select used in onboarding / profile ---------- */
export function ChipSelect({ name, options, defaultValue = [], single }: { name: string; options: readonly string[]; defaultValue?: string[]; single?: boolean }) {
  const [sel, setSel] = useState<string[]>(defaultValue);
  const toggle = (o: string) => setSel((s) => (single ? [o] : s.includes(o) ? s.filter((x) => x !== o) : [...s, o]));
  return (
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name={name} value={JSON.stringify(sel)} />
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={sel.includes(o)} onClick={() => toggle(o)} className={cn("rounded-full border px-3.5 py-1.5 text-sm transition-colors", sel.includes(o) ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-soft hover:border-ink-faint")}>
          {o}
        </button>
      ))}
    </div>
  );
}
