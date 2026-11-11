"use client";
import { removeSavedPlace } from "@/app/actions/trips";
import { useAction } from "./client-ui";
import { Button } from "./ui";

export function RemoveSaved({ id, children }: { id: string; children: React.ReactNode }) {
  const { run, pending } = useAction();
  return <Button variant="ghost" size="icon" aria-label="Remove saved place" disabled={pending} onClick={() => run(() => removeSavedPlace(id), { success: "Removed" })}>{children}</Button>;
}
