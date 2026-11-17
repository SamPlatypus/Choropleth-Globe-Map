import { useMemo, useRef, useState } from "react";
import { COUNTRIES } from "./countries.data";
import { GlobeView, type GlobeApi } from "./GlobeView";
import { countryByA3, formatMetricValue, METRIC_OPTIONS, metricValue } from "./metrics";
import type { MetricId } from "./types";

const native =
  typeof window !== "undefined" &&
  Boolean((window as Window & { __CHOROPLETH_NATIVE__?: boolean }).__CHOROPLETH_NATIVE__);

export function GlobeApp() {
  const [metric, setMetric] = useState<MetricId>("population");
  const [selectedA3, setSelectedA3] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [focusNonce, setFocusNonce] = useState(0);
  const apiRef = useRef<GlobeApi | null>(null);

  const country = countryByA3(selectedA3);
  const value = country ? metricValue(country, metric) : null;
  const metricLabel = METRIC_OPTIONS.find((item) => item.id === metric)?.label ?? "Metric";

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return COUNTRIES.filter(
      (item) => item.name.toLowerCase().includes(q) || item.a3.toLowerCase().includes(q),
    ).slice(0, 6);
  }, [query]);

  function choose(a3: string) {
    setSelectedA3(a3);
    setQuery("");
    setFocusNonce((n) => n + 1);
  }

  return (
    <div className="shell">
      <div className="stage">
        <GlobeView
          metric={metric}
          selectedA3={selectedA3}
          focusNonce={focusNonce}
          onSelect={setSelectedA3}
          apiRef={apiRef}
        />
        <header className="topbar">
          <p className="mark">Choropleth</p>
          <p className="sub">Offline world · drag to spin · pinch or buttons to zoom</p>
        </header>
        <div className="zoom">
          <button type="button" aria-label="Zoom in" onClick={() => apiRef.current?.zoom(0.84)}>
            +
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => apiRef.current?.zoom(1.2)}>
            −
          </button>
        </div>
      </div>

      <section className="sheet" aria-label="Country details">
        <div className="metrics" role="group" aria-label="Metric">
          {METRIC_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={metric === item.id}
              onClick={() => setMetric(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="legend">
          <div className="scale" />
          <div className="scale-labels">
            <span>Low</span>
            <span>Log scale · {metricLabel}</span>
            <span>High</span>
          </div>
        </div>

        <div className="readout">
          <p className="country">{country ? country.name : "Tap a country"}</p>
          {country && value != null ? (
            <p className="value">
              {metricLabel}
              <strong>{formatMetricValue(value, metric)}</strong>
            </p>
          ) : (
            <p className="hint">
              {COUNTRIES.length} countries drawn on the globe. Sample figures stay on the device — nothing
              is fetched when you spin it.
            </p>
          )}
        </div>

        <div className="search">
          {matches.length > 0 ? (
            <ul className="results">
              {matches.map((item) => (
                <li key={item.a3}>
                  <button type="button" onClick={() => choose(item.a3)}>
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matches[0]) choose(matches[0].a3);
            }}
            placeholder="Find a country"
            aria-label="Find a country"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>

        {native ? null : (
          <a className="download" href="/choropleth.apk" download="Choropleth.apk">
            Download Android APK
          </a>
        )}
      </section>
    </div>
  );
}
