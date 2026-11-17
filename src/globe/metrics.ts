import { COUNTRIES } from "./countries.data";
import type { Country, MetricId } from "./types";

export const COLOR_STOPS = ["#2a3a4a", "#3a5a6a", "#4a7a8a", "#5a9aaa", "#6ab8c8"] as const;
export const NODATA = "#1a222c";

export const METRIC_OPTIONS: { id: MetricId; label: string; short: string }[] = [
  { id: "population", label: "Population", short: "People" },
  { id: "area", label: "Land area", short: "km²" },
  { id: "gdp_pc", label: "GDP / person", short: "USD" },
];

const byA3 = new Map(COUNTRIES.map((country) => [country.a3, country]));

export function countryByA3(a3: string | null): Country | null {
  if (!a3) return null;
  return byA3.get(a3) ?? null;
}

export function metricValue(country: Country, metric: MetricId): number | null {
  if (metric === "population") return country.pop > 0 ? country.pop : null;
  if (metric === "area") return country.area > 0 ? country.area : null;
  if (country.pop > 0 && country.gdpMd > 0) return (country.gdpMd * 1_000_000) / country.pop;
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function lerpStops(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (COLOR_STOPS.length - 1);
  const i = Math.min(COLOR_STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const a = hexToRgb(COLOR_STOPS[i]);
  const b = hexToRgb(COLOR_STOPS[i + 1]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function colorFor(country: Country, metric: MetricId, minLog: number, maxLog: number): string {
  const value = metricValue(country, metric);
  if (value == null || value <= 0) return NODATA;
  const t = (Math.log(value) - minLog) / (maxLog - minLog || 1);
  return lerpStops(t);
}

export function logDomain(metric: MetricId): { min: number; max: number } {
  const logs = COUNTRIES.map((country) => metricValue(country, metric))
    .filter((value): value is number => value != null && value > 0)
    .map((value) => Math.log(value));
  return { min: Math.min(...logs), max: Math.max(...logs) };
}

export function formatMetricValue(value: number, metric: MetricId): string {
  if (metric === "population") {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)} billion`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)} million`;
    return Math.round(value).toLocaleString("en-US");
  }
  if (metric === "area") {
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)} million km²`;
    return `${Math.round(value).toLocaleString("en-US")} km²`;
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
