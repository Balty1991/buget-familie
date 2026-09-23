import { useMemo } from "react";
import type { AppData } from "@/lib/finance-data";
import { planCycle } from "@/lib/plan-cycle";

export function usePlanCycle(data: AppData) {
  return useMemo(() => planCycle(data), [data]);
}
