import { geoGraticule, geoOrthographic, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { COUNTRIES } from "./countries.data";
import { colorFor, logDomain } from "./metrics";
import type { Country, MetricId } from "./types";

export const VB = 200;
export const CX = 100;
export const CY = 100;
const BASE_R = 78;

const graticule = geoGraticule().step([30, 30]);

export type LandPath = { a3: string; d: string; fill: string; selected: boolean };

function decimateRing(ring: number[][], minDeg: number) {
  if (ring.length <= 8) return ring;
  const min2 = minDeg * minDeg;
  const out = [ring[0]];
  let last = ring[0];
  for (let i = 1; i < ring.length - 1; i++) {
    const point = ring[i];
    const dLon = point[0] - last[0];
    const dLat = point[1] - last[1];
    if (dLon * dLon + dLat * dLat >= min2) {
      out.push(point);
      last = point;
    }
  }
  out.push(ring[ring.length - 1]);
  return out.length >= 4 ? out : ring;
}

function simplify(country: Country): Country {
  const geometry = country.geometry;
  if (geometry.type === "Polygon") {
    const coordinates = (geometry.coordinates as number[][][]).map((ring) => decimateRing(ring, 0.55));
    return { ...country, geometry: { type: "Polygon", coordinates } };
  }
  if (geometry.type === "MultiPolygon") {
    const coordinates = (geometry.coordinates as number[][][][]).map((poly) =>
      poly.map((ring) => decimateRing(ring, 0.55)),
    );
    return { ...country, geometry: { type: "MultiPolygon", coordinates } };
  }
  return country;
}

const LAND = COUNTRIES.map(simplify);

function quantize(d: string) {
  return d.replace(/-?\d*\.\d+(?:e[-+]?\d+)?/gi, (token) => {
    const value = Math.round(Number(token) * 10) / 10;
    return Object.is(value, -0) ? "0" : String(value);
  });
}

export function wrap180(angle: number) {
  let value = angle % 360;
  if (value > 180) value -= 360;
  if (value < -180) value += 360;
  return value;
}

export function radiusFor(zoom: number) {
  return BASE_R * zoom;
}

export function projection(lambda: number, phi: number, zoom: number) {
  return geoOrthographic().scale(radiusFor(zoom)).translate([CX, CY]).rotate([-lambda, -phi]).precision(1.1);
}

export function projectGlobe(lambda: number, phi: number, zoom: number, metric: MetricId, selectedA3: string | null) {
  const proj = projection(lambda, phi, zoom);
  const path = geoPath(proj);
  const domain = logDomain(metric);
  const land: LandPath[] = [];
  let selected: LandPath | null = null;
  for (const country of LAND) {
    const d = path({ type: "Feature", geometry: country.geometry, properties: {} } as GeoPermissibleObjects);
    if (!d) continue;
    const on = country.a3 === selectedA3;
    const item = {
      a3: country.a3,
      d: quantize(d),
      fill: on ? "#e9f7f8" : colorFor(country, metric, domain.min, domain.max),
      selected: on,
    };
    if (on) selected = item;
    else land.push(item);
  }
  if (selected) land.push(selected);
  return {
    land,
    grid: quantize(path(graticule() as GeoPermissibleObjects) ?? ""),
    radius: radiusFor(zoom),
  };
}

export function lonLatAt(lambda: number, phi: number, zoom: number, x: number, y: number) {
  const hit = projection(lambda, phi, zoom).invert?.([x, y]);
  if (!hit || Number.isNaN(hit[0]) || Number.isNaN(hit[1])) return null;
  return { lon: hit[0], lat: hit[1] };
}
