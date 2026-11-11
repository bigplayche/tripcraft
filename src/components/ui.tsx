import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";
const btnVariants = {
  primary: "bg-accent text-on-accent hover:bg-accent-strong shadow-card",
  dark: "bg-ink text-bg hover:opacity-90",
  outline: "border border-line bg-surface text-ink hover:border-ink-faint hover:bg-muted",
  ghost: "text-ink-soft hover:bg-muted hover:text-ink",
  danger: "text-danger hover:bg-danger-soft",
};
const btnSizes = { sm: "h-9 px-3.5 text-sm", md: "h-11 px-5 text-[0.95rem]", lg: "h-13 px-7 text-base", icon: "h-9 w-9" };

type BtnStyle = { variant?: keyof typeof btnVariants; size?: keyof typeof btnSizes };
export const buttonClass = ({ variant = "primary", size = "md" }: BtnStyle = {}, className?: string) => cn(btnBase, btnVariants[variant], btnSizes[size], className);

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & BtnStyle) {
  return <button {...props} className={buttonClass({ variant, size }, className)} />;
}
export function LinkButton({ variant, size, className, ...props }: ComponentProps<typeof Link> & BtnStyle) {
  return <Link {...props} className={buttonClass({ variant, size }, className)} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("card", className)} />;
}

const badgeTones = {
  neutral: "bg-muted text-ink-soft",
  accent: "bg-accent-soft text-accent-strong",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  outline: "border border-line text-ink-soft",
};
export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: keyof typeof badgeTones }) {
  return <span {...props} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", badgeTones[tone], className)} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[0.8rem] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn("field", className)} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cn("field appearance-none bg-[length:1rem] bg-[right_0.7rem_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn("field min-h-24 resize-y", className)} />;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="display text-3xl sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="display text-xl sm:text-2xl">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-ink-soft">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[1.25rem] border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted text-ink-soft">{icon}</div>}
      <h3 className="font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Honest labelling of where a piece of information came from. */
export function SourceNote({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs leading-relaxed text-ink-faint", className)}>{children}</p>;
}

export function Notice({ tone = "neutral", title, children, action }: { tone?: "neutral" | "warn" | "accent"; title?: string; children?: ReactNode; action?: ReactNode }) {
  const tones = { neutral: "bg-muted", warn: "bg-warn-soft", accent: "bg-accent-soft" };
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm", tones[tone])}>
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-ink-soft">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--accent)" />
        <path d="M8 21.5 24 9l-5.2 15.2-3.4-5.3L8 21.5Z" fill="var(--on-accent)" />
      </svg>
      <span className="text-[1.05rem]">TripCraft</span>
    </span>
  );
}
