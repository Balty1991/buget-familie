/**
 * Cheltuielile lunare declarate și repartizarea lor la fiecare salariu.
 *
 * Familia știe dinainte ce plătește: „mâncare 600 pe săptămână”, „lumină 300–400”,
 * „rate 1.300–1.400”. Când intră un salariu, aplicația propune cât merge în fiecare plic:
 * întâi obligațiile (rate, facturi), apoi restul, până se termină banii. Ce nu încape
 * rămâne pentru salariul următor, iar al doilea venit al ciclului completează doar ce lipsește.
 *
 * Plicurile sunt limite pe ciclu, nu solduri: repartizarea stabilește suma plicului pentru
 * ciclul curent (nu o adună peste cea de luna trecută), iar anularea pune la loc suma veche.
 */
import {
  activeSalaryApplications,
  addIsoDays,
  appendAllocationHistory,
  newId,
  type AppData,
  type BudgetAllocation,
  type ExpectedIncome,
  type MonthlyNeed,
  type SalaryAllocationApplication,
  type SplitTransfer,
  type Transaction,
} from "./finance-data";
import { t } from "./i18n";
import { addContribution, daysBetween as eventDays, plannedEventStatus, type PlannedEvent } from "./planned-events";

/** Veniturile aceluiași ciclu vin la câteva zile unul de altul; o lună mai târziu e alt ciclu. */
const CYCLE_WINDOW_DAYS = 20;

const round2 = (value: number) => Math.round(value * 100) / 100;
const atNoon = (iso: string) => new Date(`${iso}T12:00:00`);
const toIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const activeNeeds = (data: AppData) => (data.settings.salaryPlan.needs || []).filter((item) => !item.archived);
export const activeIncomes = (data: AppData) => (data.settings.salaryPlan.incomes || []).filter((item) => !item.archived);

/** Suma aleasă din interval: maximul (prudent), media sau minimul. */
export const reserveOf = (need: Pick<MonthlyNeed, "min" | "max" | "reserve">) =>
  need.reserve === "min" ? need.min : need.reserve === "avg" ? round2((need.min + need.max) / 2) : need.max;

/** Aceeași zi luna viitoare; 31 ianuarie → 28/29 februarie, nu 3 martie. */
export const sameDayNextMonth = (iso: string, day = Number(iso.slice(8, 10))) => {
  const date = atNoon(iso);
  const target = new Date(date.getFullYear(), date.getMonth() + 1, 1, 12);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return toIso(target);
};

/**
 * Săptămânile ciclului, aceleași felii de 7 zile ca tranșele din Plan (de la ziua venitului,
 * cu ziua următorului venit inclusă): 4 săptămâni întregi și câteva zile.
 */
export const cycleWeeks = (start: string, end: string) => {
  const days = Math.max(1, Math.round((atNoon(end).valueOf() - atNoon(start).valueOf()) / 86_400_000) + 1);
  return { days, weeks: Math.floor(days / 7), extraDays: days % 7 };
};

/** Cât cere o cheltuială pe săptămână într-un ciclu: săptămânile întregi exact, zilele rămase rotund. */
export const weeklyTarget = (perWeek: number, cycle: { weeks: number; extraDays: number }) =>
  round2(perWeek * cycle.weeks + Math.round(perWeek * cycle.extraDays / 7));

const incomeOf = (data: AppData, id: string) => data.transactions.find((item) => item.id === id && item.kind === "income");

/** Ce s-a repartizat deja pe fiecare cheltuială, în ciclul acestui venit, din alte venituri. */
/** Plățile rare (RCA, impozit, Crăciun) sunt evenimentele planificate: un rând al repartizării, nu un plic. */
export const RARE_ID = "rare";

/**
 * Cât trebuie pus deoparte în ciclul acesta pentru plățile rare: ce lipsește din fiecare,
 * împărțit pe lunile rămase până la ea; dacă vine în ciclul acesta, tot ce lipsește.
 * Se socotește din ziua în care a început ciclul, ca al doilea salariu să nu vadă o țintă
 * deja micșorată de primul.
 */
