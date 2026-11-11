import { LinkButton, Logo } from "@/components/ui";
export default function NotFound() {
  return (
    <div className="grid min-h-[70dvh] place-items-center px-4 text-center">
      <div>
        <Logo className="mb-8" />
        <h1 className="display text-4xl">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-ink-soft">It may have been removed, or you may not have access to it.</p>
        <LinkButton href="/home" className="mt-6">Back to TripCraft</LinkButton>
      </div>
    </div>
  );
}
