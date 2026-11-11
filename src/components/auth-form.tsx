"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { signIn, signUp, type AuthState } from "@/app/actions/auth";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Field, Input, buttonClass } from "./ui";
import { SubmitButton } from "./client-ui";

export function AuthForm({ mode, next, oauth }: { mode: "login" | "signup"; next: string; oauth: boolean }) {
  const [state, action] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, null);
  const [oauthError, setOauthError] = useState("");
  const social = async (provider: "google" | "apple") => {
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    if (error) setOauthError(error.message);
  };
  return (
    <div className="w-full max-w-sm">
      <h1 className="display text-3xl">{mode === "login" ? "Welcome back" : "Start planning"}</h1>
      <p className="mt-2 text-ink-soft">{mode === "login" ? "Sign in to pick up where you left off." : "Create a free account. No card required."}</p>

      {/* Google and Apple sign-in are provided by Supabase Auth; hidden when it isn't configured. */}
      {oauth ? (
        <>
          <div className="mt-7 grid gap-2">
            {(["google", "apple"] as const).map((p) => (
              <button key={p} type="button" onClick={() => social(p)} className={buttonClass({ variant: "outline" }, "w-full capitalize")}>
                Continue with {p}
              </button>
            ))}
            {oauthError && <p className="text-center text-xs text-danger">{oauthError}</p>}
          </div>
          <div className="my-6 flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-line" />
            or with email
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : (
        <div className="mt-7" />
      )}

      <form action={action} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <Field label="Your name">
            <Input name="name" autoComplete="name" placeholder="Alex Morgan" defaultValue={state?.name} />
          </Field>
        )}
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" placeholder="you@example.com" defaultValue={state?.email} />
        </Field>
        <Field label="Password" hint={mode === "signup" ? "At least 8 characters" : undefined}>
          <Input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </Field>
        {state?.error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
        {state?.notice && <p role="status" className="rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">{state.notice}</p>}
        <SubmitButton className="mt-1 w-full">{mode === "login" ? "Sign in" : "Create account"}</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        {mode === "login" ? "New to TripCraft? " : "Already have an account? "}
        <Link href={`${mode === "login" ? "/signup" : "/login"}?next=${encodeURIComponent(next)}`} className="font-semibold text-accent hover:underline">
          {mode === "login" ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}