export function rarePlan(data: AppData, cycleStart: string) {
  const events = (data.settings.plannedEvents || []).map((event) => {
    const status = plannedEventStatus(event, cycleStart);
    if (!status.date || status.passed || status.estimate <= 0) return undefined;
    const before = (event.contributions || []).filter((item) => item.date < cycleStart).reduce((sum, item) => sum + item.amount, 0);
    const missing = round2(Math.max(0, status.estimate - before));
    const days = Math.max(1, eventDays(cycleStart, status.date));
    if (missing <= 0 || days > 366) return undefined;
    const perCycle = days <= 31 ? missing : Math.ceil((missing * 30 / days) / 10) * 10;
    return { event, date: status.date, missing, perCycle: Math.min(missing, perCycle) };
  }).filter((item): item is { event: PlannedEvent; date: string; missing: number; perCycle: number } => Boolean(item));
  return { events, total: round2(events.reduce((sum, item) => sum + item.perCycle, 0)) };
}

const fundedInCycle = (data: AppData, income: Transaction) => {
  /**
   * Venitul care cade în ciclul în curs (înainte de fereastra salariului următor) îl
   * completează, oricât de departe ar fi de primul: salariile pe 1 și pe 25 sunt același
   * ciclu. Fereastra de 20 de zile rămâne doar când planul nu spune nimic.
   */
  const plan = data.settings.salaryPlan;
  const inCurrent = Boolean(plan.periodStart && plan.nextPayday && !plan.horizonDays && income.date >= plan.periodStart && income.date < addIsoDays(plan.nextPayday, -(plan.paydayFlexDays ?? 3)));
  const windowStart = addIsoDays(income.date, -CYCLE_WINDOW_DAYS);
  const since = inCurrent && plan.periodStart < windowStart ? plan.periodStart : windowStart;
  const funded = new Map<string, number>();
  let cycleStart = income.date;
  for (const application of activeSalaryApplications(data.settings.salaryPlan)) {
    if (application.origin !== "needs" || application.incomeId === income.id) continue;
    const other = incomeOf(data, application.incomeId);
    if (!other || other.date < since || other.date > income.date) continue;
    if (other.date < cycleStart) cycleStart = other.date;
    for (const line of application.allocations) {
      const needId = line.ruleId.startsWith("event:") ? RARE_ID : line.ruleId.replace(/^need:/, "");
      funded.set(needId, round2((funded.get(needId) || 0) + line.amount));
    }
  }
  return { funded, cycleStart };
};

/** Venitul declarat care se potrivește cu cel intrat: același membru, ziua cea mai apropiată. */
export const expectedIncomeFor = (data: AppData, income: Pick<Transaction, "date" | "memberId">): ExpectedIncome | undefined => {
  const all = activeIncomes(data);
  const own = all.filter((item) => item.memberId === income.memberId);
  const day = Number(income.date.slice(8, 10));
  const gap = (item: ExpectedIncome) => { const raw = Math.abs(item.day - day); return Math.min(raw, 31 - raw); };
  return [...(own.length ? own : all)].sort((a, b) => gap(a) - gap(b))[0];
};

/** Sub atâtea zile până la ziua declarată, venitul e un salariu venit devreme, nu unul întârziat. */
const EARLY_SALARY_DAYS = 10;

/**
 * Ziua următorului salariu, după ziua declarată, nu după ziua în care a intrat de fapt:
 * dacă a venit pe 8 în loc de 10, următorul e tot pe 10. Un salariu venit devreme
 * (30 sept. în loc de 1 oct.) nu închide ciclul a doua zi: sub 10 zile se sare o lună.
 * Dar cine pornește aplicația pe 25 cu salariul pe 10 are ciclul până pe 10 oct., nu
 * până pe 10 noiembrie („Mâncare 600 × 6 săpt. + 5 zile”).
 */
