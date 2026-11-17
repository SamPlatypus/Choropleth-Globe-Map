import { geoContains } from "d3-geo";
import { COUNTRIES } from "./countries.data";
import type { Country } from "./types";

export function countryAt(lon: number, lat: number): Country | null {
  let best: Country | null = null;
  const point: [number, number] = [lon, lat];
  for (const country of COUNTRIES) {
    const feature = {
      type: "Feature" as const,
      geometry: country.geometry,
      properties: {},
    };
    if (geoContains(feature as never, point)) {
      if (!best || country.area < best.area) best = country;
    }
  }
  return best;
}
