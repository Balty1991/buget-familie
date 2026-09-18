/**
 * Evenimente viitoare cu cost — Crăciun, Paște, aniversări, început de școală.
 *
 * Cheltuielile care sperie o familie nu sunt cele zilnice, ci cele care se văd
 * de departe și tot ajung surpriză: cadourile de Crăciun, masa de Paște, ziua
 * copilului. Ele nu încap în plicurile ciclului de salariu, fiindcă vin peste
 * el, așa că stau aici: o listă de date calendaristice cu un cost estimat și cu
 * banii puși deoparte până acum.
 *
 * Modulul nu atinge tranzacții, surse sau solduri. „Pun deoparte 200”
 * înseamnă aici o notă de planificare, nu un transfer bancar — exact ca
 * obiectivele de economisire din restul aplicației.
 */
import { t } from "./i18n";

export type PlannedEventKind = "anniversary" | "holiday" | "trip" | "school" | "other";
export type PlannedEventRepeat = "once" | "yearly";
/** Reper mobil: Paștele ortodox cade altă dată în fiecare an, deci nu poate fi rostogolit pe zi și lună. */
export type PlannedEventAnchor = "easter";
/** O sumă pusă deoparte, cu data ei. Jurnal de planificare, nu mișcare în registru. */
export type PlannedEventContribution = { id: string; amount: number; date: string; note?: string };
export type PlannedEvent = {
  id: string;
  name: string;
  /** Data ediției curente. Pentru evenimentele anuale se rostogolește singură după ce trece. */
  date: string;
  /** Cât se așteaptă familia să coste ediția. 0 = încă nu s-a estimat. */
  estimate: number;
  kind: PlannedEventKind;
  repeat: PlannedEventRepeat;
  anchor?: PlannedEventAnchor;
  note?: string;
  memberId?: string;
  contributions?: PlannedEventContribution[];
  updatedAt?: string;
};

const dayMs = 86_400_000;
const atNoon = (value: string) => new Date(`${value}T12:00:00`);
const toIso = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const isIso = (value: string | undefined): value is string => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(atNoon(String(value)).valueOf());

/** Zile calendaristice între două date, inclusiv ziua de început. Aceeași convenție ca în planul salarial. */
export const daysBetween = (from: string, to: string) => {
  if (!isIso(from) || !isIso(to)) return 0;
  return Math.round((atNoon(to).valueOf() - atNoon(from).valueOf()) / dayMs);
};

/**
 * Paștele ortodox, algoritmul lui Meeus pe calendarul iulian, mutat apoi pe cel gregorian.
 * Decalajul nu e fix 13 zile pentru orice an, așa că se calculează din secol — altfel
 * aplicația ar fi arătat data greșită începând din 2100.
 */
export function orthodoxEaster(year: number): string {
  const safeYear = Math.min(2999, Math.max(1900, Math.round(year)));
  const a = safeYear % 4;
  const b = safeYear % 7;
  const c = safeYear % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const julian = new Date(safeYear, month - 1, day, 12);
  const offset = Math.floor(safeYear / 100) - Math.floor(safeYear / 400) - 2;
  julian.setDate(julian.getDate() + offset);
  return toIso(julian);
}

/** Aceeași zi din alt an; 29 februarie cade pe 28 în anii fără bisect, nu pe 1 martie. */
const sameDayInYear = (iso: string, year: number) => {
  const date = atNoon(iso);
  const month = date.getMonth();
  const day = date.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return toIso(new Date(year, month, Math.min(day, lastDay), 12));
};

/** Aceeași sărbătoare în alt an: fie ziua și luna, fie distanța față de Paște. */
const occurrenceInYear = (event: Pick<PlannedEvent, "date" | "anchor">, year: number): string => {
  if (event.anchor !== "easter") return sameDayInYear(event.date, year);
  const offset = daysBetween(orthodoxEaster(atNoon(event.date).getFullYear()), event.date);
  const anchored = atNoon(orthodoxEaster(year));
  anchored.setDate(anchored.getDate() + offset);
  return toIso(anchored);
};

/**
 * Prima ediție din calendar începând cu ziua cerută — proiecție curată, fără bani.
 * O folosesc calendarul și sugestiile; banii puși deoparte rămân legați de ediția
 * scrisă în eveniment, nu de aceasta.
 */
export function nextOccurrence(event: Pick<PlannedEvent, "date" | "repeat" | "anchor">, from: string): string {
  if (!isIso(event.date)) return "";
  if (event.repeat !== "yearly" || !isIso(from) || event.date >= from) return event.date;
  const fromYear = atNoon(from).getFullYear();
  for (let year = fromYear; year <= fromYear + 2; year += 1) {
    const candidate = occurrenceInYear(event, year);
    if (candidate >= from) return candidate;
  }
  return event.date;
}

