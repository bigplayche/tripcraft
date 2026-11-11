"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Destination photo with a generated poster-style fallback, so cards never show a broken image
 * when a photo is missing (e.g. AI-suggested destinations outside the catalogue).
 */
export function DestinationImage({ src, name, art, className, priority }: { src?: string | null; name: string; art: [string, string]; className?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // The error event can fire before hydration, so also check the already-settled image.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth === 0) setFailed(true);
  }, [src]);
  const id = name.replace(/\W/g, "");
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={art[0]} />
            <stop offset="1" stopColor={art[1]} />
          </linearGradient>
        </defs>
        <rect width="400" height="300" fill={`url(#g${id})`} />
        <circle cx="290" cy="95" r="38" fill="#fff" opacity="0.35" />
        <path d="M0 210 Q70 150 140 200 T280 180 T400 205 V300 H0Z" fill={art[1]} opacity="0.55" />
        <path d="M0 245 Q90 200 180 240 T400 232 V300 H0Z" fill="#000" opacity="0.22" />
      </svg>
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={img} src={src} alt="" loading={priority ? "eager" : "lazy"} onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
      )}
    </div>
  );
}
