import { useMemo } from "react";
import type { AppData } from "@/lib/finance-data";
import { isoToday } from "@/lib/finance-data";
import { buildTodaySummary } from "@/lib/today-summary";

export function useTodaySummary(data: AppData) {
  const today = isoToday();
  return useMemo(() => buildTodaySummary(data, today), [data, today]);
}
