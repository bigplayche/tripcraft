"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div>
        <h1 className="display text-3xl">Something went wrong</h1>
        <p className="mt-2 text-ink-soft">Your trip data is safe. Please try again.{error.digest && <span className="block text-xs text-ink-faint">Reference: {error.digest}</span>}</p>
        <Button onClick={reset} className="mt-6">Try again</Button>
      </div>
    </div>
  );
}
