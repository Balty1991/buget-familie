/**
 * Rapoartele de erori (Sentry). Pornesc doar când build-ul are cheia (VITE_SENTRY_DSN) și omul
 * nu le-a oprit din Setări. Biblioteca se încarcă după prima pictare, ca să nu încetinească pornirea.
 *
 * Ce pleacă: tipul erorii, unde a apărut în cod, versiunea aplicației, Android sau browser.
 * Ce nu pleacă niciodată: sume, nume, magazine, articole de pe bon, date de familie. Mesajele
 * erorilor își pierd cifrele și textul dintre ghilimele, iar pașii dinaintea erorii (atingeri,
 * consola, adresele cerute) nu se trimit deloc.
 */
import { APP_VERSION } from "./app-version";
import { safeSetItem } from "./safe-storage";

export const ERROR_REPORTS_KEY = "buget-familie:error-reports";

export const errorReportsAvailable = () => Boolean(import.meta.env.VITE_SENTRY_DSN);

export const readErrorReports = () => {
  try { return window.localStorage.getItem(ERROR_REPORTS_KEY) !== "0"; } catch { return true; }
};

type SentryApi = typeof import("./sentry-client");
let sentry: Promise<SentryApi | undefined> | undefined;

/** Cifrele (sume, date, coduri) și textul dintre ghilimele (nume, magazine) ies din mesaj. */
export const scrubText = (text: string) => text
  .replace(/[„"«'][^"”»']{0,200}["”»']/g, "„…”")
  .replace(/\d+(?:[.,]\d+)*/g, "#");

type ScrubbableEvent = {
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  breadcrumbs?: unknown[];
  request?: unknown;
  user?: unknown;
  extra?: unknown;
  contexts?: Record<string, unknown>;
};

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.message) event.message = scrubText(event.message);
  for (const value of event.exception?.values || []) if (value.value) value.value = scrubText(value.value);
  delete event.breadcrumbs;
  delete event.request;
  delete event.user;
  delete event.extra;
  if (event.contexts) delete event.contexts.state;
  return event;
}

export function startErrorReports(platform: string) {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || !readErrorReports() || sentry) return;
  sentry = import("./sentry-client").then((api) => {
    api.init({
      dsn,
      release: `buget-familie@${APP_VERSION}`,
      environment: platform === "android" ? "android" : import.meta.env.PROD ? "web" : "dev",
      sendDefaultPii: false,
      // Doar erorile: fără înregistrarea ecranului, fără măsurători de viteză.
      tracesSampleRate: 0,
      maxBreadcrumbs: 0,
      beforeBreadcrumb: () => null,
      beforeSend: (event) => (readErrorReports() ? scrubEvent(event) : null),
    });
    return api;
  }).catch(() => undefined);
}

/** O eroare prinsă de ecranul „Ceva n-a mers”: altfel React o înghite și nu ajunge la Sentry. */
export function reportError(error: unknown) {
  void sentry?.then((api) => api?.captureException(error));
}

export function saveErrorReports(enabled: boolean, platform: string) {
  safeSetItem(window.localStorage, ERROR_REPORTS_KEY, enabled ? "1" : "0");
  if (enabled) { startErrorReports(platform); return; }
  // Oprit: clientul se închide, iar beforeSend oricum nu mai lasă nimic să plece.
  void sentry?.then((api) => api?.close());
  sentry = undefined;
}