export const nextPaydayAfter = (start: string, day: number) => {
  const sameMonth = (() => { const date = atNoon(start); const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); date.setDate(Math.min(day, last)); return toIso(date); })();
  let candidate = sameMonth;
  for (let step = 0; step < 3 && cycleWeeks(start, candidate).days - 1 < EARLY_SALARY_DAYS; step += 1) candidate = sameDayNextMonth(candidate, day);
  return candidate;
};

/** Următorul venit așteptat al altui membru, dacă vine în același ciclu (până la salariul următor). */
const otherIncomeSoon = (data: AppData, income: Transaction, cycleStart: string, cycleEnd: string): { label: string; amount: number; date: string } | undefined => {
  const incomes = activeIncomes(data).filter((item) => item.memberId !== income.memberId);
  const candidates = incomes.map((item) => {
    // Ziua 31 în septembrie e 30, în februarie 28: fără limită ieșea „2026-09-31” (afișat 1 octombrie).
    const start = atNoon(income.date);
    const last = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    let date = `${income.date.slice(0, 8)}${String(Math.min(item.day, last)).padStart(2, "0")}`;
    if (date < income.date) date = sameDayNextMonth(date, item.day);
    return { item, date };
  }).filter(({ date }) => date < cycleEnd);
  const already = new Set(activeSalaryApplications(data.settings.salaryPlan).filter((item) => item.origin === "needs").map((item) => incomeOf(data, item.incomeId)).filter((item) => item && item.date >= cycleStart).map((item) => item!.memberId));
  const next = candidates.filter(({ item }) => !already.has(item.memberId)).sort((a, b) => a.date.localeCompare(b.date))[0];
  return next ? { label: next.item.label, amount: next.item.amount, date: next.date } : undefined;
};

export type SplitLine = {
  need: MonthlyNeed;
  /** Ținta pe ciclu: suma aleasă din interval, sau săptămânal × săptămânile ciclului. */
  target: number;
  /** La cheltuielile pe săptămână: săptămânile întregi și zilele rămase din ciclu. */
  weeks?: number;
  extraDays?: number;
  perWeek?: number;
  fundedBefore: number;
  amount: number;
  /** Cât rămâne de acoperit după acest venit. */
  remaining: number;
  /** De ce nu primește nimic acum, dacă e cazul. */
  skipped?: "other-payer";
  /** La plățile rare: pentru ce se strâng banii. */
  note?: string;
};

export type IncomeSplit =
  | { ok: false; reason: "not-income" | "meal" | "no-needs" | "applied"; message: string }
  | {
    ok: true;
    income: Transaction;
    cycleStart: string;
    cycleEnd: string;
    weeks: number;
    extraDays: number;
    lines: SplitLine[];
    covered: number;
    free: number;
    uncovered: number;
    nextIncome?: { label: string; amount: number; date: string };
    /** Ce trebuie trimis celuilalt, pentru cheltuielile pe care le plătește el. */
    transfers: SplitTransfer[];
  };

/**
 * Propunerea pentru un venit: obligațiile întâi, apoi restul, cât ajung banii. Tichetele
 * de masă nu intră — sunt pentru cheltuieli de moment, nu pentru plicurile lunii.
 */
