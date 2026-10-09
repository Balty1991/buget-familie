/** Doar ce folosesc rapoartele de erori din Sentry: importate pe nume, restul bibliotecii (Replay, Tracing) rămâne pe dinafară. */
export { captureException, close, init } from "@sentry/react";
