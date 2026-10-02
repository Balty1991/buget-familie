/**
 * Viitorul banilor: dacă puneți deoparte X pe lună, cum cresc economiile și în ce lună se atinge
 * fiecare obiectiv. Obiectivele se umplu pe rând (întâi cele cu termen, apoi în ordinea listei);
 * ce trece de un obiectiv merge în următorul. Fără dobânzi și fără inflație: o hartă, nu un extras.
 */
import type { SavingsGoal } from "./finance-data";

export type FutureGoal = { id: string; name: string; target: number; month?: number };
export type MoneyFuture = { points: number[]; goals: FutureGoal[]; doneMonth?: number };

export function moneyFuture(savings: ReadonlyArray<SavingsGoal>, monthly: number, horizon = 36): MoneyFuture {
  const open = savings
    .filter((goal) => goal.target > 0)
    .map((goal, index) => ({ goal, index }))
    .sort((a, b) => (a.goal.dueDate || "9999").localeCompare(b.goal.dueDate || "9999") || a.index - b.index)
    .map(({ goal }) => ({ id: goal.id, name: goal.name, target: goal.target, have: Math.min(goal.target, Math.max(0, goal.current)) }));
  const goals: FutureGoal[] = open.map((goal) => ({ id: goal.id, name: goal.name, target: goal.target, ...(goal.have >= goal.target ? { month: 0 } : {}) }));
  const start = savings.reduce((sum, goal) => sum + Math.max(0, goal.current), 0);
  const points = [Math.round(start)];
  const step = Math.max(0, monthly);
  for (let month = 1; month <= horizon; month += 1) {
    let left = step;
    for (let index = 0; index < open.length && left > 0; index += 1) {
      const goal = open[index];
      const need = goal.target - goal.have;
      if (need <= 0) continue;
      const put = Math.min(need, left);
      goal.have += put;
      left -= put;
      if (goal.have >= goal.target - 0.005 && goals[index].month === undefined) goals[index].month = month;
    }
    points.push(Math.round(start + step * month));
  }
  const months = goals.map((goal) => goal.month);
  const doneMonth = goals.length && months.every((month) => month !== undefined) ? Math.max(...(months as number[])) : undefined;
  return { points, goals, ...(doneMonth !== undefined ? { doneMonth } : {}) };
}