export function proposeIncomeSplit(data: AppData, incomeId: string): IncomeSplit {
  const income = incomeOf(data, incomeId);
  if (!income) return { ok: false, reason: "not-income", message: t("Alege un venit înregistrat.") };
  const source = data.settings.paymentSources.find((item) => item.id === income.sourceId);
  if (source?.kind === "meal") return { ok: false, reason: "meal", message: t("Tichetele de masă nu intră în repartizare: rămân pentru cheltuieli de moment.") };
  if (activeSalaryApplications(data.settings.salaryPlan).some((item) => item.incomeId === income.id)) return { ok: false, reason: "applied", message: t("Acest venit a fost deja repartizat.") };
  const needs = activeNeeds(data);
  if (!needs.length) return { ok: false, reason: "no-needs", message: t("Adaugă întâi cheltuielile lunare ale familiei.") };

  const { funded, cycleStart } = fundedInCycle(data, income);
  // Data aleasă de mână pentru ciclul în curs are întâietate; altfel, ziua declarată a venitului.
  const plan = data.settings.salaryPlan;
  const opener = cycleStart === income.date ? income : incomeOf(data, activeSalaryApplications(plan).find((item) => item.origin === "needs" && incomeOf(data, item.incomeId)?.date === cycleStart)?.incomeId || "") || income;
  const declaredDay = expectedIncomeFor(data, opener)?.day ?? Number(cycleStart.slice(8, 10));
  const manual = plan.periodStart && plan.periodStart <= cycleStart && plan.nextPayday && plan.nextPayday > addIsoDays(cycleStart, EARLY_SALARY_DAYS - 1) && !plan.horizonDays ? plan.nextPayday : "";
  const cycleEnd = manual || nextPaydayAfter(cycleStart, declaredDay);
  const cycle = cycleWeeks(cycleStart, cycleEnd);
  let money = round2(income.amount);
  const rank = (need: MonthlyNeed) => need.priority === "buffer" ? 2 : need.priority === "flex" ? 1 : 0;
  const ordered = [...needs].sort((a, b) => rank(a) - rank(b));
  const toLine = (need: MonthlyNeed): SplitLine => {
    const weekly = need.cadence === "weekly";
    const target = weekly ? weeklyTarget(reserveOf(need), cycle) : reserveOf(need);
    const weekInfo = weekly ? { weeks: cycle.weeks, extraDays: cycle.extraDays, perWeek: reserveOf(need) } : {};
    const fundedBefore = funded.get(need.id) || 0;
    const open = Math.max(0, round2(target - fundedBefore));
    if (need.payerId && need.payerId !== income.memberId) {
      return { need, target, ...weekInfo, fundedBefore, amount: 0, remaining: open, skipped: "other-payer" as const };
    }
    const amount = Math.min(open, money);
    money = round2(money - amount);
    return { need, target, ...weekInfo, fundedBefore, amount: round2(amount), remaining: round2(open - amount) };
  };
  const lines: SplitLine[] = ordered.filter((need) => need.priority !== "buffer").map(toLine);
  // Plățile rare vin la urmă: întâi traiul lunii, apoi ce se strânge pentru RCA sau Crăciun.
  const rare = rarePlan(data, cycleStart);
  if (rare.total > 0) {
    const need: MonthlyNeed = { id: RARE_ID, label: t("Plăți rare"), category: "Economii", cadence: "monthly", min: rare.total, max: rare.total, priority: "flex" };
    const fundedBefore = funded.get(RARE_ID) || 0;
    const open = Math.max(0, round2(rare.total - fundedBefore));
    const amount = Math.min(open, money);
    money = round2(money - amount);
    const note = rare.events.map((item) => `${item.event.name} (${item.date.slice(8, 10)}.${item.date.slice(5, 7)})`).join(", ");
    lines.push({ need, target: rare.total, fundedBefore, amount: round2(amount), remaining: round2(open - amount), note });
  }
  // Neprevăzutele (farmacie, reparații) primesc doar ce rămâne liber după tot restul.
  lines.push(...ordered.filter((need) => need.priority === "buffer").map(toLine));
  const covered = round2(lines.reduce((sum, item) => sum + item.amount, 0));
  return {
    ok: true,
    income,
    cycleStart,
    cycleEnd,
    weeks: cycle.weeks,
    extraDays: cycle.extraDays,
    lines,
    covered,
    free: money,
    // Rezerva de neprevăzute nu e o lipsă: dacă nu încape acum, nu înseamnă că venitul nu ajunge.
    uncovered: round2(lines.filter((item) => item.need.priority !== "buffer").reduce((sum, item) => sum + item.remaining, 0)),
    nextIncome: otherIncomeSoon(data, income, cycleStart, cycleEnd),
    transfers: splitTransfers(lines, income.memberId),
  };
}

