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
  allocationStatus,
  expenseCategories,
  foldRomanian,
  formatDate,
  guessCategoryFromText,
  isoDate,
  isoToday,
  planForecast,
  sourceBalance,
  type AppData,
  type Transaction,
} from "./finance-data";

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
  const guessed = guessCategoryFromText(folded);
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

  let items = expensesIn(data, period);
  let subject = "";
  if (category) { items = items.filter((item) => item.category === category); subject = ` pe ${category}`; }
  else if (vendor) { items = items.filter((item) => foldRomanian(item.title) === foldRomanian(vendor)); subject = ` la ${vendor}`; }

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
  const items = expensesIn(data, period);
  const total = totalOf(items);
  if (!total) {
    return { kind: "where", headline: `Nu există cheltuieli în ${period.label}.`, followUps: ["Cât am cheltuit luna trecută?"] };
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
  const amount = firstAmount(folded);
  const forecast = planForecast(data, asOf);
  const free = round(forecast.projectedRemaining);

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
    const status = allocationStatus(data, envelope);
    const after = round(status.remaining - amount);
    return {
      kind: "afford",
      headline: after >= 0
        ? `Da. În plicul „${envelope.label}” rămân ${money(after)} după.`
        : `Nu din plic: „${envelope.label}” are ${money(Math.max(0, status.remaining))} și ar ieși ${money(Math.abs(after))} peste.`,
      detail: `Plicul are ${money(status.budget)}, s-au consumat ${money(status.spent)}. Nerepartizat în plan: ${money(free)}.`,
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
  return {
    kind: "afford",
    headline: after >= 0
      ? `Da. Rămân ${money(after)} nerepartizați până la următorul venit.`
      : `Ar ieși ${money(Math.abs(after))} peste ce ai nerepartizat.`,
    detail: payday
      ? sentences(`Calculat până pe ${formatDate(payday)}, după ce se scad plicurile și scadențele rezervate`)
      : "Nu ai stabilit data următorului venit, deci calculul se oprește la banii din surse.",
    rows: [
      { label: "Nerepartizat acum", value: money(free) },
      { label: "După cheltuială", value: money(after) },
    ],
    followUps: ["Cât pot cheltui pe zi?"],
  };
}

function answerPace(data: AppData, asOf: string): AnalystAnswer {
  const forecast = planForecast(data, asOf);
  const payday = nextPaydayOf(data);
  if (!payday) {
    return {
      kind: "pace",
      headline: "Nu pot calcula un ritm fără data următorului venit.",
      detail: "Spune-mi când vine salariul („salariul vine pe 25”) și îți spun cât poți cheltui pe zi.",
    };
  }
  const safe = round(forecast.safeDaily);
  const pace = round(forecast.paceDaily);
  const verdict = pace <= 0 ? "Încă nu ai cheltuit nimic în perioada asta."
    : pace <= safe * 0.85 ? "Ești sub ritmul sigur."
    : pace <= safe * 1.05 ? "Ești fix pe ritmul sigur."
    : "Ești peste ritmul sigur.";
  return {
    kind: "pace",
    headline: sentences(`Poți cheltui ${money(Math.max(0, safe))} pe zi până pe ${formatDate(payday)}`),
    detail: sentences(verdict, `Ritmul tău actual este ${money(Math.max(0, pace))} pe zi`),
    rows: [
      { label: "Ritm sigur", value: `${money(Math.max(0, safe))}/zi` },
      { label: "Ritmul tău", value: `${money(Math.max(0, pace))}/zi` },
      { label: "Rămas nerepartizat", value: money(round(forecast.projectedRemaining)) },
    ],
    followUps: ["Unde se duc banii?", "Îmi permit 200 de lei?"],
  };
}

function answerRemaining(data: AppData, asOf: string): AnalystAnswer {
  const payday = nextPaydayOf(data);
  const envelopes = data.settings.salaryPlan.allocations.map((item) => ({ item, ...allocationStatus(data, item) }));
  const sources = data.settings.paymentSources.map((item) => ({ item, balance: round(sourceBalance(data, item.id)) }));
  const inSources = round(sources.reduce((sum, entry) => sum + entry.balance, 0));

  const rows: AnalystRow[] = [
    ...envelopes.map((entry) => ({ label: entry.item.label, value: money(Math.max(0, entry.remaining)), hint: entry.state === "over" ? "depășit" : entry.state === "watch" ? "aproape de limită" : undefined })),
    ...sources.map((entry) => ({ label: `Sold · ${entry.item.name}`, value: money(entry.balance) })),
  ];

  return {
    kind: "remaining",
    headline: envelopes.length
      ? `${money(round(envelopes.reduce((sum, entry) => sum + Math.max(0, entry.remaining), 0)))} rămași în plicuri, ${money(inSources)} în surse.`
      : `${money(inSources)} în surse. Nu ai încă plicuri.`,
    detail: payday ? sentences(`Următorul venit: ${formatDate(payday)}`) : "Nu ai stabilit data următorului venit.",
    rows,
    followUps: ["Cât pot cheltui pe zi?", "Unde se duc banii?"],
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
  const plan = data.settings.salaryPlan;
  const payday = plan.nextPayday || plan.earliestPayday;
  if (!payday) return { kind: "payday", headline: "Nu ai stabilit data următorului venit." };
  const days = Math.round((new Date(`${payday}T12:00:00`).getTime() - new Date(`${asOf}T12:00:00`).getTime()) / 86400000);
  return {
    kind: "payday",
    headline: sentences(days <= 0 ? `Salariul era așteptat pe ${formatDate(payday)}` : `Mai sunt ${plural(days, "zi", "zile")} până pe ${formatDate(payday)}`),
    detail: sentences(`Nerepartizat până atunci: ${money(round(planForecast(data, asOf).projectedRemaining))}`),
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
    followUps: ["Unde se duc banii?"],
  };
}

// ------------------------------------------------------------------- router

type Matcher = { kind: string; test: RegExp; run: (data: AppData, folded: string, asOf: string) => AnalystAnswer };

/**
 * Ordinea contează: tiparele mai precise trebuie încercate înaintea celor largi.
 * „cât pot cheltui pe zi” nu trebuie să cadă pe „cât am cheltuit”.
 */
const MATCHERS: Matcher[] = [
  { kind: "afford", test: /\b(imi permit|mi permit|pot sa (dau|cheltui)|as putea sa (dau|cheltui)|am bani de|ajung banii|mai am \d|cat ar ramane|ce mi ar ramane)/, run: (d, f, a) => answerAfford(d, f, a) },
  { kind: "pace", test: /\b(cat pot cheltui|cat am voie|ritm|pe zi|zilnic)/, run: (d, _f, a) => answerPace(d, a) },
  { kind: "payday", test: /\b(cand (vine|intra) (salariul|venitul)|cate zile pana|pana la salariu)/, run: (d, _f, a) => answerPayday(d, a) },
  { kind: "subscriptions", test: /\b(abonament|scadent|facturi lunare|recurent)/, run: (d) => answerSubscriptions(d) },
  { kind: "debts", test: /\b(datorii|datorie|rate|de platit la|credit)/, run: (d) => answerDebts(d) },
  { kind: "savings", test: /\b(economi|strans|obiectiv|pusi deoparte)/, run: (d) => answerSavings(d) },
  { kind: "biggest", test: /\b(cea mai mare|cel mai mare|top cheltui|cele mai mari)/, run: (d, f, a) => answerBiggest(d, f, a) },
  { kind: "compare", test: /\b(compar|fata de luna|mai mult ca|mai putin ca|diferenta fata)/, run: (d, f, a) => answerCompare(d, f, a) },
  { kind: "where", test: /\b(unde (se duc|se duce|pleaca|dispar)|pe ce (dau|cheltui)|distribut|pe categorii|cel mai mult)/, run: (d, f, a) => answerWhere(d, f, a) },
  { kind: "spend", test: /\b(cat am (cheltuit|dat|platit)|cat cheltui|cat dau|cat platesc|cheltuit pe|cat am scos)/, run: (d, f, a) => answerSpend(d, f, a) },
  { kind: "remaining", test: /\b(cat (mai )?am|ce mai am|cat mi a ramas|ramas|sold|situatia|bilant|disponibil|cum stau cu|cum sta)/, run: (d, _f, a) => answerRemaining(d, a) },
];

/**
 * Încearcă să răspundă la o întrebare despre bani. `undefined` înseamnă
 * „nu este o întrebare de analiză” — mesajul merge mai departe pe celelalte căi.
 */
export function analyze(raw: string, data: AppData, asOf = isoToday()): AnalystAnswer | undefined {
  const folded = foldRomanian(raw).replace(/[?!.,;]/g, " ").replace(/\s+/g, " ").trim();
  if (!folded) return undefined;
  /**
   * Un mesaj care cere o înregistrare nu este o întrebare de analiză — dar
   * „cât am dat la Lidl” conține și el „am dat”. Deosebirea o face începutul:
   * o întrebare se deschide cu un cuvânt de întrebare.
   */
  const asksQuestion = /^(cat|cate|cati|unde|cand|care|cum|ce |imi permit|mi permit|pot sa|as putea|ajung |compar|arata|spune mi)/.test(folded)
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

  for (const matcher of MATCHERS) {
    if (matcher.test.test(folded)) return matcher.run(data, folded, asOf);
  }
  return undefined;
}

/** Întrebările pe care le poate pune omul, arătate ca sugestii. */
export const SUGGESTED_QUESTIONS = [
  "Unde se duc banii?",
  "Cât pot cheltui pe zi?",
  "Cât am cheltuit pe alimente luna asta?",
  "Îmi permit 300 de lei?",
  "Care e cea mai mare cheltuială?",
  "Cât plătesc pe abonamente?",
];

/** Textul plat al unui răspuns, pentru chat sau pentru citire cu voce. */
export function answerToText(answer: AnalystAnswer): string {
  const rows = answer.rows?.length
    ? "\n" + answer.rows.map((row) => `• ${row.label}: ${row.value}${row.hint ? ` (${row.hint})` : ""}`).join("\n")
    : "";
  return [answer.headline, answer.detail].filter(Boolean).join(" ") + rows;
}