/** Ediția de după cea scrisă în eveniment. Gol pentru ce se întâmplă o singură dată. */
export function followingOccurrence(event: Pick<PlannedEvent, "date" | "repeat" | "anchor">): string {
  if (event.repeat !== "yearly" || !isIso(event.date)) return "";
  const dayAfter = toIso(new Date(atNoon(event.date).valueOf() + dayMs));
  const next = nextOccurrence(event, dayAfter);
  return next > event.date ? next : "";
}

/**
 * Ediția care pică în luna cerută, pentru calendarul lunar. Un eveniment anual
 * trebuie să se vadă în fiecare decembrie, nu doar în anul în care a fost scris.
 */
export function occurrenceInMonth(event: Pick<PlannedEvent, "date" | "repeat" | "anchor">, year: number, month: number): string {
  if (!isIso(event.date)) return "";
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  if (event.repeat !== "yearly") return event.date.startsWith(prefix) ? event.date : "";
  const candidate = occurrenceInYear(event, year);
  return candidate.startsWith(prefix) ? candidate : "";
}

export const eventSaved = (event: Pick<PlannedEvent, "contributions">) =>
  roundMoney((event.contributions || []).reduce((sum, item) => sum + (Number.isFinite(item.amount) ? Math.max(0, item.amount) : 0), 0));

export type PlannedEventStatus = {
  event: PlannedEvent;
  /** Ediția pe care se strâng banii — data scrisă în eveniment, nu una ghicită. */
  date: string;
  /** Ediția următoare, pentru butonul de închidere a celei curente. */
  following: string;
  daysLeft: number;
  estimate: number;
  saved: number;
  remaining: number;
  /** Cât ar trebui pus deoparte pe săptămână, respectiv pe lună, ca suma să fie gata la timp. */
  perWeek: number;
  perMonth: number;
  /** Banii puși deoparte acoperă estimarea. */
  covered: boolean;
  /** Data a trecut, iar ediția nu a fost închisă. */
  passed: boolean;
};

/**
 * Ritmul se calculează pe zilele rămase, nu pe cele scurse: cine începe să pună
 * deoparte în noiembrie pentru Crăciun trebuie să vadă suma reală a celor șase
 * săptămâni rămase, nu media unui an întreg pe care nu-l mai are.
 *
 * Data nu se rostogolește singură după ce trece. Cei 900 de lei strânși pentru
 * Crăciunul acesta nu sunt și banii Crăciunului următor — probabil au fost deja
 * cheltuiți. Ediția trecută rămâne la vedere până când omul o închide, exact ca o
 * scadență întârziată din „Ce urmează”.
 */
export function plannedEventStatus(event: PlannedEvent, today: string): PlannedEventStatus {
  const date = isIso(event.date) ? event.date : "";
  const estimate = Math.max(0, Number.isFinite(event.estimate) ? event.estimate : 0);
  const saved = eventSaved(event);
  const remaining = roundMoney(Math.max(0, estimate - saved));
  const daysLeft = date ? Math.max(0, daysBetween(today, date)) : 0;
  const pacedDays = Math.max(1, daysLeft);
  return {
    event,
    date,
    following: followingOccurrence(event),
    daysLeft,
    estimate,
    saved,
    remaining,
    perWeek: remaining > 0 ? roundMoney(remaining * 7 / pacedDays) : 0,
    perMonth: remaining > 0 ? roundMoney(remaining * 30 / pacedDays) : 0,
    covered: estimate > 0 && saved >= estimate,
    passed: Boolean(date) && date < today,
  };
}

