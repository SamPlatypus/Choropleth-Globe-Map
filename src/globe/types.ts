export type MetricId = "population" | "area" | "gdp_pc";

export type GeoGeometry = {
  type: string;
  coordinates: unknown;
};

export type Country = {
  name: string;
  a3: string;
  pop: number;
  gdpMd: number;
  area: number;
  lon: number;
  lat: number;
  geometry: GeoGeometry;
};
