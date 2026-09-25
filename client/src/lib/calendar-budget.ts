/**
 * Ledger Flow — planificare locală a unui venit pe intervale calendaristice reale.
 * Nu atinge surse, tranzacții sau sincronizare; oferă doar ritmul și tranșele de limită pentru confirmare.
 */
export type CalendarBudgetWeek = { index: number; start: string; end: string; days: number; amount: number };
export type CalendarBudget = { total: number; start: string; end: string; days: number; exactWeeks: number; weeklyAmount: number; weeks: CalendarBudgetWeek[] };

const dayMs = 86_400_000;
/**
 * Amiaza UTC, nu a telefonului. Două date civile (YYYY-MM-DD) trebuie să fie
 * la un număr întreg de zile una de alta. La amiază locală, ora de vară
 * scurtează intervalul cu o oră, iar Math.floor pierde o zi din tranșă —
 * în Auckland pe 27 septembrie, în România pe ultima duminică din octombrie.
 */
const atNoon = (value: string) => Date.parse(`${value}T12:00:00Z`);
const toIso = (ms: number) => {
  const value = new Date(ms);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
};
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Tranșele unui plic pe felii de 7 zile. Cu `weekly` (plicul are o sumă pe săptămână, „600”),
 * fiecare săptămână întreagă primește exact atât, în lei întregi, iar ultima tranșă ia restul
 * (fără 541,94 pe săptămână). Fără ea, suma se împarte pe zile, ca până acum.
 */
export function calendarBudget(total: number, start: string, end: string, weekly?: number): CalendarBudget | undefined {
  const first = atNoon(start); const last = atNoon(end); const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  if (!start || !end || Number.isNaN(first) || Number.isNaN(last) || last < first || safeTotal <= 0) return undefined;
  const days = Math.round((last - first) / dayMs) + 1;
  const perWeek = weekly && weekly > 0 ? weekly : undefined;
  const weeklyAmount = perWeek ?? roundMoney(safeTotal * 7 / days);
  const weeks: CalendarBudgetWeek[] = [];
  let cursor = first;
  let distributed = 0;
  while (cursor <= last) {
    const sliceEnd = Math.min(cursor + 6 * dayMs, last);
    const sliceDays = Math.round((sliceEnd - cursor) / dayMs) + 1;
    const amount = sliceEnd === last
      ? roundMoney(Math.max(0, safeTotal - distributed))
      : perWeek
        ? roundMoney(Math.min(Math.round(perWeek * sliceDays / 7), Math.max(0, safeTotal - distributed)))
        : roundMoney(safeTotal * sliceDays / days);
    weeks.push({ index: weeks.length + 1, start: toIso(cursor), end: toIso(sliceEnd), days: sliceDays, amount });
    distributed = roundMoney(distributed + amount); cursor = sliceEnd + dayMs;
  }
  return { total: roundMoney(safeTotal), start, end, days, exactWeeks: days / 7, weeklyAmount, weeks };
}

/**
 * Ritmul pe săptămână întreagă, în ambele sensuri.
 *
 * O familie gândește fie „am 1.800 până la salariu”, fie „vreau 500 pe săptămână”.
 * Perioada are rareori un număr rotund de săptămâni, așa că traducerea se face pe zile:
 * o tranșă de 7 zile primește exact suma săptămânală, iar una scurtă partea ei.
 */
export const periodDays = (start: string, end: string) => {
  const first = atNoon(start); const last = atNoon(end);
  if (!start || !end || Number.isNaN(first) || Number.isNaN(last) || last < first) return 0;
  return Math.round((last - first) / dayMs) + 1;
};

/**
 * Traducerea ritm ⇄ total ține cont de ziua de azi. O perioadă începută miercuri nu mai poate
 * primi bani pe zilele de luni și marți: dacă le-am număra, „500 pe săptămână întreagă” ar cere
 * mai mulți bani decât sunt liberi, iar plicul ar ieși peste disponibil chiar din formular.
 */
