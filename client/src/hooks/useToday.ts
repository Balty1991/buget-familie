import { useEffect, useState } from "react";
import { isoToday } from "@/lib/finance-data";

/**
 * Ziua de azi, care se schimbă singură la miezul nopții și la revenirea în aplicație.
 * Calculele memorate pe [data] rămâneau pe ziua de ieri dacă telefonul stătea deschis peste
 * noapte: Astăzi arăta două zile pe același ecran, iar widgetul cifra de ieri.
 */
export function useToday(): string {
  const [today, setToday] = useState(isoToday);
  useEffect(() => {
    let timer = 0;
    const refresh = () => setToday((current) => { const next = isoToday(); return next === current ? current : next; });
    const arm = () => {
      window.clearTimeout(timer);
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timer = window.setTimeout(() => { refresh(); arm(); }, Math.min(midnight.getTime() - now.getTime(), 6 * 60 * 60 * 1000));
    };
    const onVisible = () => { if (document.visibilityState === "visible") { refresh(); arm(); } };
    arm();
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return today;
}
