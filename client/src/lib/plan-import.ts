/**
 * Plicuri aduse dintr-un tabel simplu: câte o linie, nume și sumă.
 * Nu atinge plicurile care există deja — nici suma, nici numele.
 */
import { newId, parseRomanianAmount, type AppData, type BudgetAllocation } from "./finance-data";

export type PlanRow = { label: string; amount: number };

const AMOUNT = String.raw`(\d{1,3}(?:[.\s]\d{3})*(?:[,.]\d{1,2})?|\d+(?:[,.]\d{1,2})?)`;
const LINE = new RegExp(String.raw`^(.*?)[\t,; ]+${AMOUNT}\s*$`);

/** „Mâncare, 600”, tab sau punct și virgulă. O linie fără sumă se sare. */
export function parsePlanTable(raw: string): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const line of String(raw || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = LINE.exec(trimmed);
    if (!match) continue;
    const label = match[1].replace(/[\t,;]+$/g, "").trim();
    const amount = parseRomanianAmount(match[2]);
    if (!label || !(amount > 0)) continue;
    rows.push({ label: label.slice(0, 60), amount });
  }
  return rows;
}

/** Adaugă doar numele care nu există (fără diferență de majuscule). Suma e pe ciclu, nu pe săptămână. */
export function applyPlanRows(data: AppData, rows: PlanRow[]): { data: AppData; added: number } {
  const plan = data.settings.salaryPlan;
  const existing = new Set(plan.allocations.map((item) => item.label.trim().toLocaleLowerCase("ro-RO")));
  const now = new Date().toISOString();
  const fresh: BudgetAllocation[] = [];
  for (const row of rows) {
    const key = row.label.trim().toLocaleLowerCase("ro-RO");
    if (!key || existing.has(key) || !(row.amount > 0)) continue;
    existing.add(key);
    fresh.push({ id: newId("allocation"), label: row.label.trim(), amount: row.amount, weeklyPace: false, updatedAt: now });
  }
  if (!fresh.length) return { data, added: 0 };
  return {
    added: fresh.length,
    data: {
      ...data,
      settings: {
        ...data.settings,
        salaryPlan: { ...plan, allocations: [...plan.allocations, ...fresh], updatedAt: now },
      },
    },
  };
}
