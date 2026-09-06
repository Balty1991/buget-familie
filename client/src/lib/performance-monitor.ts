import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

export type BugetFamilieWebVital = {
  id: string;
  name: Metric["name"];
  value: number;
  rating: Metric["rating"];
  navigationType: string;
  measuredAt: string;
};

declare global {
  interface Window {
    __BF_WEB_VITALS__?: BugetFamilieWebVital[];
  }
}

const endpoint = import.meta.env.VITE_WEB_VITALS_ENDPOINT as string | undefined;

function report(metric: Metric) {
  const vital: BugetFamilieWebVital = {
    id: metric.id,
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType,
    measuredAt: new Date().toISOString(),
  };

  window.__BF_WEB_VITALS__ = [...(window.__BF_WEB_VITALS__ || []).filter((item) => item.name !== vital.name), vital];
  window.dispatchEvent(new CustomEvent("bf:web-vital", { detail: vital }));

  if (import.meta.env.DEV) console.debug(`[Buget Familie] ${vital.name}: ${Math.round(vital.value * 100) / 100} (${vital.rating})`);
  if (endpoint && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(endpoint, JSON.stringify(vital));
    } catch {
      // Monitorizarea nu trebuie să afecteze fluxurile financiare dacă endpointul nu este disponibil.
    }
  }
}

export function startPerformanceMonitoring() {
  if (typeof window === "undefined") return;
  onCLS(report);
  onFCP(report);
  onINP(report);
  onLCP(report);
  onTTFB(report);
}