const paceFrom = (start: string, today?: string) => (today && today > start ? today : start);

export const totalFromWeeklyPace = (weekly: number, start: string, end: string, today?: string) => {
  const days = periodDays(paceFrom(start, today), end);
  if (!days || !Number.isFinite(weekly) || weekly <= 0) return 0;
  return roundMoney(weekly * days / 7);
};

export const weeklyPaceFromTotal = (total: number, start: string, end: string, today?: string) => {
  const days = periodDays(paceFrom(start, today), end);
  if (!days || !Number.isFinite(total) || total <= 0) return 0;
  return roundMoney(total * 7 / days);
};

export type RemainingPace = { amount: number; daysLeft: number; perDay: number; weekly: number };

/**
 * O singură regulă pentru tot ce ține de ritm: banii rămași, împărțiți egal pe zilele rămase.
 * Din ea ies și recomandarea din formular, și partea tranșei începute de pe cardul plicului,
 * ca cele două să nu spună cifre diferite despre aceeași săptămână.
 */
export const remainingPace = (remaining: number, end: string, today: string): RemainingPace | undefined => {
  const daysLeft = periodDays(today, end);
  if (!daysLeft || !Number.isFinite(remaining) || remaining <= 0) return undefined;
  return { amount: roundMoney(remaining), daysLeft, perDay: roundMoney(remaining / daysLeft), weekly: roundMoney(remaining * 7 / daysLeft) };
};

/**
 * Ce ritm săptămânal încap banii disponibili, socotind doar zilele care au mai rămas.
 * Când perioada e deja începută, zilele trecute nu mai pot fi planificate: dacă le numeri,
 * ritmul iese mai mic decât poate fi ținut în zilele rămase.
 */
export const recommendedWeeklyPace = (available: number, start: string, end: string, today: string) => remainingPace(available, end, paceFrom(start, today))?.weekly ?? 0;

export type StartedWeekShare = { daysTotal: number; daysLeft: number; fair: number; surplus: number; perDay: number };

/**
 * Tranșa care conține ziua de azi e de obicei începută: din cele 7 zile au mai rămas câteva.
 * `fair` e partea care revine zilelor rămase la ritmul egal al perioadei, iar `surplus` e ce
 * prisosește și poate pleca spre săptămânile următoare. Fără cifra asta, o săptămână începută
 * joi arată un buget de șapte zile pentru patru.
 *
 * Partea se socotește pe ritmul întregii perioade, nu doar pe bugetul tranșei: altfel zilele
 * rămase din săptămâna asta ar primi mai puțin pe zi decât cele din săptămânile următoare,
 * fiindcă tranșa începută ar rămâne cu banii unei săptămâni scurte.
 */
export const startedWeekShare = (week: { start: string; end: string; days?: number; amount?: number; budget?: number }, today: string, pace: RemainingPace | undefined): StartedWeekShare | undefined => {
  const amount = week.budget ?? week.amount ?? 0;
  const daysTotal = week.days ?? periodDays(week.start, week.end);
  if (!daysTotal || !pace || today < week.start || today > week.end) return undefined;
  const daysLeft = periodDays(today, week.end);
  const fair = roundMoney(pace.amount * daysLeft / pace.daysLeft);
  return { daysTotal, daysLeft, fair, surplus: roundMoney(Math.max(0, amount - fair)), perDay: pace.perDay };
};

/** Găsește tranșa care conține ziua verificată; folosită pentru un reminder in-app, nu pentru notificare în fundal. */
export const currentCalendarBudgetWeek = (total: number, start: string, end: string, today: string) => calendarBudget(total, start, end)?.weeks.find((week) => today >= week.start && today <= week.end);

/** Cheie stabilă: aceeași tranșă poate declanșa cel mult o alertă locală pe dispozitiv. */
export const calendarBudgetWeekKey = (week: CalendarBudgetWeek) => `${week.start}:${week.end}:${week.index}`;