/** Cheltuielile plătite de celălalt, acoperite din acest venit: se strâng pe persoană. */
const splitTransfers = (lines: SplitLine[], memberId?: string): SplitTransfer[] => {
  const byMember = new Map<string, SplitTransfer>();
  for (const line of lines) {
    const to = line.need.paidById;
    if (!to || to === memberId || line.amount <= 0) continue;
    const entry = byMember.get(to) || { toMemberId: to, amount: 0, labels: [] };
    entry.amount = round2(entry.amount + line.amount);
    entry.labels.push(line.need.label);
    byMember.set(to, entry);
  }
  return Array.from(byMember.values());
};

/**
 * Plicul unei cheltuieli: cel legat, altul cu același nume, sau unul nou. Un plic legat deja
 * de altă cheltuială nu se refolosește după nume: „Rate” 1.000 și „rate” 500 (două bănci)
 * se suprascriau în același plic și se pierdeau 1.000 de lei.
 */
const envelopeFor = (allocations: BudgetAllocation[], need: MonthlyNeed, needs: MonthlyNeed[] = []): BudgetAllocation | undefined =>
  allocations.find((item) => item.id === need.allocationId)
  || allocations.find((item) => item.label.trim().toLocaleLowerCase("ro-RO") === need.label.trim().toLocaleLowerCase("ro-RO")
    && !needs.some((other) => other.id !== need.id && !other.archived && other.allocationId === item.id));

/**
 * Aplică propunerea: fiecare plic ajunge la ce s-a acoperit în ciclu (venitul de acum plus
 * cele de dinainte), cu urmă în istoric și anulare care pune la loc suma veche. La primul
 * venit al unui ciclu nou, dacă planul a expirat, ciclul pornește din ziua venitului.
 */
