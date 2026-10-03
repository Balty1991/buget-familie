/**
 * Ce mai spune povestea anului, pe lângă cifrele din `yearRecap`: cât s-a dat pe datorii,
 * obiectivele atinse, cum s-a mișcat averea, cea mai mare cheltuială, ziua cea mai scumpă a
 * săptămânii și „personalitatea” financiară a familiei, aleasă după ce a ieșit în evidență.
 */
import { isBalanceAdjustment, type AppData } from "./finance-data";
import { netWorth } from "./net-worth";
import type { YearRecap } from "./year-recap";

export type PersonaId = "savers" | "debt-fighters" | "steady" | "minimalists" | "loyal" | "explorers";
export type YearStoryExtras = {
  debtPaid: number;
  goalsReached: string[];
  goalsSaved: number;
  /** Cum s-a schimbat averea în ultimele 12 luni (doar dacă e ceva de spus). */
  netChange?: number;
  biggest?: { title: string; amount: number; date: string };
  /** 0 = luni … 6 = duminică. */
  priciestWeekday?: number;
  persona: PersonaId;
};

export function yearStoryExtras(data: AppData, recap: YearRecap, today: string): YearStoryExtras {
  const prefix = `${recap.year}-`;
  let debtPaid = 0;
  let biggest: YearStoryExtras["biggest"];
  const weekday = [0, 0, 0, 0, 0, 0, 0];
  for (const item of data.transactions) {
    if (!item.date.startsWith(prefix) || item.date > today || item.kind !== "expense" || isBalanceAdjustment(item) || item.transferId) continue;
    if (item.debtId) { debtPaid += item.amount; continue; }
    weekday[(new Date(`${item.date}T12:00:00Z`).getUTCDay() + 6) % 7] += item.amount;
    if (!item.recurringId && (!biggest || item.amount > biggest.amount)) biggest = { title: item.title, amount: item.amount, date: item.date };
  }
  const goals = data.savings.filter((goal) => goal.target > 0);
  const goalsReached = goals.filter((goal) => goal.current >= goal.target).map((goal) => goal.name);
  const goalsSaved = Math.round(goals.reduce((sum, goal) => sum + Math.max(0, Math.min(goal.current, goal.target)), 0));
  const worth = netWorth(data, today);
  const top = Math.max(...weekday);
  const persona: PersonaId =
    recap.keptShare !== undefined && recap.keptShare >= 0.2 ? "savers"
      : debtPaid > 0 && debtPaid >= recap.spent * 0.1 ? "debt-fighters"
        : recap.longestStreak >= 30 ? "steady"
          : recap.noSpendDays >= 100 ? "minimalists"
            : recap.topPlace && recap.topPlace.visits >= 40 ? "loyal"
              : "explorers";
  return {
    debtPaid: Math.round(debtPaid),
    goalsReached,
    goalsSaved,
    ...(worth.yearChange !== undefined && Math.abs(worth.yearChange) >= 100 ? { netChange: Math.round(worth.yearChange) } : {}),
    ...(biggest ? { biggest } : {}),
    ...(top > 0 ? { priciestWeekday: weekday.indexOf(top) } : {}),
    persona,
  };
}
