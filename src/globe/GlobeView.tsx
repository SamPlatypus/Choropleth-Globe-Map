import { useEffect, useMemo, useRef, useState } from "react";
import { countryByA3 } from "./metrics";
import { countryAt } from "./paint";
import { CX, CY, lonLatAt, projectGlobe, radiusFor, VB, wrap180, type LandPath } from "./sphere";
import type { MetricId } from "./types";

type Api = {
  zoom: (factor: number) => void;
};

type Props = {
  metric: MetricId;
  selectedA3: string | null;
  focusNonce: number;
  onSelect: (a3: string | null) => void;
  apiRef: { current: Api | null };
};

type View = { lambda: number; phi: number; zoom: number };

const START: View = { lambda: 12, phi: 18, zoom: 1 };

const STARS: { cx: number; cy: number; r: number; o: number }[] = [
  { cx: 160.03, cy: 22.2, r: 0.42, o: 0.38 },
  { cx: 25.68, cy: 96.78, r: 0.42, o: 0.56 },
  { cx: 156.42, cy: 152.63, r: 0.42, o: 0.35 },
  { cx: 124.38, cy: 144.87, r: 0.42, o: 0.53 },
  { cx: 152.36, cy: 106.52, r: 0.42, o: 0.49 },
  { cx: 111.73, cy: 167.03, r: 0.42, o: 0.7 },
  { cx: 190.61, cy: 125.23, r: 0.42, o: 0.86 },
  { cx: 178.56, cy: 143.54, r: 0.42, o: 0.32 },
  { cx: 160.59, cy: 118.45, r: 0.42, o: 0.74 },
  { cx: 184.37, cy: 154.97, r: 0.42, o: 0.79 },
  { cx: 146.94, cy: 21.03, r: 0.42, o: 0.5 },
  { cx: 128.11, cy: 165.78, r: 0.42, o: 0.84 },
  { cx: 44.67, cy: 92.72, r: 0.85, o: 0.68 },
  { cx: 181.93, cy: 151.19, r: 0.85, o: 0.43 },
  { cx: 28.68, cy: 44.48, r: 0.42, o: 0.83 },
  { cx: 162.11, cy: 7.76, r: 0.42, o: 0.77 },
  { cx: 38.58, cy: 123, r: 0.42, o: 0.72 },
  { cx: 18.65, cy: 15.91, r: 0.42, o: 0.83 },
  { cx: 183.7, cy: 105.52, r: 0.42, o: 0.54 },
  { cx: 43.43, cy: 186.84, r: 0.42, o: 0.53 },
  { cx: 142.9, cy: 93.78, r: 0.85, o: 0.6 },
  { cx: 26.09, cy: 163.85, r: 0.42, o: 0.42 },
  { cx: 79.98, cy: 73.01, r: 0.85, o: 0.35 },
  { cx: 165.96, cy: 136.89, r: 0.85, o: 0.51 },
  { cx: 48.81, cy: 85.48, r: 0.42, o: 0.31 },
  { cx: 106.16, cy: 68.48, r: 0.85, o: 0.32 },
  { cx: 115.71, cy: 25.39, r: 0.85, o: 0.44 },
  { cx: 98.09, cy: 159.81, r: 0.42, o: 0.72 },
  { cx: 16.17, cy: 78.96, r: 0.42, o: 0.54 },
  { cx: 16.71, cy: 67.56, r: 0.42, o: 0.65 },
  { cx: 60.68, cy: 81.13, r: 0.42, o: 0.7 },
  { cx: 125.11, cy: 180.61, r: 0.85, o: 0.56 },
  { cx: 13.5, cy: 110.14, r: 0.42, o: 0.78 },
  { cx: 73.68, cy: 117.67, r: 0.42, o: 0.8 },
  { cx: 146.03, cy: 99.63, r: 0.42, o: 0.44 },
  { cx: 13.21, cy: 120.08, r: 0.42, o: 0.54 },
  { cx: 191.82, cy: 50.98, r: 0.42, o: 0.66 },
  { cx: 15.65, cy: 23.19, r: 0.42, o: 0.7 },
  { cx: 63.66, cy: 66, r: 0.85, o: 0.35 },
  { cx: 172.45, cy: 101.57, r: 0.42, o: 0.74 },
  { cx: 30.36, cy: 72.29, r: 0.42, o: 0.34 },
  { cx: 111.95, cy: 116.41, r: 0.42, o: 0.76 },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function GlobeView({ metric, selectedA3, focusNonce, onSelect, apiRef }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const propsRef = useRef({ metric, selectedA3, onSelect });
  propsRef.current = { metric, selectedA3, onSelect };
  const viewRef = useRef<View>({ ...START });
  const easeRef = useRef<{ lambda: number; phi: number } | null>(null);
  const [view, setView] = useState<View>(START);

  const frame = useMemo(
    () => projectGlobe(view.lambda, view.phi, view.zoom, metric, selectedA3),
    [view.lambda, view.phi, view.zoom, metric, selectedA3],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let auto = !reduce;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let movedPx = 0;
    let pinch: number | null = null;
    let resumeTimer = 0;
    let lastPublish = 0;
    const pointers = new Map<number, { x: number; y: number }>();

    const publish = (force = false) => {
      const now = performance.now();
      if (!force && now - lastPublish < 42) return;
      lastPublish = now;
      const next = viewRef.current;
      setView((prev) =>
        prev.lambda === next.lambda && prev.phi === next.phi && prev.zoom === next.zoom ? prev : { ...next },
      );
    };

    apiRef.current = {
      zoom(factor) {
        viewRef.current.zoom = clamp(viewRef.current.zoom / factor, 0.78, 1.45);
        publish(true);
      },
    };

    let raf = 0;
    let last = performance.now();
    const frameLoop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const current = viewRef.current;
      const ease = easeRef.current;
      if (ease) {
        const dLambda = wrap180(ease.lambda - current.lambda);
        const dPhi = ease.phi - current.phi;
        current.lambda = wrap180(current.lambda + dLambda * Math.min(1, dt * 4.2));
        current.phi += dPhi * Math.min(1, dt * 4.2);
        if (Math.abs(dLambda) < 0.2 && Math.abs(dPhi) < 0.2) {
          current.lambda = ease.lambda;
          current.phi = ease.phi;
          easeRef.current = null;
        }
        publish();
      } else if (auto && !dragging) {
        current.lambda = wrap180(current.lambda + dt * 14);
        publish();
      }
      raf = requestAnimationFrame(frameLoop);
    };

    const toView = (event: PointerEvent) => {
      const rect = svg.getBoundingClientRect();
      const side = Math.min(rect.width, rect.height) || 1;
      const scale = side / VB;
      const ox = rect.left + (rect.width - side) / 2;
      const oy = rect.top + (rect.height - side) / 2;
      return { x: (event.clientX - ox) / scale, y: (event.clientY - oy) / scale };
    };

    const onPointerDown = (event: PointerEvent) => {
      svg.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      dragging = true;
      easeRef.current = null;
      auto = false;
      lastX = event.clientX;
      lastY = event.clientY;
      movedPx = 0;
      window.clearTimeout(resumeTimer);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        const pts = [...pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinch != null && pinch > 0) {
          viewRef.current.zoom = clamp(viewRef.current.zoom * (dist / pinch), 0.78, 1.45);
          publish();
        }
        pinch = dist;
        return;
      }
      pinch = null;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      movedPx += Math.abs(dx) + Math.abs(dy);
      const rect = svg.getBoundingClientRect();
      const side = Math.min(rect.width, rect.height) || 1;
      const scale = side / VB;
      const radius = radiusFor(viewRef.current.zoom);
      const turn = (180 / Math.PI / radius) / scale;
      viewRef.current.lambda = wrap180(viewRef.current.lambda - dx * turn);
      viewRef.current.phi = clamp(viewRef.current.phi + dy * turn, -66, 66);
      publish();
    };

    const pick = (event: PointerEvent) => {
      const point = toView(event);
      const current = viewRef.current;
      const hit = lonLatAt(current.lambda, current.phi, current.zoom, point.x, point.y);
      if (!hit) {
        propsRef.current.onSelect(null);
        return;
      }
      const country = countryAt(hit.lon, hit.lat);
      propsRef.current.onSelect(country ? country.a3 : null);
    };

    const onPointerUp = (event: PointerEvent) => {
      const wasDrag = movedPx > 8;
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        dragging = false;
        if (!wasDrag) pick(event);
        resumeTimer = window.setTimeout(() => {
          if (!dragging && !reduce) auto = true;
        }, 2600);
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      viewRef.current.zoom = clamp(viewRef.current.zoom * Math.exp(-event.deltaY * 0.0011), 0.78, 1.45);
      publish(true);
    };

    svg.addEventListener("pointerdown", onPointerDown);
    svg.addEventListener("pointermove", onPointerMove);
    svg.addEventListener("pointerup", onPointerUp);
    svg.addEventListener("pointercancel", onPointerUp);
    svg.addEventListener("wheel", onWheel, { passive: false });
    raf = requestAnimationFrame(frameLoop);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resumeTimer);
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("pointermove", onPointerMove);
      svg.removeEventListener("pointerup", onPointerUp);
      svg.removeEventListener("pointercancel", onPointerUp);
      svg.removeEventListener("wheel", onWheel);
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!focusNonce) return;
    const country = countryByA3(propsRef.current.selectedA3);
    if (!country) return;
    easeRef.current = { lambda: country.lon, phi: clamp(country.lat, -62, 62) };
  }, [focusNonce]);

  return (
    <svg
      ref={svgRef}
      className="globe-svg"
      viewBox={`0 0 ${VB} ${VB}`}
      role="img"
      aria-label="3D choropleth globe"
    >
      <defs>
        <radialGradient id="ocean-grad" cx="36%" cy="34%" r="68%">
          <stop offset="0%" stopColor="#2f8494" />
          <stop offset="48%" stopColor="#1a5c6c" />
          <stop offset="100%" stopColor="#0c3340" />
        </radialGradient>
        <radialGradient id="limb-grad" cx="40%" cy="36%" r="62%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="46%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#021016" stopOpacity="0.72" />
        </radialGradient>
      </defs>
      {STARS.map((star) => (
        <circle key={`${star.cx}-${star.cy}`} cx={star.cx} cy={star.cy} r={star.r} fill="#d5e4ea" opacity={star.o} />
      ))}
      <circle cx={CX} cy={CY} r={frame.radius + 3.2} fill="rgba(110, 196, 210, 0.16)" />
      <circle cx={CX} cy={CY} r={frame.radius} fill="url(#ocean-grad)" />
      <path className="grid" d={frame.grid} />
      {frame.land.map((item: LandPath) => (
        <path key={item.a3} className={item.selected ? "land on" : "land"} d={item.d} fill={item.fill} />
      ))}
      <circle cx={CX} cy={CY} r={frame.radius} fill="url(#limb-grad)" pointerEvents="none" />
      <circle
        cx={CX}
        cy={CY}
        r={frame.radius}
        fill="none"
        stroke="rgba(214, 242, 246, 0.55)"
        strokeWidth="0.7"
        pointerEvents="none"
      />
    </svg>
  );
}

export type { Api as GlobeApi };