/** Lista gata de afișat: ediția următoare a fiecărui eveniment, în ordinea datei. */
export function upcomingPlannedEvents(events: PlannedEvent[], today: string, horizonDays = 366): PlannedEventStatus[] {
  return events
    .map((event) => plannedEventStatus(event, today))
    .filter((status) => status.date && (status.passed || status.daysLeft <= horizonDays))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export type PlannedEventsPressure = {
  count: number;
  estimate: number;
  saved: number;
  remaining: number;
  /** Suma lunară care ține toate evenimentele din orizont la zi. */
  perMonth: number;
  perWeek: number;
  next?: PlannedEventStatus;
};

/**
 * Cifra pentru care există tot ecranul: cât trebuie pus deoparte lunar ca niciunul
 * dintre evenimentele următoare să nu ceară bani pe care familia nu-i are. Se adună
 * ritmurile individuale, fiindcă un Crăciun la trei săptămâni distanță cere altceva
 * decât o aniversare de peste opt luni.
 */
export function plannedEventsPressure(events: PlannedEvent[], today: string, horizonDays = 366): PlannedEventsPressure {
  const upcoming = upcomingPlannedEvents(events, today, horizonDays);
  const sum = (pick: (status: PlannedEventStatus) => number) => roundMoney(upcoming.reduce((total, status) => total + pick(status), 0));
  return {
    count: upcoming.length,
    estimate: sum((status) => status.estimate),
    saved: sum((status) => status.saved),
    remaining: sum((status) => status.remaining),
    perMonth: sum((status) => status.perMonth),
    perWeek: sum((status) => status.perWeek),
    next: upcoming[0],
  };
}

/** Pune deoparte o sumă. Întoarce un eveniment nou — nimic nu se modifică pe loc. */
export function addContribution(event: PlannedEvent, amount: number, date: string, note?: string, id?: string): PlannedEvent {
  const value = roundMoney(Math.max(0, Number.isFinite(amount) ? amount : 0));
  if (value <= 0) return event;
  const contribution: PlannedEventContribution = { id: id || `event-put-${Date.now()}-${Math.round(Math.random() * 1e6)}`, amount: value, date: isIso(date) ? date : toIso(new Date()), note: note?.trim() || undefined };
  return { ...event, contributions: [...(event.contributions || []), contribution], updatedAt: new Date().toISOString() };
}

/** Anulează o punere deoparte, fără să atingă restul jurnalului. */
export function removeContribution(event: PlannedEvent, contributionId: string): PlannedEvent {
  const contributions = (event.contributions || []).filter((item) => item.id !== contributionId);
  if (contributions.length === (event.contributions || []).length) return event;
  return { ...event, contributions, updatedAt: new Date().toISOString() };
}

/**
 * Închide ediția și mută evenimentul anual pe cea următoare.
 *
 * Banii puși deoparte pentru ediția închisă nu se reportează: dacă au fost cheltuiți,
 * reportul ar minți despre cât are familia strâns pentru Crăciunul viitor. Cine nu i-a
 * cheltuit îi poate pune la loc dintr-un singur clic, pe ediția nouă.
 */
export function rollPlannedEvent(event: PlannedEvent): PlannedEvent {
  const following = followingOccurrence(event);
  if (!following) return event;
  return { ...event, date: following, contributions: [], updatedAt: new Date().toISOString() };
}

export type PlannedEventSuggestion = { id: string; name: string; date: string; kind: PlannedEventKind; repeat: PlannedEventRepeat; anchor?: PlannedEventAnchor };

/** A câta zi de tipul cerut într-o lună — pentru Vinerea Neagră, care nu are dată fixă. */
const lastWeekdayOfMonth = (year: number, month: number, weekday: number) => {
  const date = new Date(year, month + 1, 0, 12);
  while (date.getDay() !== weekday) date.setDate(date.getDate() - 1);
  return toIso(date);
};

/**
 * Sărbătorile pe care le are oricine în România, cu datele lor reale, ca adăugarea
 * să ceară o singură atingere. Costul rămâne gol: nicio aplicație nu știe cât
 * cheltuiește familia asta de Crăciun, iar o cifră inventată ar fi mai rea decât zero.
 */
export function plannedEventSuggestions(today: string): PlannedEventSuggestion[] {
  const base = isIso(today) ? today : toIso(new Date());
  const year = atNoon(base).getFullYear();
  const fixed = (month: number, day: number) => {
    const thisYear = toIso(new Date(year, month - 1, day, 12));
    return thisYear >= base ? thisYear : toIso(new Date(year + 1, month - 1, day, 12));
  };
  const easter = () => {
    const thisYear = orthodoxEaster(year);
    return thisYear >= base ? thisYear : orthodoxEaster(year + 1);
  };
  const blackFriday = () => {
    const thisYear = lastWeekdayOfMonth(year, 10, 5);
    return thisYear >= base ? thisYear : lastWeekdayOfMonth(year + 1, 10, 5);
  };
  return [
    { id: "suggest-craciun", name: t("Crăciun"), date: fixed(12, 25), kind: "holiday", repeat: "yearly" },
    { id: "suggest-revelion", name: t("Revelion"), date: fixed(12, 31), kind: "holiday", repeat: "yearly" },
    { id: "suggest-paste", name: t("Paște"), date: easter(), kind: "holiday", repeat: "yearly", anchor: "easter" },
    { id: "suggest-8-martie", name: t("8 Martie"), date: fixed(3, 8), kind: "holiday", repeat: "yearly" },
    { id: "suggest-1-iunie", name: t("1 Iunie"), date: fixed(6, 1), kind: "holiday", repeat: "yearly" },
    { id: "suggest-scoala", name: t("Început de școală"), date: fixed(9, 8), kind: "school", repeat: "yearly" },
    { id: "suggest-black-friday", name: t("Vinerea Neagră"), date: blackFriday(), kind: "other", repeat: "yearly" },
  ];
}
