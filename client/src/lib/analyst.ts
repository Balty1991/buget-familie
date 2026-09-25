/**
 * Analistul financiar local.
 *
 * Răspunde la întrebări despre banii casei folosind doar registrul de pe telefon:
 * fără rețea, fără cotă, fără așteptare. Fiecare răspuns spune și din ce a fost
 * calculat, ca omul să poată verifica, nu doar să creadă.
 *
 * Nu estimează venituri viitoare și nu inventează cifre: dacă datele nu ajung
 * pentru un răspuns cinstit, spune asta în loc să aproximeze.
 */
import {
  addIsoDays,
  allocationFromText,
  allocationStatus,
  envelopeDecisionStatus,
  expenseCategories,
  foldRomanian,
  formatDate,
  guessCategoryFromText,
  inPlanPeriod,
  isoDate,
  isoToday,
  pendingRecurringInPlan,
  planAllocationMath,
  planEndDate,
  planExpired,
  planForecast,
  sourceBalance,
  type AppData,
  type BudgetAllocation,
  type Transaction,
} from "./finance-data";
import { buildTodaySummary } from "./today-summary";
import { daysLabel } from "./i18n";
import { envelopeUntilPayday, weekDayCap } from "./household-insights";
import { selfMemberOf } from "./member-identity";

export type AnalystRow = { label: string; value: string; hint?: string; share?: number };

export type AnalystAnswer = {
  /** Răspunsul direct, într-o propoziție. */
  headline: string;
  /** Din ce a fost calculat. */
  detail?: string;
  rows?: AnalystRow[];
  /** Întrebări firești de după. */
  followUps?: string[];
  kind: string;
};

const money = (value: number) =>
  `${Number(value.toFixed(2)).toLocaleString("ro-RO", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })} RON`;

const round = (value: number) => Math.round(value * 100) / 100;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Leagă bucăți de frază fără punct dublu și fără literă mică la început de
 * propoziție. `formatDate` întoarce deja „25 sept.”, deci un punct adăugat
 * după el dădea „25 sept..”.
 */
const sentences = (...parts: Array<string | undefined | false>) =>
  parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => {
      const clean = part.trim();
      const capital = clean.charAt(0).toLocaleUpperCase("ro-RO") + clean.slice(1);
      return /[.!?]$/.test(capital) ? capital : `${capital}.`;
    })
    .join(" ");

// ---------------------------------------------------------------- perioade

export type Period = { start: string; end: string; label: string };

const monthStart = (date: Date) => isoDate(new Date(date.getFullYear(), date.getMonth(), 1));
const monthEnd = (date: Date) => isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));

const MONTH_NAMES = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

/** Citește perioada cerută în text. Implicit: luna curentă. */
export function readPeriod(folded: string, asOf: string): Period {
  const base = new Date(`${asOf}T12:00:00`);

  if (/\bazi\b|\bastazi\b/.test(folded)) return { start: asOf, end: asOf, label: "azi" };
  if (/\bieri\b/.test(folded)) {
    const day = new Date(base); day.setDate(base.getDate() - 1);
    return { start: isoDate(day), end: isoDate(day), label: "ieri" };
  }
  if (/saptamana trecuta/.test(folded)) {
    const start = new Date(base); start.setDate(base.getDate() - ((base.getDay() + 6) % 7) - 7);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { start: isoDate(start), end: isoDate(end), label: "săptămâna trecută" };
  }
  if (/saptamana (asta|aceasta|curenta)|in saptamana/.test(folded)) {
    const start = new Date(base); start.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { start: isoDate(start), end: isoDate(end), label: "săptămâna asta" };
  }
  if (/luna trecuta|luna precedenta/.test(folded)) {
    const previous = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    return { start: monthStart(previous), end: monthEnd(previous), label: `luna trecută (${MONTH_NAMES[previous.getMonth()]})` };
  }
  if (/anul (asta|acesta|curent)/.test(folded)) {
    return { start: `${base.getFullYear()}-01-01`, end: `${base.getFullYear()}-12-31`, label: `anul ${base.getFullYear()}` };
  }
  const lastDays = /ultimele (\d{1,3}) zile/.exec(folded);
  if (lastDays) {
    const days = Math.min(730, Math.max(1, Number(lastDays[1])));
    const start = new Date(base); start.setDate(base.getDate() - days + 1);
    return { start: isoDate(start), end: asOf, label: `ultimele ${days} de zile` };
  }
  // „mai” este și lună, și cuvânt obișnuit („cea mai mare”). Cerem deci un semn
  // limpede: „în mai”, „luna mai” sau „mai 2026”.
  const named = MONTH_NAMES.findIndex((name) => new RegExp(`\\b(?:in|din|luna)\\s+${name}\\b|\\b${name}\\s+20\\d\\d\\b`).test(folded));
  if (named >= 0) {
    const year = named > base.getMonth() ? base.getFullYear() - 1 : base.getFullYear();
    const month = new Date(year, named, 1);
    return { start: monthStart(month), end: monthEnd(month), label: `${MONTH_NAMES[named]} ${year}` };
  }
  return { start: monthStart(base), end: monthEnd(base), label: "luna asta" };
}

/** Data pe care planul o așteaptă pentru următorul venit, dacă există. */
const nextPaydayOf = (data: AppData) => data.settings.salaryPlan.nextPayday || data.settings.salaryPlan.earliestPayday || "";

const inPeriod = (item: Transaction, period: Period) => item.date >= period.start && item.date <= period.end;
const expensesIn = (data: AppData, period: Period) => data.transactions.filter((item) => item.kind === "expense" && inPeriod(item, period));
const incomeIn = (data: AppData, period: Period) => data.transactions.filter((item) => item.kind === "income" && inPeriod(item, period));

const totalOf = (items: Transaction[]) => round(items.reduce((sum, item) => sum + item.amount, 0));

const byCategory = (items: Transaction[]) => {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.category, round((totals.get(item.category) || 0) + item.amount));
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
};

/** Perioada de aceeași lungime, imediat înainte — pentru comparații oneste. */
const previousPeriod = (period: Period): Period => {
  const start = new Date(`${period.start}T12:00:00`);
  const end = new Date(`${period.end}T12:00:00`);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const priorEnd = new Date(start); priorEnd.setDate(start.getDate() - 1);
  const priorStart = new Date(priorEnd); priorStart.setDate(priorEnd.getDate() - days + 1);
  return { start: isoDate(priorStart), end: isoDate(priorEnd), label: "perioada dinainte" };
};

const changeLine = (now: number, before: number) => {
  if (before <= 0) return now > 0 ? "nu am cu ce compara: nu există cheltuieli în perioada dinainte" : undefined;
  const diff = round(now - before);
  if (Math.abs(diff) < 0.5) return "cam cât în perioada dinainte";
  const percent = Math.abs(Math.round((diff / before) * 100));
  return `${diff > 0 ? "cu " + money(Math.abs(diff)) + " mai mult" : "cu " + money(Math.abs(diff)) + " mai puțin"} decât în perioada dinainte (${percent}%)`;
};

// ------------------------------------------------------------- recunoaștere

/** Categoria numită pe față în text („pe alimente”). */
function namedCategory(folded: string, data: AppData): string | undefined {
  const all = [...expenseCategories, ...data.settings.customCategories];
  return all.find((name) => folded.includes(foldRomanian(name)));
}

/** Categoria ghicită dintr-un indiciu („benzină” → Transport). */
function guessedCategory(folded: string, data: AppData): string | undefined {
  const all = [...expenseCategories, ...data.settings.customCategories];
  const guessed = guessCategoryFromText(folded, all, data.settings.merchantRules || []);
  return guessed && all.includes(guessed) ? guessed : undefined;
}

