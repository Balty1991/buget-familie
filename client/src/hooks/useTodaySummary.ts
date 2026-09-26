import { useMemo } from "react";
import type { AppData } from "@/lib/finance-data";
import { isoToday } from "@/lib/finance-data";
import { buildTodaySummary } from "@/lib/today-summary";
import { tickMemo } from "@/lib/tick-cache";

export function useTodaySummary(data: AppData) {
  const today = isoToday();
  // Legat de registru, nu de componentă: la revenirea pe Astăzi (componentă nouă) nu se reface.
  return useMemo(() => tickMemo([data], `todaySummary:${today}`, () => buildTodaySummary(data, today)), [data, today]);
}
