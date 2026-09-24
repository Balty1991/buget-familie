/**
 * „Versiune nouă”: compară build-ul care rulează cu cel publicat (`build.json`, scris la build).
 * Doar pe web în producție; aplicația Android își aduce codul din APK, nu de pe site.
 */
import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/app-storage";

const RUNNING = String(import.meta.env.VITE_BUILD_ID || "dev");
const CHECK_EVERY_MS = 20 * 60_000;

export async function publishedBuildId(fetcher: typeof fetch = fetch, base = import.meta.env.BASE_URL || "/"): Promise<string | null> {
  try {
    const response = await fetcher(`${base}build.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    const body = await response.json() as { id?: unknown };
    return typeof body.id === "string" && body.id ? body.id : null;
  } catch {
    return null;
  }
}

export function isNewer(published: string | null, running = RUNNING) {
  return Boolean(published && running !== "dev" && published !== running);
}

/** Verifică la pornire, la revenirea în aplicație și la fiecare 20 de minute. */
export function useUpdateAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD || RUNNING === "dev" || isNativeApp()) return;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState === "hidden" || (typeof navigator !== "undefined" && !navigator.onLine)) return;
      if (isNewer(await publishedBuildId()) && !stopped) setAvailable(true);
    };
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    void check();
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return available;
}

/** Ia pagina nouă: service worker-ul își reia fișierele, apoi reîncărcăm o singură dată. */
export async function reloadToNewVersion() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    await registration?.update();
    registration?.waiting?.postMessage("SKIP_WAITING");
  } catch { /* fără service worker: doar reîncărcăm */ }
  window.location.reload();
}