/** Categoria despre care întreabă, dacă a numit una. */
function readCategory(folded: string, data: AppData): string | undefined {
  return namedCategory(folded, data) || guessedCategory(folded, data);
}

/**
 * Numele unui magazin sau al unei mișcări, dacă apare în registru.
 *
 * Cu `afterLa`, se caută numai după prepoziția „la”. Limba face deosebirea pe
 * care ghicitorul de categorii n-o poate face: „la Kaufland” este un loc, „pe
 * alimente” este un fel de cheltuială — deși ambele duc la categoria Alimente.
 */
function readVendor(folded: string, data: AppData, afterLa = false): string | undefined {
  const titles = new Map<string, string>();
  for (const item of data.transactions) {
    const key = foldRomanian(item.title).trim();
    if (key.length >= 3) titles.set(key, item.title);
  }
  let best: string | undefined;
  for (const [key, title] of Array.from(titles.entries())) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = afterLa ? new RegExp(`\\bla\\s+${escaped}\\b`) : new RegExp(`\\b${escaped}\\b`);
    if (pattern.test(folded)) {
      if (!best || key.length > foldRomanian(best).length) best = title;
    }
  }
  return best;
}

const firstAmount = (folded: string) => {
  // Ramura cu separatori de mii cere cel puțin un grup („1.500”); altfel „2000”
  // se oprea după trei cifre și devenea 200.
  const match = /(\d{1,3}(?:[ .]\d{3})+(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?)/.exec(folded);
  if (!match) return undefined;
  const value = Number(match[1].replace(/[ .](?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
};

// ----------------------------------------------------------------- răspunsuri

/**
 * Cine a cheltuit. Într-o aplicație de familie, „cât a cheltuit soția luna asta?”
 * este una dintre primele întrebări — și până acum nu o înțelegea nimeni.
 * Se recunoaște după numele scris în Setări sau după felul în care vorbește omul
 * despre celălalt.
 */
function readMember(data: AppData, folded: string): { id: string; name: string } | undefined {
  for (const member of data.settings.members) {
    const name = foldRomanian(member.name);
    if (name.length >= 3 && folded.includes(name)) return { id: member.id, name: member.name };
  }
  const second = data.settings.members[1];
  const first = data.settings.members[0];
  if (/\b(sotia|sotiei|nevasta|partenera)\b/.test(folded) && second) return { id: second.id, name: second.name };
  if (/\b(sotul|sotului|barbatul|partenerul)\b/.test(folded) && first) return { id: first.id, name: first.name };
  const self = selfMemberOf(data) || first;
  if (/\b(eu|mine|meu|mea)\b/.test(folded) && self) return { id: self.id, name: self.name };
  return undefined;
}

/** Întrebarea numește o persoană? Folosit ca să nu răspundem despre toți când s-a întrebat despre unul. */
const mentionsSomeone = (folded: string) =>
  /\b(sotia|sotiei|nevasta|partenera|sotul|sotului|barbatul|partenerul|copilul|fiul|fiica)\b/.test(folded);

const noSuchMember = (data: AppData, folded: string): AnalystAnswer | undefined => {
  if (!mentionsSomeone(folded)) return undefined;
  const names = data.settings.members.map((item) => item.name);
  return {
    kind: "spend",
    headline: names.length > 1
      ? `Nu recunosc persoana din întrebare. În familie am ${names.join(" și ")}.`
      : `Deocamdată ești singur în familie, ca ${names[0] || "membru"}.`,
    detail: sentences("Poți adăuga membri din Setări, iar de atunci pot răspunde separat pentru fiecare"),
    followUps: ["Cât am cheltuit luna asta?", "Unde se duc banii?"],
  };
};

function answerSpend(data: AppData, folded: string, asOf: string): AnalystAnswer {
  const period = readPeriod(folded, asOf);
  /**
   * Ordinea nu e întâmplătoare. Un magazin scris în registru este mai precis decât
   * o categorie ghicită: „cât am dat la Kaufland” întreabă de magazin, chiar dacă
   * ghicitorul de categorii îl trece la Alimente. O categorie numită pe față bate
   * însă orice: „cât am dat pe alimente” întreabă de categorie.
   */
  const named = namedCategory(folded, data);
  const placeNamed = named ? undefined : readVendor(folded, data, true);
  const guessed = named || placeNamed ? undefined : guessedCategory(folded, data);
  const vendor = placeNamed || (named || guessed ? undefined : readVendor(folded, data));
  const category = named || guessed;

  const member = readMember(data, folded);
  if (!member) {
    const missing = noSuchMember(data, folded);
    if (missing) return missing;
  }

  let items = expensesIn(data, period);
  if (member) items = items.filter((item) => item.memberId === member.id);
  let subject = "";
  if (category) { items = items.filter((item) => item.category === category); subject = ` pe ${category}`; }
  else if (vendor) { items = items.filter((item) => foldRomanian(item.title) === foldRomanian(vendor)); subject = ` la ${vendor}`; }
  if (member) subject += `, ${member.name}`;

  const total = totalOf(items);
  if (!items.length) {
    return {
      kind: "spend",
      headline: `Nicio cheltuială${subject} în ${period.label}.`,
      detail: sentences(`Am căutat între ${formatDate(period.start)} și ${formatDate(period.end)}`),
      followUps: ["Unde se duc banii?", "Cât am cheltuit luna trecută?"],
    };
  }

  const prior = previousPeriod(period);
  let priorItems = expensesIn(data, prior);
  if (member) priorItems = priorItems.filter((item) => item.memberId === member.id);
  if (category) priorItems = priorItems.filter((item) => item.category === category);
  else if (vendor) priorItems = priorItems.filter((item) => foldRomanian(item.title) === foldRomanian(vendor));
  const change = changeLine(total, totalOf(priorItems));

  const days = Math.max(1, Math.round((new Date(`${period.end}T12:00:00`).getTime() - new Date(`${period.start}T12:00:00`).getTime()) / 86400000) + 1);
  const rows: AnalystRow[] = (category || vendor)
    ? [...items].sort((a, b) => b.amount - a.amount).slice(0, 6).map((item) => ({ label: item.title, value: money(item.amount), hint: formatDate(item.date) }))
    : byCategory(items).slice(0, 6).map(([name, value]) => ({ label: name, value: money(value), share: total > 0 ? value / total : 0 }));

  return {
    kind: "spend",
    headline: sentences(`${money(total)}${subject} în ${period.label}`),
    detail: sentences(`${plural(items.length, "mișcare", "mișcări")}, adică ${money(round(total / days))} pe zi în medie`, change),
    rows,
    followUps: category ? ["Unde se duc banii?", `Cât am cheltuit pe ${category} luna trecută?`] : ["Care e cea mai mare cheltuială?", "Cât mai am până la salariu?"],
  };
}

function answerWhere(data: AppData, folded: string, asOf: string): AnalystAnswer {
  const period = readPeriod(folded, asOf);
  const member = readMember(data, folded);
  if (!member) {
    const missing = noSuchMember(data, folded);
    if (missing) return { ...missing, kind: "where" };
  }
  const items = member ? expensesIn(data, period).filter((item) => item.memberId === member.id) : expensesIn(data, period);
  const total = totalOf(items);
  if (!total) {
    return { kind: "where", headline: `Nu există cheltuieli${member ? ` pe numele lui ${member.name}` : ""} în ${period.label}.`, followUps: ["Cât am cheltuit luna trecută?"] };
  }
  const categories = byCategory(items);
  const [topName, topValue] = categories[0];
  const prior = expensesIn(data, previousPeriod(period));
  const priorByCategory = new Map(byCategory(prior));

  const rows = categories.slice(0, 7).map(([name, value]) => {
    const before = priorByCategory.get(name) || 0;
    const delta = before > 0 ? round(value - before) : undefined;
    return {
      label: name,
      value: money(value),
      share: value / total,
      hint: delta === undefined ? undefined : Math.abs(delta) < 0.5 ? "neschimbat" : `${delta > 0 ? "+" : "−"}${money(Math.abs(delta))}`,
    };
  });

  return {
    kind: "where",
    headline: `${topName} ia cea mai mare parte: ${money(topValue)} din ${money(total)} (${Math.round((topValue / total) * 100)}%).`,
    detail: `${period.label}, ${plural(items.length, "mișcare", "mișcări")} pe ${plural(categories.length, "categorie", "categorii")}. Semnul de lângă fiecare arată diferența față de perioada dinainte.`,
    rows,
    followUps: [`Cât am cheltuit pe ${topName}?`, "Care e cea mai mare cheltuială?"],
  };
}

function answerBiggest(data: AppData, folded: string, asOf: string): AnalystAnswer {
  const period = readPeriod(folded, asOf);
  const items = [...expensesIn(data, period)].sort((a, b) => b.amount - a.amount);
  if (!items.length) return { kind: "biggest", headline: `Nu există cheltuieli în ${period.label}.` };
  const top = items[0];
  return {
    kind: "biggest",
    headline: sentences(`Cea mai mare: ${top.title}, ${money(top.amount)}, pe ${formatDate(top.date)}`),
    detail: sentences(`Din ${plural(items.length, "mișcare", "mișcări")} în ${period.label}`, `Categoria: ${top.category}`),
    rows: items.slice(0, 5).map((item) => ({ label: item.title, value: money(item.amount), hint: `${formatDate(item.date)} · ${item.category}` })),
    followUps: ["Unde se duc banii?"],
  };
}

function answerAfford(data: AppData, folded: string, asOf: string): AnalystAnswer {
  if (planExpired(data.settings.salaryPlan, asOf)) return answerCycleEnded(data, "afford");
  const amount = firstAmount(folded);
  const free = round(planAllocationMath(data).unrepartized);

  if (amount === undefined) {
    return {
      kind: "afford",
      headline: free > 0 ? `Ai ${money(free)} nerepartizați până la următorul venit.` : "Nu mai ai bani nerepartizați până la următorul venit.",
      detail: "Spune-mi și suma („îmi permit 400 de lei?”) ca să-ți răspund direct.",
      followUps: ["Cât pot cheltui pe zi?"],
    };
  }

  const category = readCategory(folded, data);
  const envelope = category
    ? data.settings.salaryPlan.allocations.find((item) => (item.category || item.label) === category)
    : undefined;

  if (envelope) {
    const status = envelopeDecisionStatus(data, envelope, asOf);
    const after = round(status.remaining - amount);
    const scopeNote = status.scope === "week" && status.weekIndex
      ? `Tranșa S${status.weekIndex} a plicului`
      : "Plicul";
    return {
      kind: "afford",
      headline: after >= 0
        ? `Da. În plicul „${envelope.label}” rămân ${money(after)} după.`
        : `Nu din plic: „${envelope.label}” are ${money(Math.max(0, status.remaining))} și ar ieși ${money(Math.abs(after))} peste.`,
      detail: `${scopeNote} are ${money(status.budget)}, s-au consumat ${money(status.spent)}. Nerepartizat în plan: ${money(free)}.`,
      rows: [
        { label: "În plic acum", value: money(Math.max(0, status.remaining)) },
        { label: "După cheltuială", value: money(after) },
        { label: "Nerepartizat în plan", value: money(free) },
      ],
      followUps: ["Cât pot cheltui pe zi?", "Unde se duc banii?"],
    };
  }

  const payday = nextPaydayOf(data);
  const after = round(free - amount);
  /**
   * „Încape” nu e totuna cu „îți permiți”: fără plicuri pentru ziua de zi cu zi, banii
   * nerepartizați sunt chiar banii de mâncare. Andrei ar fi rămas cu 50 de lei pentru
   * 12 zile după mașina de spălat, iar ghidul spunea „Da” (testare cu utilizatori).
   */
  const math = planAllocationMath(data);
  const forecast = planForecast(data, asOf);
  const daysLeft = Math.max(1, forecast.remainingDays);
  const perDayAfter = round(after / daysLeft);
  const floor = Math.max(30, round(forecast.paceDaily * 0.8));
  const tight = after >= 0 && Boolean(payday) && daysLeft > 1 && math.reservedInEnvelopes < 1 && perDayAfter < floor;
  return {
    kind: "afford",
    headline: tight
      ? `Încape, dar îți rămân ${money(after)} pentru ${daysLeft} zile, cam ${money(perDayAfter)} pe zi până la venit.`
      : after >= 0
      ? `Da. Rămân ${money(after)} nerepartizați până la următorul venit.`
      : `Ar ieși ${money(Math.abs(after))} peste ce ai nerepartizat.`,
    detail: tight
      ? sentences(`Nu ai plicuri pentru mâncare și cele de zi cu zi, deci banii aceștia trebuie să le acopere și pe ele`, `Dacă o poți amâna după ${formatDate(payday!)}, e mai sigur`)
      : payday
      ? sentences(`Calculat până pe ${formatDate(payday)}, după ce se scad plicurile și scadențele rezervate`)
      : "Nu ai stabilit data următorului venit, deci calculul se oprește la banii din surse.",
    rows: [
      { label: "Nerepartizat acum", value: money(free) },
      { label: "După cheltuială", value: money(after) },
    ],
    followUps: ["Cât pot cheltui pe zi?"],
  };
}

/**
 * Răspunsul pe care îl dă un ciclu expirat: niciunul din cifre, fiindcă toate s-ar calcula
 * pe zile care au trecut. „Poți cheltui 1.900 pe zi până pe 14 sept.” era cel mai periculos
 * lucru pe care îl putea spune aplicația — un ritm uriaș, sprijinit pe o fereastră moartă.
 */
function answerCycleEnded(data: AppData, kind: string): AnalystAnswer {
  const end = planEndDate(data.settings.salaryPlan);
  return {
    kind,
    headline: sentences(`Ciclul s-a încheiat pe ${formatDate(end)}, deci n-am pe ce zile să calculez`),
    detail: "Spune-mi când vine următorul venit — „salariul vine pe 9 octombrie” — sau deschide Plan, și îți dau iar ritmul zilei și tranșele.",
    followUps: ["Cum stau cu banii?", "Ce cheltuieli am avut luna asta?"],
  };
}

function answerPace(data: AppData, asOf: string): AnalystAnswer {
  if (planExpired(data.settings.salaryPlan, asOf)) return answerCycleEnded(data, "pace");
  const payday = nextPaydayOf(data);
  if (!payday) {
    return {
      kind: "pace",
      headline: "Nu pot calcula un ritm fără data următorului venit.",
      detail: "Spune-mi când vine salariul („salariul vine pe 25”) și îți spun cât poți cheltui pe zi.",
    };
  }
  const summary = buildTodaySummary(data, asOf);
  const free = round(planAllocationMath(data).unrepartized);
  if (summary.overPlan) {
    return {
      kind: "pace",
      headline: `Azi nu mai ai bani liberi: planul e peste bani cu ${money(round(summary.heroValue))}.`,
      detail: sentences("Plicurile au mai mulți lei decât sunt pe carduri și în cash", "Micșorează un plic sau notează banii care au intrat, apoi îți spun din nou cât poți cheltui pe zi"),
      rows: [{ label: "Azi", value: money(0) }, { label: "Lipsesc", value: money(round(summary.heroValue)) }, { label: "Nerepartizat", value: money(free) }],
      followUps: ["Unde se duc banii?"],
    };
  }
  const spendable = round(summary.canSpendToday);
  const forecast = planForecast(data, asOf);
  // Ritmul de zi cu zi, fără rate și facturi: media cu chiria inclusă „certa” fără motiv.
  const pace = round(forecast.dayToDayPace);
  const verdict = pace <= 0 ? "Încă nu ai cheltuit nimic în perioada asta."
    : pace <= spendable * 0.85 ? "Ești sub ritmul de azi."
    : pace <= spendable * 1.05 ? "Ești fix pe ritmul de azi."
    : "Ești peste ritmul de azi.";
  return {
    kind: "pace",
    headline: `Poți folosi azi ${money(Math.max(0, spendable))}, la fel ca pe Astăzi.`,
    detail: sentences(summary.heroHint, verdict, pace > 0 ? `Până acum ai cheltuit în medie ${money(pace)} pe zi în acest ciclu, fără rate și facturi` : ""),
    rows: [
      { label: "Azi", value: `${money(Math.max(0, spendable))}` },
      { label: "Ritmul tău", value: `${money(Math.max(0, pace))}/zi` },
      // Cu plicuri pe săptămâni, cifra de azi e a săptămânii; „ritmul sigur” pe tot ciclul (cu banii nerepartizați) ar contrazice-o.
      ...(!summary.heroTracksWeek && Math.abs(round(forecast.safeDaily) - spendable) > 1 ? [{ label: "Ritm sigur până la venit", value: `${money(Math.max(0, round(forecast.safeDaily)))}/zi` }] : []),
      { label: "Nerepartizat", value: money(free) },
    ],
    followUps: ["Unde se duc banii?", "Îmi permit 200 de lei?"],
  };
}

function answerRemaining(data: AppData, asOf: string): AnalystAnswer {
  const payday = nextPaydayOf(data);
  const envelopes = data.settings.salaryPlan.allocations.map((item) => ({ item, ...envelopeDecisionStatus(data, item, asOf) }));
  const sources = data.settings.paymentSources.map((item) => ({ item, balance: round(sourceBalance(data, item.id)) }));
  const inSources = round(sources.reduce((sum, entry) => sum + entry.balance, 0));

  const rows: AnalystRow[] = [
    ...envelopes.map((entry) => ({
      label: entry.item.label,
      value: money(Math.max(0, entry.remaining)),
      hint: [
        entry.scope === "week" && entry.weekIndex ? `S${entry.weekIndex}` : undefined,
        entry.state === "over" ? "depășit" : entry.state === "watch" ? "aproape de limită" : undefined,
      ].filter(Boolean).join(" · ") || undefined,
    })),
    ...sources.map((entry) => ({ label: `Sold · ${entry.item.name}`, value: money(entry.balance) })),
  ];

  return {
    kind: "remaining",
    headline: envelopes.length
      ? `${money(round(envelopes.reduce((sum, entry) => sum + Math.max(0, entry.remaining), 0)))} rămași în plicuri, ${money(inSources)} în surse.`
      : `${money(inSources)} în surse. Nu ai încă plicuri.`,
    detail: payday ? sentences(`Următorul venit: ${formatDate(payday)}`) : "Nu ai stabilit data următorului venit.",
    rows,
    followUps: ["Ce fac azi?", "Cât pot cheltui pe zi?", "Unde se duc banii?"],
  };
}

function answerSubscriptions(data: AppData): AnalystAnswer {
  const active = data.recurring.filter((item) => item.active);
  if (!active.length) {
    return { kind: "subscriptions", headline: "Nu ai scadențe înregistrate.", detail: "Adaugă facturile și abonamentele ca să-ți spun cât îți iau lunar." };
  }
  const total = round(active.reduce((sum, item) => sum + item.amount, 0));
  return {
    kind: "subscriptions",
    headline: sentences(`${money(total)} pe lună în ${plural(active.length, "scadență", "scadențe")}, adică ${money(round(total * 12))} pe an`),
    rows: [...active].sort((a, b) => b.amount - a.amount).map((item) => ({ label: item.name, value: money(item.amount), hint: `pe data de ${item.dueDay}` })),
    followUps: ["Cât mai am de plătit la datorii?"],
  };
}

function answerDebts(data: AppData): AnalystAnswer {
  if (!data.debts.length) return { kind: "debts", headline: "Nu ai datorii înregistrate." };
  const total = round(data.debts.reduce((sum, item) => sum + Math.max(0, item.remaining), 0));
  const monthly = round(data.debts.reduce((sum, item) => sum + Math.max(0, item.monthly || 0), 0));
  const months = monthly > 0 ? Math.ceil(total / monthly) : undefined;
  return {
    kind: "debts",
    headline: `${money(total)} de plătit, ${money(monthly)} pe lună.`,
    detail: months ? sentences(`La ritmul actual, aproximativ ${plural(months, "lună", "luni")} — fără dobânzi viitoare, doar din soldurile înregistrate`) : "Nu ai trecut rate lunare, deci nu pot estima durata.",
    rows: [...data.debts].sort((a, b) => b.remaining - a.remaining).map((item) => ({ label: item.name, value: money(item.remaining), hint: item.monthly ? `${money(item.monthly)}/lună` : undefined })),
    followUps: ["Cât plătesc pe abonamente?"],
  };
}

function answerSavings(data: AppData): AnalystAnswer {
  if (!data.savings.length) return { kind: "savings", headline: "Nu ai obiective de economisire." };
  const current = round(data.savings.reduce((sum, item) => sum + Math.max(0, item.current), 0));
  const target = round(data.savings.reduce((sum, item) => sum + Math.max(0, item.target), 0));
  return {
    kind: "savings",
    headline: `${money(current)} strânși din ${money(target)} (${target > 0 ? Math.round((current / target) * 100) : 0}%).`,
    rows: data.savings.map((item) => ({ label: item.name, value: `${money(item.current)} / ${money(item.target)}`, share: item.target > 0 ? item.current / item.target : 0 })),
  };
}

function answerPayday(data: AppData, asOf: string): AnalystAnswer {
  if (planExpired(data.settings.salaryPlan, asOf)) return answerCycleEnded(data, "payday");
  const plan = data.settings.salaryPlan;
  const payday = plan.nextPayday || plan.earliestPayday;
  if (!payday) return { kind: "payday", headline: "Nu ai stabilit data următorului venit." };
  const days = Math.round((new Date(`${payday}T12:00:00`).getTime() - new Date(`${asOf}T12:00:00`).getTime()) / 86400000);
  return {
    kind: "payday",
    headline: sentences(days <= 0 ? `Salariul era așteptat pe ${formatDate(payday, { day: "numeric", month: "long" })}` : `Mai sunt ${daysLabel(days)} până la salariu (~${formatDate(payday, { day: "numeric", month: "long" })})`, (plan.paydayFlexDays ?? 0) > 0 && days > 0 ? `Poate varia cu ± ${daysLabel(plan.paydayFlexDays ?? 0)}` : ""),
    detail: sentences(`Nerepartizat, la fel ca în Plan: ${money(round(planAllocationMath(data).unrepartized))}`),
    followUps: ["Cât pot cheltui pe zi?"],
  };
}

function answerCompare(data: AppData, folded: string, asOf: string): AnalystAnswer {
  const period = readPeriod(folded, asOf);
  const prior = previousPeriod(period);
  const now = totalOf(expensesIn(data, period));
  const before = totalOf(expensesIn(data, prior));
  const nowIncome = totalOf(incomeIn(data, period));

  if (!now && !before) return { kind: "compare", headline: "Nu am cheltuieli de comparat în perioadele astea." };

  const nowCats = new Map<string, number>(byCategory(expensesIn(data, period)));
  const beforeCats = new Map<string, number>(byCategory(expensesIn(data, prior)));
  const names = Array.from(new Set<string>([...Array.from(nowCats.keys()), ...Array.from(beforeCats.keys())]));
  const moves = names
    .map((name) => ({ name, delta: round((nowCats.get(name) || 0) - (beforeCats.get(name) || 0)) }))
    .filter((entry) => Math.abs(entry.delta) >= 1)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    kind: "compare",
    headline: sentences(changeLine(now, before) ? `${money(now)} în ${period.label}, ${changeLine(now, before)}` : `${money(now)} în ${period.label}`),
    detail: sentences(`Venituri înregistrate în perioadă: ${money(nowIncome)}`, `Comparația se face cu intervalul de aceeași lungime dinainte (${formatDate(prior.start)} – ${formatDate(prior.end)})`),
    rows: moves.slice(0, 6).map((entry) => ({ label: entry.name, value: `${entry.delta > 0 ? "+" : "−"}${money(Math.abs(entry.delta))}`, hint: entry.delta > 0 ? "mai mult" : "mai puțin" })),
    followUps: ["Unde se duc banii?", "Am cheltuit prea mult?", "Ce fac azi?"],
  };
}

/**
 * Briefingul zilei: o acțiune, nu un raport. Ordinea e cea a casei — plic depășit,
 * scadență aproape, ritm peste sigur — nu a unei liste fixe de întrebări.
 */
function answerNext(data: AppData, asOf: string): AnalystAnswer {
  const empty = !data.transactions.length && !data.settings.salaryPlan.allocations.length && !data.recurring.length;
  if (empty) {
    return {
      kind: "next",
      headline: "Hai să punem prima cifră în registru: un venit sau o cheltuială.",
      detail: "Fără mișcări nu am din ce să-ți spun ce merită azi. Scrie, de exemplu, «salariul meu e 5000» sau «am dat 50 pe benzină».",
      followUps: ["Cât mai am?", "Cât pot cheltui pe zi?"],
    };
  }

  const forecast = planForecast(data, asOf);
  const payday = nextPaydayOf(data);
  const envelopes = data.settings.salaryPlan.allocations.map((item) => ({ item, ...envelopeDecisionStatus(data, item, asOf) }));
  const over = envelopes.filter((entry) => entry.state === "over");
  const watch = envelopes.filter((entry) => entry.state === "watch");
  const horizon = addIsoDays(asOf, 7);
  const dues = pendingRecurringInPlan(data).filter((item) => item.dueDate <= horizon).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const summary = buildTodaySummary(data, asOf);
  const spendable = round(summary.canSpendToday);
  const free = round(planAllocationMath(data).unrepartized);
  const pace = round(forecast.dayToDayPace);
  const safe = round(forecast.safeDaily);

  const rows: AnalystRow[] = [];
  const actions: string[] = [];

  if (over.length) {
    const first = over[0];
    actions.push(`oprește «${first.item.label}»: e depășit cu ${money(Math.abs(first.remaining))}`);
    rows.push({ label: first.item.label, value: money(first.remaining), hint: first.scope === "week" && first.weekIndex ? `S${first.weekIndex} · depășit` : "depășit" });
  }
  if (dues.length) {
    const first = dues[0];
    const days = Math.round((Date.parse(`${first.dueDate}T12:00:00`) - Date.parse(`${asOf}T12:00:00`)) / 86400000);
    const when = days <= 0 ? "azi" : days === 1 ? "mâine" : `în ${plural(days, "zi", "zile")}`;
    actions.push(`scadența «${first.name}» ${when}, ${money(first.amount)}`);
    rows.push({ label: first.name, value: money(first.amount), hint: formatDate(first.dueDate) });
  }
  if (payday && pace > safe * 1.05 && safe >= 0 && pace > 0) {
    actions.push(`ritmul e ${money(pace)}/zi, peste ${money(Math.max(0, safe))} sigur`);
    rows.push({ label: "Ritm", value: `${money(pace)}/zi`, hint: "peste ritmul sigur" });
  }
  if (watch.length && !over.length) {
    const first = watch[0];
    actions.push(`atenție la «${first.item.label}»: ${money(Math.max(0, first.remaining))} rămași`);
    rows.push({
      label: first.item.label,
      value: money(Math.max(0, first.remaining)),
      hint: first.scope === "week" && first.weekIndex ? `S${first.weekIndex}` : "aproape de limită",
    });
  }

  if (!actions.length) {
    return {
      kind: "next",
      headline: payday
        ? sentences(`Poți folosi azi ${money(Math.max(0, spendable))}, la fel ca pe Astăzi`, free > 0 ? `nerepartizat ${money(free)}` : "nu mai e marjă în plan")
        : "Setează data următorului venit ca să-ți spun ce merită azi.",
      detail: sentences(
        envelopes.length ? `${plural(envelopes.filter((entry) => entry.state === "healthy").length, "plic în ritm", "plicuri în ritm")}` : "Nu ai încă plicuri",
        dues.length ? undefined : "Nicio scadență în 7 zile",
      ),
      rows: envelopes.slice(0, 5).map((entry) => ({
        label: entry.item.label,
        value: money(Math.max(0, entry.remaining)),
        hint: entry.scope === "week" && entry.weekIndex ? `S${entry.weekIndex}` : undefined,
      })),
      followUps: ["Cât pot cheltui pe zi?", "Unde se duc banii?", "Îmi permit 200 de lei?"],
    };
  }

  return {
    kind: "next",
    headline: sentences(`Azi: ${actions[0]}`),
    // Aceeași cifră ca pe Astăzi: ritmul pe tot ciclul (planForecast) contrazicea „Poți folosi azi” (plicul săptămânii).
    detail: sentences(actions.slice(1).join("; ") || (payday ? `Poți folosi azi ${money(Math.max(0, spendable))}, la fel ca pe Astăzi` : undefined)),
    rows: rows.slice(0, 6),
    followUps: ["Cât pot cheltui pe zi?", "Unde se duc banii?", "Cât mai am?"],
  };
}

/** «Am cheltuit prea mult?» — compară perioada cerută cu intervalul de aceeași lungime dinainte. */
function answerUnusual(data: AppData, folded: string, asOf: string): AnalystAnswer {
  const period = readPeriod(folded, asOf);
  const prior = previousPeriod(period);
  const category = readCategory(folded, data);
  let items = expensesIn(data, period);
  let priorItems = expensesIn(data, prior);
  if (category) {
    items = items.filter((item) => item.category === category);
    priorItems = priorItems.filter((item) => item.category === category);
  }
  const now = totalOf(items);
  const before = totalOf(priorItems);
  const subject = category ? ` pe ${category}` : "";

  if (!now && !before) {
    return { kind: "unusual", headline: `Nu am cheltuieli${subject} de comparat în ${period.label}.`, followUps: ["Cât am cheltuit luna asta?"] };
  }
  if (before <= 0) {
    return {
      kind: "unusual",
      headline: sentences(`${money(now)}${subject} în ${period.label}`, "nu am perioada dinainte ca să zic dacă e neobișnuit"),
      followUps: ["Unde se duc banii?"],
    };
  }

  const percent = Math.abs(Math.round(((now - before) / before) * 100));
  const high = now >= before * 1.25;
  const normal = now <= before * 1.08;

  const headline = category
    ? high
      ? `Da: ${category} e cu ${percent}% peste perioada dinainte (${money(now)} vs ${money(before)}).`
      : normal
        ? `Nu: ${category} e în ritm, ${money(now)} față de ${money(before)}.`
        : `${category} e cu ${percent}% peste perioada dinainte, dar nu e o săritură mare.`
    : high
      ? `Da, ai cheltuit cu ${percent}% mai mult decât în perioada dinainte: ${money(now)} față de ${money(before)}.`
      : normal
        ? `Nu, e în ritm: ${money(now)} față de ${money(before)} în perioada dinainte.`
        : `Un pic peste: ${money(now)}, cu ${percent}% mai mult decât ${money(before)}.`;

  const jumps = (() => {
    const beforeCats = new Map(byCategory(expensesIn(data, prior)));
    return byCategory(expensesIn(data, period))
      .map(([name, value]) => ({ name, value, prev: beforeCats.get(name) || 0, delta: round(value - (beforeCats.get(name) || 0)) }))
      .filter((entry) => entry.prev > 0 && entry.value > entry.prev * 1.25)
      .sort((a, b) => b.delta - a.delta);
  })();

  const jumpNote = !category && jumps[0] ? `${jumps[0].name} a crescut cel mai tare (+${money(jumps[0].delta)})` : undefined;
  const rows: AnalystRow[] = category
    ? [...items].sort((a, b) => b.amount - a.amount).slice(0, 5).map((item) => ({ label: item.title, value: money(item.amount), hint: formatDate(item.date) }))
    : (jumps.length ? jumps : byCategory(items).map(([name, value]) => ({ name, value, delta: 0 }))).slice(0, 5).map((entry) => ({
      label: entry.name,
      value: money(entry.value),
      hint: entry.delta ? `+${money(entry.delta)}` : undefined,
    }));

  return {
    kind: "unusual",
    headline: sentences(headline),
    detail: sentences(changeLine(now, before), jumpNote, `Comparația e cu intervalul ${formatDate(prior.start)} – ${formatDate(prior.end)}`),
    rows,
    followUps: ["Unde se duc banii?", "Compară cu luna trecută", "Ce fac azi?"],
  };
}

/** «Cine a cheltuit mai mult?» — compară membrii familiei pe perioada cerută. */
function answerWho(data: AppData, folded: string, asOf: string): AnalystAnswer {
  const period = readPeriod(folded, asOf);
  const members = data.settings.members;
  if (members.length < 2) {
    return {
      kind: "who",
      headline: `Deocamdată ești singur în familie, ca ${members[0]?.name || "membru"}.`,
      detail: "Adaugă membri din Setări ca să compar cheltuielile între voi.",
      followUps: ["Cât am cheltuit luna asta?"],
    };
  }
  const ranked = members.map((member) => {
    const items = expensesIn(data, period).filter((item) => item.memberId === member.id);
    return { member, items, total: totalOf(items) };
  }).sort((a, b) => b.total - a.total);
  const familyTotal = round(ranked.reduce((sum, entry) => sum + entry.total, 0));
  const top = ranked[0];
  const second = ranked[1];
  if (top.total <= 0) {
    return { kind: "who", headline: `Nimeni n-a cheltuit în ${period.label}.`, followUps: ["Cât am cheltuit luna trecută?"] };
  }
  const tied = second && Math.abs(top.total - second.total) < 0.5;
  return {
    kind: "who",
    headline: tied
      ? sentences(`${top.member.name} și ${second.member.name} au cheltuit la fel în ${period.label}: ${money(top.total)}`)
      : sentences(`${top.member.name} a cheltuit mai mult în ${period.label}: ${money(top.total)}, față de ${second.member.name} cu ${money(second.total)}`),
    detail: sentences(`${plural(top.items.length, "mișcare", "mișcări")} pe numele lui ${top.member.name}`, familyTotal > 0 ? `${Math.round((top.total / familyTotal) * 100)}% din cheltuielile familiei` : undefined),
    rows: ranked.map((entry) => ({
      label: entry.member.name,
      value: money(entry.total),
      share: familyTotal > 0 ? entry.total / familyTotal : 0,
    })),
    followUps: [`Cât a cheltuit ${top.member.name} luna asta?`, "Unde se duc banii?"],
  };
}

// ------------------------------------------------------------------- router

type Matcher = { kind: string; test: RegExp; run: (data: AppData, folded: string, asOf: string) => AnalystAnswer };

/**
 * Ordinea contează: tiparele mai precise trebuie încercate înaintea celor largi.
 * „cât pot cheltui pe zi” nu trebuie să cadă pe „cât am cheltuit”.
 * Briefingul, „e normal?” și „cine a cheltuit” stau înaintea restului, ca să nu
 * fie înghițite de «cât mai am» sau «cel mai mult».
 */
/**
 * „De ce mi-a scăzut plicul de alimente?”
 *
 * Cifra din plic scade din trei motive, iar omul nu are de unde să știe care: cheltuieli
 * puse pe el, mutări către alt plic și tranșa săptămânii care s-a închis. Răspunsul le
 * arată pe toate, cu mișcările care au consumat banii — nu doar cifra rămasă.
 */
function answerEnvelopeWhy(data: AppData, folded: string, asOf: string): AnalystAnswer {
  const category = readCategory(folded, data);
  const allocations = data.settings.salaryPlan.allocations;
  const envelope = (category ? allocations.find((item) => (item.category || item.label) === category) : undefined)
    || allocations.find((item) => folded.includes(foldRomanian(item.label)))
    || allocations[0];
  if (!envelope) {
    return { kind: "envelope-why", headline: "Nu ai niciun plic deschis.", detail: "Fă unul din Plan și îți urmăresc eu consumul.", followUps: ["Cum stau cu banii?"] };
  }
  const status = envelopeDecisionStatus(data, envelope, asOf);
  const plan = data.settings.salaryPlan;
  const moves = data.transactions
    .filter((item) => item.kind === "expense" && item.allocationId === envelope.id && inPlanPeriod(item.date, plan))
    .sort((left, right) => right.amount - left.amount);
  const transfersOut = (plan.transfers || []).filter((item) => item.fromAllocationId === envelope.id).reduce((sum, item) => sum + item.amount, 0);
  const transfersIn = (plan.transfers || []).filter((item) => item.toAllocationId === envelope.id).reduce((sum, item) => sum + item.amount, 0);
  const scope = status.scope === "week" && status.weekIndex ? `tranșa S${status.weekIndex}` : "ciclul";
  const scopeGenitive = status.scope === "week" && status.weekIndex ? `tranșei S${status.weekIndex}` : "ciclului";
  return {
    kind: "envelope-why",
    headline: `Din „${envelope.label}” au plecat ${money(round(status.spent))} pe ${scope}; rămân ${money(round(Math.max(0, status.remaining)))}.`,
    detail: sentences(
      `Limita ${scopeGenitive} este ${money(round(status.budget))}`,
      transfersOut > 0 && `Ai mutat ${money(round(transfersOut))} către alt plic.`,
      transfersIn > 0 && `Ai adus ${money(round(transfersIn))} din alt plic.`,
      !moves.length && !transfersOut && "Nicio mișcare pusă pe plic în perioada asta.",
    ),
    rows: moves.slice(0, 5).map((item) => ({ label: item.title, value: money(item.amount), hint: formatDate(item.date) })),
    followUps: ["Cât mai pot cheltui azi?", `Cât am cheltuit pe ${envelope.label}?`],
  };
}

/**
 * „Am uitat să trec niște cheltuieli săptămâna trecută.”
 *
 * Nu e o întrebare despre cifre, e o teamă: că registrul e deja greșit și că nu mai are
 * rost. Răspunsul spune exact cum se repară, cu fraza pe care o poate scrie aici.
 */
function answerLateEntry(): AnalystAnswer {
  return {
    kind: "late-entry",
    headline: "Se poate trece oricând, cu ziua ei.",
    detail: "Scrie-mi mișcarea cu data în ea — „marți am dat 60 de lei pe alimente” sau „pe 12 septembrie 120 lei la Kaufland” — și o pun pe ziua aceea, nu pe azi. Plicul săptămânii respective se ajustează singur.",
    followUps: ["Cât am cheltuit luna asta?", "Cum stau cu banii?"],
  };
}

const LUNI = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

/**
 * Termenul dintr-o întrebare de economisire: „până în decembrie”, „până pe 10 octombrie”,
 * „în 6 luni”. Luna spusă fără an înseamnă prima ei venire de acum înainte — cine întreabă
 * în septembrie „până în iunie” se gândește la iunie anul viitor, nu la cel trecut.
 */
function readDeadline(folded: string, asOf: string): { date: string; label: string } | undefined {
  const today = new Date(`${asOf}T12:00:00`);
  const inMonths = folded.match(/\bin (\d{1,2}) luni\b/);
  if (inMonths) {
    const target = new Date(today.getFullYear(), today.getMonth() + Number(inMonths[1]), today.getDate(), 12);
    return { date: isoDate(target), label: `peste ${inMonths[1]} luni` };
  }
  const withDay = folded.match(/\b(?:pana )?(?:pe|la|in) (\d{1,2}) (ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\b/);
  const monthOnly = folded.match(/\b(?:pana )?(?:in|la|pe) (ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\b/);
  const name = withDay?.[2] || monthOnly?.[1];
  if (!name) return undefined;
  const month = LUNI.indexOf(name);
  const day = withDay ? Math.min(Number(withDay[1]), new Date(today.getFullYear(), month + 1, 0).getDate()) : 1;
  let target = new Date(today.getFullYear(), month, day, 12);
  if (isoDate(target) <= asOf) target = new Date(today.getFullYear() + 1, month, day, 12);
  return { date: isoDate(target), label: withDay ? `${day} ${name}` : name };
}

/**
 * „Cât ar trebui să pun deoparte ca să am 3000 până în decembrie?”
 *
 * Întrebarea are un singur calcul în spate — suma împărțită la timpul rămas — dar omul o
 * scrie în zece feluri, iar aplicația nu răspundea la niciunul. Ritmul se dă și pe lună, și
 * pe săptămână, fiindcă unii pun deoparte la salariu și alții pe măsură ce cheltuie.
 */
function answerSaveBy(data: AppData, folded: string, asOf: string): AnalystAnswer {
  const target = firstAmount(folded);
  const deadline = readDeadline(folded, asOf);
  if (target === undefined || !deadline) {
    return {
      kind: "save-by",
      headline: "Spune-mi suma și termenul și îți calculez ritmul.",
      detail: "De exemplu: „cât pun deoparte ca să am 3000 până în decembrie?”",
      followUps: ["Cât mai am disponibil?"],
    };
  }
  const days = Math.max(1, Math.round((Date.parse(`${deadline.date}T12:00:00`) - Date.parse(`${asOf}T12:00:00`)) / 86400000));
  const perMonth = round(target * 30 / days);
  const perWeek = round(target * 7 / days);
  const months = Math.max(1, Math.round(days / 30));
  /** Banii deja strânși în obiective nu se inventează: se numesc doar dacă există. */
  const saved = round(data.savings.reduce((sum, item) => sum + item.current, 0));
  return {
    kind: "save-by",
    headline: sentences(`${money(perMonth)} pe lună — sau ${money(perWeek)} pe săptămână — ca să ai ${money(target)} până pe ${formatDate(deadline.date)}`),
    detail: sentences(
      `Mai sunt ${plural(days, "zi", "zile")}, adică aproape ${plural(months, "lună", "luni")}`,
      saved > 0 && `Ai deja ${money(saved)} în obiective; dacă îi socotești, ritmul scade la ${money(round(Math.max(0, target - saved) * 30 / days))} pe lună`,
    ),
    followUps: ["Cât mai am disponibil?", "Ce evenimente urmează?"],
  };
}

const MATCHERS: Matcher[] = [
  { kind: "next", test: /\b(ce fac( azi| acum)?|ce sa fac|ce[- ]?mi recoman|ce imi recoman|recomand[- ]?mi|ce urmeaza\b|sfat(ul)?\b|briefing|cum stau azi|ce merita (azi|acum)|ce parere|parere ai)/, run: (d, _f, a) => answerNext(d, a) },
  { kind: "unusual", test: /\b(prea mult|e normal|neobisnuit|iesit din ritm|am depasit|cheltuieli (mari|neobisnuite)|sunt peste buget)/, run: (d, f, a) => answerUnusual(d, f, a) },
  { kind: "who", test: /\b(cine (a )?(cheltuit|dat|platit)|cine cheltuie|care dintre (noi|voi)|intre noi)/, run: (d, f, a) => answerWho(d, f, a) },
  /**
   * Aceeași întrebare, scrisă cum îi vine omului: „îmi permit 400?”, „cât îmi rămâne dacă
   * plătesc chiria de 1500?”, „ce se întâmplă dacă dau 400 pe anvelope?”. Toate cer același
   * calcul — suma scăzută din ce e liber — dar doar prima era recunoscută.
   */
  { kind: "afford", test: /\b(imi permit|mi permit|pot sa (dau|cheltui)|as putea sa (dau|cheltui)|am bani de|ajung banii|mai am \d|cat ar ramane|ce mi ar ramane|cat (imi |mi )?(mai )?ramane|cat mai ramane|ce se intampla daca|daca (platesc|dau|cheltui|scot|cumpar))/, run: (d, f, a) => answerAfford(d, f, a) },
  { kind: "pace", test: /\b(cat (mai )?pot (sa )?cheltui|cat am voie|ritm|pe zi|zilnic|cat pe zi)/, run: (d, _f, a) => answerPace(d, a) },
  { kind: "payday", test: /\b(cand (vine|intra) (salariul|venitul)|cate zile pana|pana la salariu)/, run: (d, _f, a) => answerPayday(d, a) },
  { kind: "subscriptions", test: /\b(abonament|scadent|facturi lunare|recurent)/, run: (d) => answerSubscriptions(d) },
  { kind: "debts", test: /\b(datorii|datorie|rate|de platit la|credit)/, run: (d) => answerDebts(d) },
  /** Întrebarea de ritm („cât pe lună ca să am X până în Y”) trece înaintea celei de sold. */
  { kind: "save-by", test: /\b(ca sa (am|strang|adun|ajung la)|cat (ar trebui |trebuie )?(sa )?pun (deoparte|pe luna)|cat pe luna ca sa|cat pe saptamana ca sa|ca sa imi ajunga pentru)/, run: (d, f, a) => answerSaveBy(d, f, a) },
  { kind: "savings", test: /\b(economi|strans|obiectiv|pusi deoparte)/, run: (d) => answerSavings(d) },
  { kind: "biggest", test: /\b(cea mai mare|cel mai mare|top cheltui|cele mai mari)/, run: (d, f, a) => answerBiggest(d, f, a) },
  { kind: "compare", test: /\b(compar|fata de luna|mai mult ca|mai putin ca|diferenta fata)/, run: (d, f, a) => answerCompare(d, f, a) },
  { kind: "where", test: /\b(unde (se duc|se duce|pleaca|dispar)|pe ce (dau|cheltui|a dat|am dat)|distribut|pe categorii|cel mai mult)/, run: (d, f, a) => answerWhere(d, f, a) },
  { kind: "spend", test: /\b(cat am (cheltuit|dat|platit)|cat a (cheltuit|dat|platit)|cat cheltui|cat dau|cat platesc|cheltuit pe|cat am scos|ce am cumparat|de cate ori am dat|arata[- ]?mi cheltuielile|listeaza cheltuielile)/, run: (d, f, a) => answerSpend(d, f, a) },
  // „mi-a scăzut”, „mi a scazut”, „s-a dus” — aceeași întrebare, scrisă în trei feluri.
  { kind: "envelope-why", test: /\bde ce .{0,14}(scazut|micsorat|mancat|dus|terminat|golit)|unde s-?au dus banii din plic|ce s-?a intamplat cu plicul/, run: (d, f, a) => answerEnvelopeWhy(d, f, a) },
  { kind: "late-entry", test: /\b(am uitat sa (trec|notez|adaug)|nu am trecut|nu am notat|cum (trec|adaug|notez) .{0,20}(trecut|alta zi|ieri|saptamana trecuta))/, run: () => answerLateEntry() },
  { kind: "remaining", test: /\b(cat (mai )?am|ce mai am|cat mi a ramas|ramas|sold|situatia|bilant|disponibil|cum stau cu|cum sta)/, run: (d, _f, a) => answerRemaining(d, a) },
];

/**
 * Încearcă să răspundă la o întrebare despre bani. `undefined` înseamnă
 * „nu este o întrebare de analiză” — mesajul merge mai departe pe celelalte căi.
 */
/**
 * „Cât mai am la mâncare?”, „cât pot cheltui azi pe taxi?”: răspunsul din plicul acela,
 * nu din tot planul — cât a rămas, cât din săptămâna în curs și cât iese pe zi până la salariu.
 */
function answerEnvelopeLeft(data: AppData, envelope: BudgetAllocation, asOf: string): AnalystAnswer {
  const status = allocationStatus(data, envelope);
  const left = round(Math.max(0, status.remaining));
  const cap = weekDayCap(data, envelope, asOf);
  const week = cap?.week;
  const until = envelopeUntilPayday(data, envelope, asOf);
  const weekLeft = week ? round(Math.max(0, week.remaining)) : 0;
  const todayCap = cap ? cap.perDay : until ? until.perDay : undefined;
  const headline = status.remaining < 0
    ? `${envelope.label}: plicul e depășit cu ${money(-status.remaining)}.`
    : week
      ? `${envelope.label}: mai ai ${money(weekLeft)} săptămâna asta (S${week.index}) și ${money(left)} în tot plicul.`
      : `${envelope.label}: mai ai ${money(left)} din ${money(status.budget)}.`;
  const payday = until && until.days > 0 ? `Mai sunt ${daysLabel(until.days)} până la salariu (~${formatDate(until.typical, { day: "numeric", month: "long" })})` : "";
  return {
    kind: "envelope-left",
    headline,
    detail: sentences(
      week && todayCap !== undefined && weekLeft > 0 ? `Ca să ajungă săptămâna, azi poți da cel mult ${money(todayCap)}` : "",
      !week && todayCap !== undefined && left > 0 && until && until.days > 0 ? `Împărțit până la salariu, cam ${money(todayCap)} pe zi` : "",
      payday,
      `Ai cheltuit ${money(status.spent)} din ${money(status.budget)} în perioada asta`,
    ),
    rows: [
      ...(week ? [{ label: `Săptămâna S${week.index}`, value: `${money(week.spent)} din ${money(week.budget)}`, hint: `rămân ${money(weekLeft)}` }] : []),
      { label: "Tot plicul", value: `${money(status.spent)} din ${money(status.budget)}`, hint: `rămân ${money(left)}` },
      ...(until && until.days > 0 ? [{ label: "Până la salariu", value: daysLabel(until.days) }] : []),
    ],
    followUps: ["Cât pot cheltui azi?", "Unde se duc banii?"],
  };
}

const ASKS_ENVELOPE_LEFT = /\b(cat mai (am|avem|e|ramane)|ce mai (am|avem)|cat (mi|ne) a ramas|cat (a )?ramas|cati bani mai (am|avem)|cat (mai )?(pot|putem) (sa )?(cheltui|cheltuim|dau|dam|folosesc|folosim)|(imi|ne) (mai )?ajung|cat am in plic)\b/;

export function analyze(raw: string, data: AppData, asOf = isoToday()): AnalystAnswer | undefined {
  const folded = foldRomanian(raw).replace(/[?!.,;]/g, " ").replace(/\s+/g, " ").trim();
  if (!folded) return undefined;
  /**
   * Un mesaj care cere o înregistrare nu este o întrebare de analiză — dar
   * „cât am dat la Lidl” conține și el „am dat”. Deosebirea o face începutul:
   * o întrebare se deschide cu un cuvânt de întrebare.
   */
  const asksQuestion = /^(cat|cate|cati|unde|cand|care|cum|ce |ce-|cine |sfat|recomand|e normal|prea mult|imi permit|mi permit|pot sa|as putea|ajung |compar|arata|spune mi|listeaza|vreau sa vad)/.test(folded)
    || /\?$/.test(raw.trim());
  const asksToRecord = /\b(adauga|adaug|treci|noteaza|trece|creeaza|fa mi|fa un|sterge)\b/.test(folded)
    || (!asksQuestion && /\b(am dat|am platit|am cumparat|am primit|am incasat)\b/.test(folded));
  if (asksToRecord) return undefined;

  /**
   * Trei feluri de mesaj seamănă cu o întrebare de analiză fără să fie:
   *
   * — o constatare cu sumă: „abonament telefon 45 lei” conține cuvântul
   *   „abonament”, dar spune ce s-a plătit, nu întreabă ce abonamente există;
   * — o întrebare despre aplicație: „cum funcționează plicurile?” cere o
   *   explicație, nu o cifră din registru;
   * — o negație: „nu am datorii” răspunde ghidului, nu întreabă de datorii.
   *
   * Pe toate trei, analistul trebuie să tacă și să lase mesajul mai departe.
   */
  const statesAnAmount = !asksQuestion && /\d/.test(folded);
  const asksHowItWorks = /\b(cum (functioneaza|merge|se face|folosesc)|ce inseamna|la ce (foloseste|serveste)|de ce exista)\b/.test(folded);
  const denies = /^(nu |n-?am |nu am |niciun|nicio)\b/.test(folded);
  if (statesAnAmount || asksHowItWorks || denies) return undefined;

  if (ASKS_ENVELOPE_LEFT.test(folded)) {
    const envelope = allocationFromText(data, folded.replace(ASKS_ENVELOPE_LEFT, " "));
    if (envelope) return answerEnvelopeLeft(data, envelope, asOf);
  }
  for (const matcher of MATCHERS) {
    if (matcher.test.test(folded)) return matcher.run(data, folded, asOf);
  }
  return undefined;
}


/** Textul plat al unui răspuns, pentru chat sau pentru citire cu voce. */
export function answerToText(answer: AnalystAnswer): string {
  const rows = answer.rows?.length
    ? "\n" + answer.rows.map((row) => `• ${row.label}: ${row.value}${row.hint ? ` (${row.hint})` : ""}`).join("\n")
    : "";
  return [answer.headline, answer.detail].filter(Boolean).join(" ") + rows;
}