export function applyIncomeSplit(data: AppData, incomeId: string): { data: AppData; error?: string } {
  const split = proposeIncomeSplit(data, incomeId);
  if (!split.ok) return { data, error: split.message };
  const plan = data.settings.salaryPlan;
  const now = new Date().toISOString();
  let allocations = [...plan.allocations];
  let needs = [...(plan.needs || [])];
  const lines: SalaryAllocationApplication["allocations"] = [];
  // Toate cheltuielile primesc plic de la primul venit, chiar cu 0 deocamdată: o cursă de
  // taxi făcută înainte de al doilea salariu ajunge în plicul ei, nu în cel de mâncare.
  let plannedEvents = data.settings.plannedEvents || [];
  for (const line of split.lines) {
    if (line.target <= 0) continue;
    if (line.need.id === RARE_ID) {
      // Banii plăților rare merg la evenimentele lor, în proporția a ce cere fiecare în ciclu.
      if (line.amount <= 0) continue;
      const rare = rarePlan(data, split.cycleStart);
      let left = line.amount;
      rare.events.forEach((item, index) => {
        const share = index === rare.events.length - 1 ? left : Math.min(left, round2(line.amount * item.perCycle / rare.total));
        if (share <= 0) return;
        left = round2(left - share);
        const contributionId = newId("event-put");
        plannedEvents = plannedEvents.map((event) => event.id === item.event.id ? addContribution(event, share, split.income.date, t("Din {title}", { title: split.income.title }), contributionId) : event);
        lines.push({ ruleId: `event:${item.event.id}:${contributionId}`, allocationId: RARE_ID, amount: share });
      });
      continue;
    }
    let envelope = envelopeFor(allocations, line.need, needs);
    const created = !envelope;
    if (!envelope) {
      envelope = { id: newId("allocation"), label: line.need.label, amount: 0, category: line.need.category, weeklyPace: line.need.cadence === "weekly", ...(line.perWeek ? { weeklyAmount: line.perWeek } : {}), updatedAt: now };
      allocations = [...allocations, envelope];
    }
    if (line.need.allocationId !== envelope.id) {
      needs = needs.map((item) => item.id === line.need.id ? { ...item, allocationId: envelope!.id, updatedAt: now } : item);
    }
    const next = round2(line.fundedBefore + line.amount);
    const previousAmount = envelope.amount;
    const id = envelope.id;
    if (!created && previousAmount === next && line.amount <= 0) continue;
    // Plicul săptămânal primește și suma pe săptămână: tranșele din Plan sunt exact atât.
    // Cheltuiala trecută pe lunar își pierde tranșele vechi de 100/săpt., altfel o cursă de 150 „depășea săptămâna”.
    allocations = allocations.map((item) => {
      if (item.id !== id) return item;
      if (line.perWeek) return { ...item, amount: next, weeklyAmount: line.perWeek, weeklyPace: true, updatedAt: now };
      if (line.need.cadence === "monthly" && item.weeklyAmount) {
        const { weeklyAmount: _dropped, ...rest } = item;
        void _dropped;
        return { ...rest, amount: next, weeklyPace: false, updatedAt: now };
      }
      return { ...item, amount: next, updatedAt: now };
    });
    lines.push({ ruleId: `need:${line.need.id}`, allocationId: id, amount: line.amount, previousAmount, afterAmount: next, ...(created ? { created: true } : {}) });
  }
  if (!lines.some((item) => item.amount > 0)) return { data, error: t("Nu e nimic de repartizat din acest venit: cheltuielile ciclului sunt deja acoperite.") };
  // Primul venit al unui ciclu nou deschide ciclul, dacă planul vechi s-a încheiat.
  // Salariul poate veni cu câteva zile mai devreme: din prima zi a ferestrei, ciclul vechi s-a încheiat.
  const expired = !plan.nextPayday || addIsoDays(plan.nextPayday, -(plan.paydayFlexDays ?? 3)) <= split.income.date;
  const opensCycle = expired && split.cycleStart === split.income.date;
  const application: SalaryAllocationApplication = {
    id: newId("salary-application"),
    incomeId: split.income.id,
    incomeTitle: split.income.title,
    incomeAmount: split.income.amount,
    sourceId: split.income.sourceId,
    memberId: split.income.memberId,
    appliedAt: now,
    allocations: lines,
    origin: "needs",
    ...(split.transfers.length ? { transfers: split.transfers } : {}),
    ...(opensCycle ? { previousCycle: { periodStart: plan.periodStart, nextPayday: plan.nextPayday, earliestPayday: plan.earliestPayday, paydayFlexDays: plan.paydayFlexDays, transfers: plan.transfers || [], weekTransfers: plan.weekTransfers || [], openedPeriodStart: split.income.date } } : {}),
  };
  // Ciclul nou pornește curat, ca la „Pornește ciclul nou”: mutările între plicuri și între
  // săptămâni erau ale ciclului vechi (altfel Mâncare avea 2.957 cu limita de 2.657).
  const cycle = opensCycle ? { periodStart: split.income.date, nextPayday: split.cycleEnd, earliestPayday: undefined, paydayFlexDays: plan.paydayFlexDays ?? 3, transfers: [], weekTransfers: [] } : {};
  const next: AppData = {
    ...data,
    settings: {
      ...data.settings,
      plannedEvents,
      salaryPlan: {
        ...plan,
        ...cycle,
        allocations,
        needs,
        salaryAllocationApplications: [application, ...(plan.salaryAllocationApplications || [])].slice(0, 80),
        updatedAt: now,
      },
    },
  };
  return {
    data: appendAllocationHistory(next, {
      kind: "income-applied",
      referenceId: application.id,
      allocationLabel: Array.from(new Set(lines.map((item) => item.allocationId === RARE_ID ? t("Plăți rare") : allocations.find((entry) => entry.id === item.allocationId)?.label || ""))).filter(Boolean).join(", "),
      amount: round2(lines.reduce((sum, item) => sum + item.amount, 0)),
      note: t("Repartizare după cheltuielile lunare"),
    }),
  };
}

