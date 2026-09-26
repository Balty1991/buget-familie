/**
 * Închiderea ciclului de salariu.
 *
 * Aplicația are un ritual pentru începutul ciclului — „a venit salariul? umple plicurile” —
 * dar niciunul pentru sfârșit. Fără el, un plic greșit rămâne greșit la nesfârșit: nimeni
 * nu se uită înapoi ca să spună „Alimente a rămas sub buget de fiecare dată, hai să-l scad”.
 *
 * Aici se face socoteala ciclului încheiat și se propun schimbările pe care le arată
 * cheltuielile, nu părerile: doar acolo unde există destule mișcări cât să nu fie o
 * coincidență, doar cu diferențe care merită apăsate.
 */
import {
  addIsoDays,
  allocationStatus,
  inPlanPeriod,
  isFixedEnvelope,
  isoToday,
  newId,
  planEndDate,
  type AllocationHistoryEntry,
  type AppData,
  type BudgetAllocation,
} from "./finance-data";

export type EnvelopeOutcome = {
  id: string;
  label: string;
  budget: number;
  spent: number;
  left: number;
};

/** O schimbare propusă pentru ciclul următor, cu motivul ei în cifre. */
export type CycleLesson = {
  allocationId: string;
  label: string;
  current: number;
  suggested: number;
  /** Încotro merge propunerea; cuvintele le pune ecranul, cifrele le pune aici. */
  direction: "down" | "up";
};

export type CycleClose = {
  periodStart: string;
  periodEnd: string;
  days: number;
  income: number;
  spent: number;
  /** Ce a rămas nefolosit în plicuri: banii pe care i-ai păzit, nu cei pierduți. */
  leftInEnvelopes: number;
  envelopes: EnvelopeOutcome[];
  lessons: CycleLesson[];
  nextStart: string;
  nextPayday: string;
};

const round = (value: number) => Math.round(value * 100) / 100;
const laZece = (value: number) => Math.max(10, Math.round(value / 10) * 10);

/** Aceeași zi, luna următoare; 31 ianuarie devine 28/29 februarie, nu 3 martie. */
export function nextMonthSameDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const zileInLuna = new Date(nextYear, nextMonth, 0).getDate();
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(Math.min(day, zileInLuna)).padStart(2, "0")}`;
}

/**
 * Cât s-a cheltuit pe categorie într-un ciclu, după cheltuielile adevărate.
 *
 * Fereastra e de 90 de zile, dar socoteala se face pe cât din ea chiar are mișcări: o casă
 * cu o singură lună de istoric ar fi ieșit de trei ori mai cumpătată decât e, fiindcă
 * împărțeam la 90 de zile din care 60 nu existau. Pragul de două săptămâni oprește cealaltă
 * greșeală — trei cumpărături în două zile nu înseamnă un ritm.
 *
 * Scadențele nu se numără: ele au ritmul lor și ar strica media.
 */
function spentPerCycle(data: AppData, allocation: BudgetAllocation, today: string, cycleDays: number, days = 90) {
  const from = addIsoDays(today, -days);
  const category = allocation.category || allocation.label;
  // Pe plic, nu pe categorie: Chirie, Lumină și Gaz au aceeași categorie, dar nu aceeași sumă.
  // Categoria ajută doar când e a unui singur plic și mișcările vechi n-au plicul trecut.
  const soleOfCategory = data.settings.salaryPlan.allocations.filter((item) => (item.category || item.label) === category).length === 1;
  const rows = data.transactions.filter((item) =>
    item.kind === "expense" && !item.recurringId && item.date >= from && item.date <= today
    && (item.allocationId ? item.allocationId === allocation.id : soleOfCategory && item.category === category));
  if (!rows.length) return { total: 0, count: 0 };
  const inceput = rows.reduce((cel, item) => item.date < cel ? item.date : cel, rows[0].date);
  const observate = Math.min(days, Math.max(14, Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${inceput}T12:00:00`).getTime()) / 86400000) + 1));
  const total = rows.reduce((sum, item) => sum + item.amount, 0);
  return { total: round(total * (cycleDays / observate)), count: rows.length };
}

/**
 * Ce s-a întâmplat în ciclul care tocmai s-a încheiat. Întoarce `undefined` cât timp
 * ciclul e în desfășurare — o închidere cerută prea devreme ar propune schimbări din
 * jumătate de poveste.
 */
