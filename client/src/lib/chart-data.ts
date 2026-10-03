/**
 * Datele pentru graficele mari: fluxul banilor (de unde vin, unde se duc), harta anului
 * (fiecare zi colorată după cât s-a cheltuit) și împărțirea dreptunghiurilor pe categorii
 * (treemap „pătrățos”, ca dreptunghiurile să rămână ușor de citit și de atins).
 * Toate sunt pure: primesc registrul și întorc numere, desenul e în componente.
 */
import { addIsoDays, isBalanceAdjustment, type AppData } from "./finance-data";
import { heatOf, heatThresholds } from "./money-calendar";

const round = (value: number) => Math.round(value * 100) / 100;

export type FlowNode = { name: string; amount: number };
export type MoneyFlow = { income: FlowNode[]; spend: FlowNode[]; total: number; kept: number; fromSavings: number };

const top = (map: Map<string, number>, count: number, other: string): FlowNode[] => {
  const rows = Array.from(map.entries()).map(([name, amount]) => ({ name, amount: round(amount) })).filter((row) => row.amount > 0).sort((a, b) => b.amount - a.amount);
  if (rows.length <= count + 1) return rows;
  const rest = rows.slice(count).reduce((sum, row) => sum + row.amount, 0);
  return [...rows.slice(0, count), { name: other, amount: round(rest) }];
};

/**
 * Fluxul unei perioade: veniturile pe nume (salariu, chirie încasată…) în stânga, cheltuielile
 * pe categorii în dreapta, plus ce a rămas. Dacă s-a cheltuit mai mult decât a intrat, diferența
 * apare în stânga ca „din economii”, ca cele două părți să fie egale.
 */
export function moneyFlow(data: AppData, start: string, end: string, labels = { other: "Altele", kept: "Rămas", savings: "Din economii" }): MoneyFlow {
  const incomes = new Map<string, number>();
  const spends = new Map<string, number>();
  for (const item of data.transactions) {
    if (item.date < start || item.date > end || item.transferId || isBalanceAdjustment(item) || !(item.amount > 0)) continue;
    if (item.kind === "income") { const name = (item.title || "").trim() || item.category; incomes.set(name, (incomes.get(name) || 0) + item.amount); }
    else if (item.kind === "expense") spends.set(item.category, (spends.get(item.category) || 0) + item.amount);
  }
  const income = top(incomes, 3, labels.other);
  const spend = top(spends, 6, labels.other);
  const inSum = income.reduce((sum, row) => sum + row.amount, 0);
  const outSum = spend.reduce((sum, row) => sum + row.amount, 0);
  const kept = round(Math.max(0, inSum - outSum));
  const fromSavings = round(Math.max(0, outSum - inSum));
  return {
    income: fromSavings > 0 ? [...income, { name: labels.savings, amount: fromSavings }] : income,
    spend: kept > 0 ? [...spend, { name: labels.kept, amount: kept }] : spend,
    total: round(Math.max(inSum, outSum)),
    kept,
    fromSavings,
  };
}

export type HeatDay = { date: string; spent: number; heat: 0 | 1 | 2 | 3 | 4 };
export type YearHeat = { weeks: Array<Array<HeatDay | null>>; months: Array<{ week: number; month: string }>; total: number; activeDays: number; thresholds: number[] };

/** Ultimele 53 de săptămâni (luni–duminică), până azi; zilele de după azi rămân goale. */
export function yearHeat(data: AppData, today: string): YearHeat {
  const spent = new Map<string, number>();
  const from = addIsoDays(today, -371);
  for (const item of data.transactions) {
    if (item.kind !== "expense" || item.transferId || isBalanceAdjustment(item) || item.date < from || item.date > today) continue;
    spent.set(item.date, (spent.get(item.date) || 0) + item.amount);
  }
  const thresholds = heatThresholds(data, today);
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const firstMonday = addIsoDays(today, -weekday - 52 * 7);
  const weeks: YearHeat["weeks"] = [];
  const months: YearHeat["months"] = [];
  let total = 0, activeDays = 0;
  for (let w = 0; w < 53; w += 1) {
    const column: Array<HeatDay | null> = [];
    for (let d = 0; d < 7; d += 1) {
      const date = addIsoDays(firstMonday, w * 7 + d);
      if (date > today) { column.push(null); continue; }
      const value = round(spent.get(date) || 0);
      if (value > 0) { total += value; activeDays += 1; }
      column.push({ date, spent: value, heat: heatOf(value, thresholds) });
      if (date.slice(8) === "01") months.push({ week: w, month: date.slice(0, 7) });
    }
    weeks.push(column);
  }
  return { weeks, months, total: round(total), activeDays, thresholds };
}

export type TreeRect = { name: string; amount: number; x: number; y: number; w: number; h: number };

/**
 * Treemap „pătrățos” (Bruls, Huizing, van Wijk): rândurile se umplu cât timp cel mai alungit
 * dreptunghi din rând se îmbunătățește. Întoarce dreptunghiuri în coordonatele date.
 */
export function squarify(items: ReadonlyArray<{ name: string; amount: number }>, width: number, height: number): TreeRect[] {
  const list = items.filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
  const sum = list.reduce((acc, item) => acc + item.amount, 0);
  if (!sum || width <= 0 || height <= 0) return [];
  const scale = (width * height) / sum;
  const out: TreeRect[] = [];
  let x = 0, y = 0, w = width, h = height;
  let row: Array<{ name: string; amount: number; area: number }> = [];
  const worst = (cells: typeof row, side: number) => {
    const area = cells.reduce((acc, cell) => acc + cell.area, 0);
    const max = Math.max(...cells.map((cell) => cell.area)), min = Math.min(...cells.map((cell) => cell.area));
    return Math.max((side * side * max) / (area * area), (area * area) / (side * side * min));
  };
  const layout = (cells: typeof row) => {
    const area = cells.reduce((acc, cell) => acc + cell.area, 0);
    if (w >= h) {
      const colW = area / h; let cy = y;
      for (const cell of cells) { const ch = cell.area / colW; out.push({ name: cell.name, amount: cell.amount, x, y: cy, w: colW, h: ch }); cy += ch; }
      x += colW; w -= colW;
    } else {
      const rowH = area / w; let cx = x;
      for (const cell of cells) { const cw = cell.area / rowH; out.push({ name: cell.name, amount: cell.amount, x: cx, y, w: cw, h: rowH }); cx += cw; }
      y += rowH; h -= rowH;
    }
  };
  for (const item of list) {
    const cell = { ...item, area: item.amount * scale };
    const side = Math.min(w, h);
    if (!row.length || worst([...row, cell], side) <= worst(row, side)) row.push(cell);
    else { layout(row); row = [cell]; }
  }
  if (row.length) layout(row);
  return out.map((rect) => ({ ...rect, x: round(rect.x), y: round(rect.y), w: round(rect.w), h: round(rect.h) }));
}