/** Venitul cel mai recent, nerepartizat, pe care merită propusă repartizarea (fără tichete). */
export function pendingSplitIncome(data: AppData, asOf: string): Transaction | undefined {
  if (!activeNeeds(data).length) return undefined;
  const applied = new Set(activeSalaryApplications(data.settings.salaryPlan).map((item) => item.incomeId));
  const meal = new Set(data.settings.paymentSources.filter((item) => item.kind === "meal").map((item) => item.id));
  return data.transactions
    .filter((item) => item.kind === "income" && !applied.has(item.id) && !meal.has(item.sourceId || "") && item.date >= addIsoDays(asOf, -10) && item.date <= asOf && item.amount >= 200)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

/** Ce presupune familia că intră într-o lună, din veniturile așteptate. */
export const expectedMonthlyIncome = (incomes: ExpectedIncome[]) => round2(incomes.reduce((sum, item) => sum + item.amount, 0));

/** Ce presupun cheltuielile declarate într-o lună obișnuită (săptămânalele × 4,33). */
export const expectedMonthlyNeeds = (needs: MonthlyNeed[]) => round2(needs.reduce((sum, item) => sum + (item.cadence === "weekly" ? reserveOf(item) * 52 / 12 : reserveOf(item)), 0));

/**
 * Propunerea într-un rând, pentru ghid: „Rate bănci 1.400 RON · Lumină 400 RON · Mâncare
 * 1.900 RON din 3.000 RON · rămân 1.600 RON pentru Salariul soției (12 octombrie)”.
 */
export function splitPreviewText(split: Extract<IncomeSplit, { ok: true }>, money: (value: number) => string, date: (iso: string) => string): string {
  const parts = split.lines.filter((line) => line.amount > 0).map((line) => line.amount < line.target - line.fundedBefore
    ? t("{label} {amount} din {target}", { label: line.need.label, amount: money(line.amount), target: money(line.target) })
    : `${line.need.label} ${money(line.amount)}`);
  const tail = split.uncovered > 0
    ? split.nextIncome
      ? t("rămân {amount} pentru {label} ({date})", { amount: money(split.uncovered), label: split.nextIncome.label, date: date(split.nextIncome.date) })
      : t("rămân neacoperiți {amount}", { amount: money(split.uncovered) })
    : split.free > 0 ? t("liberi {amount}", { amount: money(split.free) }) : "";
  return [t("repartizează {amount} după Ce plătim lunar", { amount: money(split.income.amount) }) + ":", parts.join(" · ") + (tail ? ` · ${tail}` : "")].join(" ");
}

export type NeedAdjustment = { need: MonthlyNeed; months: Array<{ month: string; amount: number }>; min: number; max: number; direction: "up" | "down" };

const roundTo10 = (value: number, up: boolean) => (up ? Math.ceil(value / 10) : Math.floor(value / 10)) * 10;

/**
 * Intervalele din „Ce plătim lunar”, verificate cu ce s-a plătit de fapt în ultimele 3 luni
 * întregi: „la lumină ați plătit 320, 350, 380 — pun 320–380?”. Cel puțin două luni cu plăți,
 * iar diferența trebuie să conteze (peste maxim, sau mult sub minim), ca să nu cicălim.
 * Plățile se iau din plicul cheltuielii; pe categorie doar dacă nicio altă cheltuială n-o are.
 */
export function needAdjustments(data: AppData, asOf: string): NeedAdjustment[] {
  const needs = activeNeeds(data);
  const current = asOf.slice(0, 7);
  const months: string[] = [];
  for (let step = 1; step <= 3; step += 1) {
    const date = new Date(Number(current.slice(0, 4)), Number(current.slice(5, 7)) - 1 - step, 1, 12);
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  const out: NeedAdjustment[] = [];
  for (const need of needs) {
    if (need.reviewedMonth === current || need.max <= 0) continue;
    const sharedCategory = needs.some((other) => other.id !== need.id && other.category === need.category);
    const envelopeId = need.allocationId;
    if (!envelopeId && sharedCategory) continue;
    const belongs = (tx: Transaction) => tx.kind === "expense" && (tx.allocationId ? tx.allocationId === envelopeId : !sharedCategory && tx.category === need.category);
    const perMonth = months.map((month) => {
      const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
      const total = data.transactions.filter((tx) => tx.date.startsWith(month) && belongs(tx)).reduce((sum, tx) => sum + tx.amount, 0);
      return { month, amount: round2(need.cadence === "weekly" ? total * 7 / days : total) };
    }).filter((item) => item.amount > 0);
    if (perMonth.length < 2) continue;
    const low = Math.min(...perMonth.map((item) => item.amount));
    const high = Math.max(...perMonth.map((item) => item.amount));
    const up = high > need.max * 1.05;
    const down = high < need.min * 0.85;
    if (!up && !down) continue;
    out.push({ need, months: perMonth.reverse(), min: roundTo10(low, false), max: Math.max(roundTo10(low, false), roundTo10(high, true)), direction: up ? "up" : "down" });
  }
  return out;
}

/**
 * Pare un salariu declarat? Suma cam aceeași (±20%, cel puțin ±300 lei) și ziua în fereastra
 * obișnuită (± zilele de variație plus două). Folosit la extrase și la textul băncii lipit în
 * ghid, ca un „Încasare 4.700 RON” să fie recunoscut drept „Salariul meu”.
 */
export function matchExpectedIncome(data: AppData, income: { amount: number; date: string; memberId?: string }): ExpectedIncome | undefined {
  const flex = (data.settings.salaryPlan.paydayFlexDays ?? 3) + 2;
  const day = Number(income.date.slice(8, 10));
  const gap = (item: ExpectedIncome) => { const raw = Math.abs(item.day - day); return Math.min(raw, 31 - raw); };
  return activeIncomes(data)
    .filter((item) => item.amount > 0 && Math.abs(item.amount - income.amount) <= Math.max(300, item.amount * 0.2) && gap(item) <= flex)
    .filter((item) => !income.memberId || item.memberId === income.memberId || !data.settings.members.some((member) => member.id === income.memberId))
    .sort((a, b) => Math.abs(a.amount - income.amount) - Math.abs(b.amount - income.amount) || gap(a) - gap(b))[0];
}

/** Transferurile propuse la repartizările din ultimele 40 de zile, încă nebifate. */
export function pendingTransfers(data: AppData, asOf: string) {
  const since = addIsoDays(asOf, -40);
  return activeSalaryApplications(data.settings.salaryPlan)
    .filter((item) => item.origin === "needs" && item.appliedAt.slice(0, 10) >= since)
    .flatMap((item) => (item.transfers || []).filter((entry) => !entry.done).map((entry) => ({ applicationId: item.id, incomeTitle: item.incomeTitle, fromMemberId: item.memberId, ...entry })));
}

/** Bifează un transfer ca făcut. Nu e o mișcare în registru: banii rămân ai familiei. */
export function markTransferDone(data: AppData, applicationId: string, toMemberId: string): AppData {
  const plan = data.settings.salaryPlan;
  return { ...data, settings: { ...data.settings, salaryPlan: { ...plan, salaryAllocationApplications: (plan.salaryAllocationApplications || []).map((item) => item.id === applicationId ? { ...item, transfers: (item.transfers || []).map((entry) => entry.toMemberId === toMemberId ? { ...entry, done: true } : entry) } : item), updatedAt: new Date().toISOString() } } };
}