export function cycleClose(data: AppData, today = isoToday()): CycleClose | undefined {
  const plan = data.settings.salaryPlan;
  const periodEnd = planEndDate(plan);
  if (!plan.periodStart || !periodEnd || today <= periodEnd) return undefined;
  const days = Math.max(1, Math.round((new Date(`${periodEnd}T12:00:00`).getTime() - new Date(`${plan.periodStart}T12:00:00`).getTime()) / 86400000) + 1);
  const inCycle = data.transactions.filter((item) => inPlanPeriod(item.date, plan));
  const income = round(inCycle.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0));
  const spent = round(inCycle.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0));

  const envelopes: EnvelopeOutcome[] = plan.allocations.map((item) => {
    const status = allocationStatus(data, item);
    return { id: item.id, label: item.label, budget: round(status.budget), spent: round(status.spent), left: round(status.remaining) };
  });

  const nextStart = periodEnd >= addIsoDays(today, -15) ? periodEnd : today;
  const nextPayday = nextMonthSameDay(nextStart);
  // Propunerea e pentru ciclul care începe, deci pe lungimea lui, nu a celui încheiat (poate fi de 15 zile).
  const nextDays = Math.max(1, Math.round((new Date(`${nextPayday}T12:00:00`).getTime() - new Date(`${nextStart}T12:00:00`).getTime()) / 86400000));
  const lessons: CycleLesson[] = [];
  for (const allocation of plan.allocations) {
    // Facturile și ratele au suma de pe factură, nu din obicei.
    if (isFixedEnvelope(plan, allocation)) continue;
    const istoric = spentPerCycle(data, allocation, today, nextDays);
    // Sub trei mișcări nu e un obicei, e o întâmplare. Nu se învață din ea.
    if (istoric.count < 3 || allocation.amount <= 0) continue;
    const propus = laZece(istoric.total);
    const diferenta = allocation.amount - propus;
    if (diferenta >= 100 && propus < allocation.amount * 0.8) {
      lessons.push({ allocationId: allocation.id, label: allocation.label, current: allocation.amount, suggested: propus, direction: "down" });
    } else if (-diferenta >= 100 && propus > allocation.amount * 1.2) {
      lessons.push({ allocationId: allocation.id, label: allocation.label, current: allocation.amount, suggested: propus, direction: "up" });
    }
  }

  /**
   * Ciclul nou începe în ziua venitului, nu azi: dacă omul deschide aplicația trei zile
   * mai târziu, banii tot atunci au intrat. Doar o întârziere mare mută startul pe azi,
   * ca planul să nu se nască deja pe jumătate consumat.
   */
  return {
    periodStart: plan.periodStart,
    periodEnd,
    days,
    income,
    spent,
    leftInEnvelopes: round(envelopes.reduce((sum, item) => sum + Math.max(0, item.left), 0)),
    envelopes: envelopes.sort((left, right) => right.budget - left.budget),
    lessons,
    nextStart,
    nextPayday,
  };
}

/**
 * Deschide ciclul următor. Schimbările alese se aplică pe plicuri, cu urmă în istoric;
 * mutările dintre plicuri și dintre săptămâni rămân în ciclul din care au făcut parte.
 */
export function startNextCycle(data: AppData, lessonIds: string[] = [], today = isoToday()): AppData {
  const close = cycleClose(data, today);
  if (!close) return data;
  const plan = data.settings.salaryPlan;
  const alese = close.lessons.filter((item) => lessonIds.includes(item.allocationId));
  const now = new Date().toISOString();
  const istoric: AllocationHistoryEntry[] = alese.map((item) => ({
    id: newId("allocation-history"),
    kind: "updated" as const,
    allocationId: item.allocationId,
    allocationLabel: item.label,
    previousAmount: item.current,
    newAmount: item.suggested,
    note: `Închiderea ciclului ${close.periodStart} – ${close.periodEnd}`,
    createdAt: now,
  }));
  return {
    ...data,
    settings: {
      ...data.settings,
      salaryPlan: {
        ...plan,
        periodStart: close.nextStart,
        nextPayday: close.nextPayday,
        earliestPayday: undefined,
        allocations: plan.allocations.map((item) => {
          const lectie = alese.find((entry) => entry.allocationId === item.id);
          return lectie ? { ...item, amount: lectie.suggested, updatedAt: now } : item;
        }),
        transfers: [],
        weekTransfers: [],
        joinedMidCycle: false,
        allocationHistory: [...istoric, ...(plan.allocationHistory || [])].slice(0, 400),
        updatedAt: now,
      },
    },
  };
}
