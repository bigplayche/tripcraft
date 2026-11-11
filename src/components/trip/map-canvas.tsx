"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "@/lib/types";

export const KIND_COLOR: Record<MapPoint["kind"], string> = { hotel: "#1d1b18", restaurant: "#a8700f", activity: "#b4532c", nightlife: "#6b4ea0", shopping: "#2c7a8c", transport: "#5d6470", saved: "#2e7758" };
export const KIND_LABEL: Record<MapPoint["kind"], string> = { hotel: "Stay", restaurant: "Food", activity: "Activity", nightlife: "Nightlife", shopping: "Shopping", transport: "Transport", saved: "Saved" };
const GLYPH: Record<MapPoint["kind"], string> = { hotel: "H", restaurant: "F", activity: "A", nightlife: "N", shopping: "S", transport: "T", saved: "★" };

type Props = { points: MapPoint[]; selectedId: string | null; onSelect: (id: string) => void; path: [number, number][] | null; fallbackCenter: [number, number] | null; className?: string };
const pinHtml = (p: MapPoint, active: boolean) => `<div class="tc-pin${active ? " is-active" : ""}" style="background:${KIND_COLOR[p.kind]}"><span>${p.order ?? GLYPH[p.kind]}</span></div>`;

/**
 * Renders with Google Maps when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set, otherwise with
 * Leaflet + OpenStreetMap tiles (no key needed). Same props either way.
 */
export function MapCanvas(props: Props) {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? <GoogleCanvas {...props} /> : <LeafletCanvas {...props} />;
}

function LeafletCanvas({ points, selectedId, onSelect, path, fallbackCenter, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = useRef<{ L: any; map: any; layer: any; fitted: string }>(null);
  const select = useRef(onSelect);
  const drawRef = useRef<() => void>(() => {});
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !el.current || state.current) return;
      const map = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(fallbackCenter ?? [20, 0], fallbackCenter ? 12 : 2);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
      state.current = { L, map, layer: L.layerGroup().addTo(map), fitted: "" };
      drawRef.current();
    })();
    return () => {
      dead = true;
      state.current?.map.remove();
      state.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = () => {
    const s = state.current;
    if (!s) return;
    s.layer.clearLayers();
    if (path?.length) s.L.polyline(path, { color: "#b4532c", weight: 4, opacity: 0.85 }).addTo(s.layer);
    else {
      // Without a provider route we only connect stops in visiting order; this is not the road route.
      const ordered = points.filter((p) => p.order != null).sort((a, b) => a.order! - b.order!);
      if (ordered.length > 1) s.L.polyline(ordered.map((p) => [p.lat, p.lng]), { color: "#b4532c", weight: 2, opacity: 0.6, dashArray: "4 8" }).addTo(s.layer);
    }
    for (const p of points) {
      const m = s.L.marker([p.lat, p.lng], { icon: s.L.divIcon({ html: pinHtml(p, p.id === selectedId), className: "", iconSize: [30, 30], iconAnchor: [15, 30] }), title: p.name, keyboard: true, zIndexOffset: p.id === selectedId ? 1000 : 0 });
      m.on("click", () => select.current(p.id));
      m.addTo(s.layer);
    }
    const key = points.map((p) => p.id).join(",");
    if (points.length && s.fitted !== key) {
      s.map.fitBounds(s.L.latLngBounds(points.map((p) => [p.lat, p.lng])).pad(0.2), { maxZoom: 15 });
      s.fitted = key;
    }
  };
  useEffect(() => {
    drawRef.current = draw;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, selectedId, path]);
  useEffect(() => {
    const p = points.find((x) => x.id === selectedId);
    if (p && state.current) state.current.map.panTo([p.lat, p.lng]);
  }, [selectedId, points]);

  return <div ref={el} className={className} role="application" aria-label="Trip map" />;
}

function GoogleCanvas({ points, selectedId, onSelect, path, fallbackCenter, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = useRef<{ g: any; map: any; overlays: any[]; fitted: string }>(null);
  const select = useRef(onSelect);
  const drawRef = useRef<() => void>(() => {});
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let dead = false;
    (async () => {
      const { setOptions, importLibrary } = await import("@googlemaps/js-api-loader");
      setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!, v: "weekly" });
      const [{ Map }] = await Promise.all([importLibrary("maps"), importLibrary("marker")]);
      if (dead || !el.current || state.current) return;
      const c = fallbackCenter ?? [20, 0];
      const map = new Map(el.current, { center: { lat: c[0], lng: c[1] }, zoom: fallbackCenter ? 12 : 2, mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID", disableDefaultUI: true, zoomControl: true, clickableIcons: false });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state.current = { g: (window as any).google.maps, map, overlays: [], fitted: "" };
      drawRef.current();
    })();
    return () => {
      dead = true;
      state.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = () => {
    const s = state.current;
    if (!s) return;
    s.overlays.forEach((o) => (o.setMap ? o.setMap(null) : (o.map = null)));
    s.overlays = [];
    const ordered = points.filter((p) => p.order != null).sort((a, b) => a.order! - b.order!);
    const line = path?.length ? path.map(([lat, lng]) => ({ lat, lng })) : ordered.length > 1 ? ordered.map((p) => ({ lat: p.lat, lng: p.lng })) : null;
    if (line) s.overlays.push(new s.g.Polyline({ map: s.map, path: line, strokeColor: "#b4532c", strokeWeight: path?.length ? 4 : 2, strokeOpacity: path?.length ? 0.85 : 0.5 }));
    for (const p of points) {
      const content = document.createElement("div");
      content.innerHTML = pinHtml(p, p.id === selectedId);
      const m = new s.g.marker.AdvancedMarkerElement({ map: s.map, position: { lat: p.lat, lng: p.lng }, title: p.name, content, zIndex: p.id === selectedId ? 1000 : 1 });
      m.addListener("click", () => select.current(p.id));
      s.overlays.push(m);
    }
    const key = points.map((p) => p.id).join(",");
    if (points.length && s.fitted !== key) {
      const b = new s.g.LatLngBounds();
      points.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }));
      s.map.fitBounds(b, 60);
      s.fitted = key;
    }
  };
  useEffect(() => {
    drawRef.current = draw;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, selectedId, path]);
  return <div ref={el} className={className} role="application" aria-label="Trip map" />;
}
