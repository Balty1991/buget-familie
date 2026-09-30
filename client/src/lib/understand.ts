/**
 * Ce a vrut să spună.
 *
 * Până acum înțelesul unui mesaj se hotăra prin ordinea a douăsprezece `return`-uri
 * din componentă: primul cititor care recunoștea ceva lua mesajul, restul nu mai
 * apucau să se uite. Ordinea era scrisă de mână, iar fiecare frază nouă risca să
 * fie revendicată de cine nu trebuia — așa au apărut, pe rând, „fă-mi plic 2400”
 * citit ca venit, „îmi permit 500 pe alimente?” citit ca cheltuială și „300 lei la
 * dentist” citit tot ca venit.
 *
 * Aici toți citesc același mesaj și fiecare întoarce ce a înțeles, cu un scor și cu
 * motivul. Alegerea se face o singură dată, la urmă, comparând scoruri — deci
 * ordinea a devenit dată, nu control de flux: se poate măsura, se poate testa, și
 * se poate spune „nu sunt sigur” când primele două citiri sunt aproape la fel.
 *
 * Funcțiile de mai jos sunt mutate din componentă neschimbate; singura diferență
 * este că memoria obiceiurilor intră ca parametru, nu ca stare de modul.
 */
import { spokenAmountsToDigits } from "./ro-numbers";
import { recallPhrasing, type LearnedPhrase } from "./guide-learning";
import { repeatedSpend, usualSpend } from "./guide-habits";
import { genitiveName } from "./member-mode";
import {
  allocationStatus,
  allocationWeekStatus,
  allocationWeeksStatus,
  envelopeDecisionStatus,
  expenseCategories,
  formatDate,
  inPlanPeriod,
  isoToday,
  isWeeklyPaced,
  matchingAllocationsForExpense,
  parseNaturalSpendScenario,
  pendingRecurringInPlan,
  planAllocationMath,
  planEndDate,
  sourceBalance,
  type AppData,
  type Transaction, foldRomanian} from "./finance-data";
import { calendarBudget, periodDays, remainingPace, startedWeekShare } from "./calendar-budget";
import { buildTodaySummary } from "./today-summary";
import { plannedEventsPressure, upcomingPlannedEvents } from "./planned-events";
import { proposeSplit } from "./split-proposal";
import { activeIncomes, activeNeeds, matchExpectedIncome, pendingSplitIncome, proposeIncomeSplit, reserveOf, splitPreviewText } from "./monthly-needs";
import { t } from "./i18n";
import { dateCopy, noDoubleStop, shiftDay, today } from "./proposal-date";
import { relatedCategories } from "./suggest-source";
import { spendGroupOf } from "./product-catalog";
import { explicitSplitLines, extractAmounts, extractDates, parseAssistantMessage, readPaymentHint, repeatFactor, type AppScreen, type ParsedIntent } from "./assistant-intents";
import { analyze, type AnalystAnswer } from "./analyst";
import { selfMemberIdOf, selfMemberOf } from "./member-identity";

export type FinancialUpdate =
  | { kind: "income"; amount: number; title: string; date?: string; memberId?: string; clientCaptureId?: string }
  | { kind: "expense"; amount: number; title: string; category: string; date?: string; allocationId?: string; sourceId?: string; memberId?: string; clientCaptureId?: string; recurringId?: string; fromWeekIndex?: number; receiptDraft?: { vendor: string; amount: number; date?: string; items: Array<{ label: string; amount: number; category: string }> } }
  | { kind: "debt"; name: string; remaining: number; due?: string }
  | { kind: "debt-monthly"; amount: number; name?: string }
  | { kind: "allocation"; category: string; amount: number; weekly: boolean; weeklyAmount?: number; weeks?: number; payday?: string; label?: string; amountIsWeekly?: boolean; /** Ajustare față de plicul existent, nu sumă nouă. */ delta?: "increase" | "decrease" }
  | { kind: "recurring"; name: string; amount: number; dueDay: number; category: string }
  | { kind: "goal"; name: string; target: number; current?: number; dueDate?: string }
  | { kind: "planned-event"; name: string; date: string; estimate: number; repeat: "once" | "yearly" }
  | { kind: "allocation-delete"; label: string }
  /** Banii pe care omul spune că îi are: ajung sold de pornire pe o sursă, nu venit în registru. */
  | { kind: "funds"; amount: number; sourceHint?: "cash" | "card" | "meal"; sourceId?: string; date?: string }
  | { kind: "payday"; date: string; flexDays: number }
  | { kind: "transfer"; amount: number; fromId: string; toId: string; fromLabel: string; toLabel: string }
  /** Bani puși deoparte pentru un eveniment: o socoteală de planificare, fără mișcare în registru. */
  | { kind: "event-contribution"; eventId: string; name: string; amount: number; date: string }
  /** Regulă de magazin: de fiecare dată când titlul conține textul, propune categoria/plicul. */
  | { kind: "merchant-rule"; match: string; category?: string; allocationId?: string; envelopeLabel?: string }
  /** Repartizare automată din venitul următor, nu din banii de acum. */
  | { kind: "salary-rule"; allocationId: string; label: string; mode: "percent" | "fixed"; value: number }
  /** Repartizarea ultimului salariu nerepartizat după cheltuielile lunare declarate. */
  | { kind: "income-split" }
  | { kind: "delete-transaction"; id: string; title: string; amount: number }
  | { kind: "amend-transaction"; id: string; amount: number; title: string; was: number };

export type ChatChoice = { label: string; update: FinancialUpdate };
export type PhraseHabit = { key: string; title: string; category: string; allocationId?: string; sourceId?: string; count: number; lastAt: string };
export type GuideMemory = { phrases: PhraseHabit[]; skippedOnline: number; /** Fraze învățate de la model, după confirmarea ta. */ learned?: LearnedPhrase[] };
export const emptyGuideMemory = (): GuideMemory => ({ phrases: [], skippedOnline: 0 });

/**
 * Cheltuiala/venitul din ghid cer plic (sau sursă). Ziua are o valoare implicită vizibilă
 * (cea din frază sau azi), bifată deja în rândul de zile: o atingere pe plic salvează, iar
 * cine vrea altă zi o atinge întâi. Înainte, plicul ales înaintea zilei „nu se ținea”.
 */
export function isDatedSpendChoice(choice: ChatChoice): boolean {
  return choice.update.kind === "expense" || choice.update.kind === "income";
}

export function canCommitGuideSpend(sourcePicked: boolean, _dateTapped?: boolean): boolean {
  void _dateTapped;
  return sourcePicked;
}

const money = (value: number) => `${Number(value.toFixed(2)).toLocaleString("ro-RO", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })} RON`;

export function foldRo(raw: string) {
  return raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Vorbește despre împărțirea banilor, nu despre o plată: plic, împart, repartizez, aloc.
 * Semnalul ăsta oprește propunerea de cheltuială și, când o sumă rămâne necitită, trimite
 * mesajul la model în loc să răspundem cu o situație generală.
 */
export const plansMoney = (raw: string) => /\bplic|\bimpart|\brepartiz|\baloc[aă]|\bmuta\b/.test(foldRo(raw));

export function habitKey(raw: string) {
  return foldRo(raw).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export type ExtractedGuide = {
  amount?: number;
  title?: string;
  category?: string;
  debtName?: string;
  monthlyPayment?: number;
  dueDay?: number;
  items?: Array<{ amount?: number; title?: string }>;
  vendor?: string;
  date?: string;
  receiptLines?: Array<{ name?: string; quantity?: number; amount?: number }>;
  totalLabel?: string;
  confidence?: "high" | "medium" | "low";
};

/**
 * O întrebare, nu o comandă. Se recunoaște după semnul de la capăt sau după
 * cuvântul cu care începe — aceleași semne pe care le folosește și analistul,
 * ca cele două să nu se contrazică.
 */
/**
 * Gospodăria are deja o bază: un venit trecut, plan cu plicuri, dată de salariu, solduri
 * sau datorii.
 *
 * Contează pentru ghid: pasul de configurare („ce bani intră într-o lună obișnuită?”)
 * pornea mereu primul și ținea captiv orice mesaj cu cifre, citindu-l ca venit. Cine are
 * deja un plan nu mai trebuie întrebat de la capăt — nici la prima deschidere, nici după
 * o reinstalare care a păstrat datele.
 */
export const householdIsSetUp = (data: AppData) =>
  data.transactions.some((item) => item.kind === "income")
  || data.settings.salaryPlan.allocations.length > 0
  || Boolean(data.settings.salaryPlan.nextPayday)
  || data.settings.paymentSources.some((item) => item.openingBalance > 0)
  || data.debts.length > 0;

export function isQuestion(raw: string) {
  const folded = foldRo(raw).replace(/\s+/g, " ").trim();
  return /\?\s*$/.test(raw.trim())
    // Cuvânt întreg: „cumpărături 410” și „Catena 50” nu sunt întrebări.
    || /^(cat|cate|cati|unde|cand|care|cum)\b|^(ce |ce-|cine |sfat|recomand|e normal|prea mult|imi permit|mi permit|pot sa|as putea|ajung |mai am |merita |arata|listeaza|vreau sa vad|spune mi)/.test(folded);
}

export function isConfirm(raw: string) {
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const yes = "(da+|ok|okay|okey|okei|oki|confirm|confirma|confirmat|sigur|adauga|adaug[- ]o|inregistreaza|salveaza|salveaz[aă]-?l|perfect|corect|e corect|exact|exact asa|super|bun|bine|e bine|e bine asa|e ok|asa|asa e|in regula|merge|de acord|te rog|da te rog)";
  // „da, salvează”, „perfect”, „e bine așa”: tot confirmări, doar spuse mai lung.
  return new RegExp(`^${yes}([ ,.!]+${yes})*[.! ]*$`).test(folded);
}

export function claimsSaved(raw: string) {
  return /am (adăugat|adaugat|înregistrat|inregistrat|trecut|notat|salvat)/i.test(raw);
}

export function sourceTextSafe(raw: string) { return raw.replace(/data:[^ ]+/g, "").slice(0, 800); }

export function memberIdFor(data: AppData, hint: string, index = 0) {
  const folded = hint.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const members = data.settings.members;
  // Numele din familie întâi („Ana a primit salariul”), apoi felul în care se spune de obicei.
  const named = members.find((member) => {
    const name = member.name.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return name.length >= 3 && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(folded);
  });
  if (named) return named.id;
  if (/\bsoti(e|a|ei)\b|nevast|partenera|\bea\b/.test(folded)) return members[1]?.id || members[0]?.id;
  if (/sot\b|sotul|el\b/.test(folded) && !/sotie/.test(folded)) return members[0]?.id;
  return (index ? members[index]?.id : undefined) || selfMemberIdOf(data) || members[0]?.id;
}

export function parsePayday(raw: string) {
  const iso = raw.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso && Number(iso[2]) <= 12 && Number(iso[3]) <= 31) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dmy = raw.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if (dmy && Number(dmy[2]) <= 12 && Number(dmy[1]) <= 31) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const months = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const named = folded.match(/\b(\d{1,2})\s*(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie|ian|feb|mar|apr|iun|iul|aug|sept|sep|oct|nov|dec)\.?\s*(20\d{2})?\b/);
  if (!named) return undefined;
  const monthToken = named[2].slice(0, 3);
  const monthIndex = months.findIndex((item) => item.startsWith(monthToken) || (monthToken === "sep" && item === "septembrie"));
  if (monthIndex < 0 || Number(named[1]) > 31) return undefined;
  const year = named[3] || String(new Date().getFullYear());
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
}

export function parseWeeks(raw: string) {
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = folded.match(/(\d{1,2})\s*(?:de\s+)?saptaman/);
  const value = match ? Number(match[1]) : 0;
  return value >= 2 && value <= 12 ? value : undefined;
}

function spendTitle(folded: string, extracted: ExtractedGuide | undefined, category: string) {
  if (/taxi|uber|bolt/.test(folded)) return "Taxi";
  if (/\bapa\b/.test(folded) && !/patiserie/.test(folded)) return "Apă";
  if (/dulce|prajitur|ciocolat/.test(folded)) return "Dulciuri";
  if (/tigar|tutun/.test(folded)) return t("Țigări");
  if (/cafea/.test(folded)) return "Cafea";
  if (extracted?.vendor && /\b(bon|bonul|bonului|analizeaz)\b/.test(folded)) return extracted.vendor;
  const cleaned = folded
    .replace(/\b(adaug[ae]?|adauga|cheltuiel[aei]*|lei|ron|pe data de|data de|alaltaieri|ieri|azi|astazi|maine|am uitat|sa trec|sa o trec|te rog|pentru|pe)\b/g, " ")
    .replace(/\d[\d.,]*/g, " ")
    .replace(/[^a-zăâîșț -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length >= 3 && cleaned.length <= 42) {
    return cleaned.charAt(0).toLocaleUpperCase("ro-RO") + cleaned.slice(1);
  }
  if (extracted?.title && !/^(altele|cheltuial)/i.test(extracted.title)) return extracted.title;
  return category;
}

export function spendAmount(raw: string, extracted: ExtractedGuide | undefined, parsedAmount: number) {
  if (extracted?.amount && extracted.amount > 0) return extracted.amount;
  if (parsedAmount > 0) return parsedAmount;
  const found: number[] = [];
  // Datele nu sunt sume: „pe 05.09.2026” nu înseamnă 5, 9 sau 2026 de lei.
  const withoutDates = raw
    .replace(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g, " ")
    .replace(/\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, " ");
  const pattern = /(?:^|[^\d])(\d{1,7}(?:[.,]\d{1,2})?)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(withoutDates))) {
    const value = parseFloat(match[1].replace(",", "."));
    if (value >= 1) found.push(value);
  }
  return found[0] || 0;
}

export function spendDate(raw: string) {
  const folded = foldRo(raw);
  if (/\balaltaieri\b/.test(folded)) return shiftDay(-2);
  if (/\bieri\b/.test(folded)) return shiftDay(-1);
  if (/\bmaine\b/.test(folded)) return shiftDay(1);
  if (/\b(azi|astazi)\b/.test(folded)) return shiftDay(0);
  // Același extractor ca restul aplicației: cunoaște și „3 septembrie”, și „05.09”.
  const { hits } = extractDates(raw, shiftDay(0));
  const explicit = hits.find((item) => item.explicit) || hits[0];
  return explicit ? explicit.start : shiftDay(0);
}

export function isDebtOrInstallmentMessage(raw: string) {
  const folded = foldRo(raw);
  return /\b(credit|credite|datorie|datorii|sold restant|suma restanta|rata lunara|rate lunare|scadenta|scadente|imprumut|banca|bancii)\b/.test(folded)
    && !/\b(am platit|am achitat|plata ratei|achit rata)\b/.test(folded);
}

export function findHabit(memory: GuideMemory, raw: string, title: string) {
  const folded = habitKey(`${raw} ${title}`);
  return [...memory.phrases]
    .filter((item) => item.key.length >= 2 && (folded.includes(item.key) || item.key.includes(habitKey(title))))
    .sort((left, right) => right.count - left.count || right.key.length - left.key.length)[0];
}

export function receiptDetails(extracted?: ExtractedGuide, title?: string) {
  if (!extracted?.amount && !extracted?.vendor && !extracted?.category) return "";
  const sameStore = title && extracted.vendor && title.trim().toLocaleLowerCase("ro-RO") === extracted.vendor.trim().toLocaleLowerCase("ro-RO");
  const vendor = extracted.vendor && !sameStore ? ` **${extracted.vendor}**.` : "";
  const total = extracted.amount ? ` Total bon: **${money(extracted.amount)}**.` : "";
  const group = extracted.category ? spendGroupOf(extracted.category) : "";
  const category = extracted.category
    ? ` ${t("Categorie")}: **${extracted.category}** (${group === "Alimente" ? t("alimente") : t("nealimentare")}).`
    : "";
  const confidence = extracted.confidence === "low" ? t(" Verifică atent suma. Dacă nu e asta, scrie «totalul e …».") : "";
  return `${vendor}${total}${category}${t(" Produsele le vezi la Bonuri.")}${confidence}`;
}

export function matchEnvelope(data: AppData, token: string) {
  const key = habitKey(token);
  if (key.length < 3) return undefined;
  return data.settings.salaryPlan.allocations.find((item) => {
    const hay = habitKey(`${item.label} ${item.category || ""}`);
    return hay.includes(key) || key.includes(hay);
  });
}

/**
 * Numele spus de om, căutat printre lucrurile lui. „Crăciun” trebuie să găsească
 * „Crăciun 2026”, iar „chiria” trebuie să găsească „Chirie”: româna schimbă
 * terminațiile, deci potrivirea se face pe rădăcină, în ambele sensuri.
 */
const nameMatches = (label: string, token: string) => {
  const key = habitKey(token);
  const hay = habitKey(label);
  if (key.length < 3 || hay.length < 3) return false;
  return hay === key || hay.includes(key) || key.includes(hay) || hay.startsWith(key.slice(0, -1)) || key.startsWith(hay.slice(0, -1));
};

export const matchPlannedEvent = (data: AppData, token: string) =>
  (data.settings.plannedEvents || []).find((item) => nameMatches(item.name, token));

/**
 * Mișcarea despre care vorbește omul, căutată în registrul de pe telefon.
 *
 * Nimic din ce identifică un rând nu pleacă la model: el spune „cafeaua de ieri, 12 lei”,
 * iar potrivirea se face aici, cu registrul în față. Când mai multe rânduri se potrivesc,
 * câștigă cel mai recent — și se scrie în propunere exact care, ca omul să vadă ce confirmă.
 */
export function matchTransaction(data: AppData, hint: { title?: string; amount?: number; date?: string }) {
  const key = hint.title ? habitKey(hint.title) : "";
  const candidates = data.transactions.filter((item) => {
    if (hint.date && item.date !== hint.date) return false;
    if (hint.amount !== undefined && Math.abs(item.amount - hint.amount) > 0.005) return false;
    if (key.length >= 3) {
      const hay = habitKey(`${item.title} ${item.category}`);
      if (!hay.includes(key) && !key.includes(hay)) return false;
    }
    return true;
  });
  return candidates.sort((left, right) =>
    right.date.localeCompare(left.date)
    || Date.parse(right.createdAt || "") - Date.parse(left.createdAt || "")
  )[0];
}

export const matchRecurring = (data: AppData, token: string) =>
  data.recurring.filter((item) => item.active !== false).find((item) => nameMatches(item.name, token));

/** Sursa numită în frază: tichetele, cash-ul sau cardul unei persoane („cardul Anei”). */
export function hintedSource(data: AppData, hint?: "meal" | "cash" | "card", owner?: string) {
  if (!hint) return undefined;
  const sources = data.settings.paymentSources;
  if (hint === "meal") return sources.find((item) => item.kind === "meal");
  if (hint === "cash") return sources.find((item) => item.kind === "cash");
  if (owner) {
    // „Anei”, „Mariei”, „lui Andrei”: numele sau genitivul lui, scris cu sau fără diacritice.
    const key = foldRomanian(owner);
    const person = data.settings.members.find((item) => [item.name, genitiveName(item.name).replace(/^lui\s+/i, "")].some((form) => foldRomanian(form) === key));
    if (person) return sources.find((item) => item.memberId === person.id && item.kind !== "meal" && item.kind !== "cash") || sources.find((item) => item.memberId === person.id);
  }
  return undefined;
}

/** Locurile din care se poate scoate suma: plicuri (cu săptămâna) și, doar dacă a rămas liber, nealocat. */
export function buildExpenseOffer(
  data: AppData,
  spend: { amount: number; title: string; category: string; date: string; sourceHint?: "meal" | "cash" | "card"; ownerHint?: string },
  memory: GuideMemory = emptyGuideMemory(),
): Proposal {
  const { amount, title, category, date } = spend;
  const when = dateCopy(date);
  const member = selfMemberOf(data);
  const fallbackSource = data.settings.paymentSources.find((item) => item.memberId === member?.id) || data.settings.paymentSources[0];
  const named = hintedSource(data, spend.sourceHint, spend.ownerHint);
  const related = relatedCategories(category);
  const habit = findHabit(memory, title, title);
  const funded: Array<{ envelope: (typeof data.settings.salaryPlan.allocations)[number]; weekIndex?: number; left: number }> = [];
  for (const envelope of data.settings.salaryPlan.allocations) {
    if (!isWeeklyPaced(envelope, data.settings.salaryPlan)) {
      const left = allocationStatus(data, envelope).remaining;
      if (left >= amount) funded.push({ envelope, left });
      continue;
    }
    for (const week of allocationWeeksStatus(data, envelope)) {
      if (week.remaining >= amount) funded.push({ envelope, weekIndex: week.index, left: week.remaining });
    }
  }
  const spendWeekByEnvelope = new Map<string, number | undefined>();
  funded.sort((left, right) => {
    const score = (item: (typeof funded)[number]) => {
      if (habit?.allocationId && item.envelope.id === habit.allocationId) return 6;
      if (habit?.category && item.envelope.category === habit.category) return 5;
      if (item.envelope.category === category) return 4;
      if (related.includes(item.envelope.category || "")) return 3;
      if ((item.envelope.category || item.envelope.label) === "Alimente") return 2;
      return 1;
    };
    const weekOfSpend = (item: (typeof funded)[number]) => {
      if (!isWeeklyPaced(item.envelope, data.settings.salaryPlan) || !item.weekIndex) return 1;
      if (!spendWeekByEnvelope.has(item.envelope.id)) {
        spendWeekByEnvelope.set(item.envelope.id, allocationWeekStatus(data, item.envelope, date)?.index);
      }
      return spendWeekByEnvelope.get(item.envelope.id) === item.weekIndex ? 0 : 1;
    };
    return score(right) - score(left) || weekOfSpend(left) - weekOfSpend(right) || (left.weekIndex || 99) - (right.weekIndex || 99) || right.left - left.left;
  });
  const choices: ChatChoice[] = funded.map(({ envelope, weekIndex, left }) => ({
    label: `Din ${envelope.label}${weekIndex ? ` · S${weekIndex}` : ""} · ${money(left)}`,
    update: {
      kind: "expense" as const,
      amount,
      title,
      category,
      date,
      allocationId: envelope.id,
      // Sursa spusă în frază („pe tichete”, „cardul Anei”) are întâietate față de cea a plicului.
      sourceId: named?.id || envelope.sourceId || fallbackSource?.id,
      memberId: named?.memberId || envelope.memberId || member?.id,
      fromWeekIndex: weekIndex,
    },
  }));
  data.settings.paymentSources.filter((source) => !named || source.id === named.id).forEach((source) => {
    const unrepartized = planAllocationMath(data).unrepartized;
    if (unrepartized < amount) return;
    const left = Math.round(Math.min(unrepartized, sourceBalance(data, source.id)) * 100) / 100;
    if (left < amount) return;
    choices.push({
      label: `Din nealocat · ${source.name} · ${money(left)}`,
      update: { kind: "expense", amount, title, category, date, allocationId: "outside", sourceId: source.id, memberId: source.memberId || member?.id },
    });
  });
  const noted = { amount, title, category, date };
  if (!choices.length) {
    return { spend: noted, text: noDoubleStop(`Am înțeles **${title}**, ${money(amount)}, ${when}. Nu am găsit un plic sau o sursă cu destui bani disponibili.`), choices: [] };
  }
  const preferred = (habit?.allocationId && funded.find((item) => item.envelope.id === habit.allocationId))
    || funded.find((item) => item.envelope.category === category)
    || funded.find((item) => related.includes(item.envelope.category || ""));
  const usual = habit && habit.count >= 2;
  const weekHint = funded.some((item) => item.weekIndex) ? " Alege din ce săptămână scoatem banii." : " Alege de unde scoatem banii.";
  const text = preferred
    ? `Am înțeles **${title}**, ${money(amount)}, **${when}**. ${usual ? `De obicei scoți din **${preferred.envelope.label}**.` : `Cea mai apropiată opțiune cu bani e **${preferred.envelope.label}**.`}${weekHint}`
    : funded.length
      ? `Am înțeles **${title}**, ${money(amount)}, **${when}**. Nu am un plic exact pentru ${category}.${weekHint}`
      : `Am înțeles **${title}**, ${money(amount)}, **${when}**. Nu ai plicuri încă, așa că o notăm direct din sursă. Alege de unde au ieșit banii.`;
  return { spend: noted, text: noDoubleStop(text), choices };
}

/** „Jud.” nu e sfârșit de propoziție. Detaliile bonului intră după prima frază adevărată. */
const abbrevBeforeDot = /^(?:jud|jdt|str|nr|bl|sc|et|ap|bd|sos|dr|dl|dna|etc|cf|vol|pag|tel|fax|ian|feb|mar|apr|iun|iul|aug|sept|sep|oct|noi|nov|dec|srl|sa)$/i;

function withReceiptDetails(text: string, extra: string) {
  let from = 0;
  while (from < text.length) {
    const dot = text.indexOf(". ", from);
    if (dot < 0) break;
    const word = text.slice(0, dot).match(/[A-Za-zĂÂÎȘȚăâîșț]{1,6}$/)?.[0] || "";
    if (!abbrevBeforeDot.test(word)) return noDoubleStop(`${text.slice(0, dot)}.${extra} ${text.slice(dot + 2)}`);
    from = dot + 2;
  }
  return noDoubleStop(`${text} ${extra.trim()}`);
}

export function expenseProposal(raw: string, extracted: ExtractedGuide | undefined, data: AppData, memory: GuideMemory, forced = false): { text: string; choices: ChatChoice[] } | undefined {
  if (isDebtOrInstallmentMessage(raw)) return undefined;
  if (!forced && isQuestion(raw)) return undefined;
  const parsed = parseNaturalSpendScenario(raw, [...expenseCategories, ...data.settings.customCategories]);
  const amount = spendAmount(raw, extracted, parsed.amount) * (extracted?.amount ? 1 : repeatFactor(raw));
  if (!amount || amount <= 0) return undefined;
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // „pe tichete”, „cash”, „cu cardul Anei”: sursa, nu o parte din titlu.
  const payment = readPaymentHint(raw);
  const titleSource = payment.sourceHint ? payment.rest.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "") : folded;
  const draftTitle = spendTitle(titleSource, extracted, parsed.category || "Altele");
  const habit = findHabit(memory, raw, draftTitle);
  /**
   * „Am 1800 lei de împărțit în plicuri până pe 9 octombrie” nu este o plată de 1.800 de lei.
   *
   * `looksSpend` de mai jos acceptă orice propoziție care conține „pe ”, așa că o frază
   * despre planificare ajungea propunere de cheltuială, cu suma și ziua la locul lor —
   * gata de confirmat din greșeală. Cuvintele de plic și de împărțire opresc drumul ăsta,
   * dar numai cât timp nimeni nu spune că a și plătit ceva: „am dat 50 din plicul de
   * alimente” rămâne cheltuială.
   */
  const spendsMoney = /cheltui|platit|plateste|cumpar|am dat|am luat|am scos/.test(folded);
  if (!forced && plansMoney(raw) && !spendsMoney) return undefined;
  const looksSpend = forced
    || Boolean(habit)
    || /cheltui|adaug|inregist|platit|cumpar|cumpăr|m-?a costat|a costat|au costat|s-?au dus|taxi|uber|bolt|apa\b|dulce|dulciuri|tigar|tutun|factura|benzina|combustibil|mancare|uitat|\bpe |\bpentru /.test(folded)
    || Boolean(parsed.category && !/venit|salariu|intrare/.test(folded));
  if (!looksSpend || INCOME_WORDS.test(folded)) return undefined;
  const category = (parsed.category && parsed.category !== "Altele") ? parsed.category : (habit?.category || extracted?.category || "Altele");
  const title = draftTitle === "Altele" && habit ? habit.title : draftTitle;
  const date = extracted?.date && /^20\d{2}-\d{2}-\d{2}$/.test(extracted.date) ? extracted.date : spendDate(raw);
  const built = buildExpenseOffer(data, { amount, title, category, date, sourceHint: payment.sourceHint, ownerHint: payment.ownerHint }, memory);
  const offer = payment.sourceHint && built.spend ? { ...built, spend: { ...built.spend, sourceHint: payment.sourceHint, ownerHint: payment.ownerHint } } : built;
  const extra = receiptDetails(extracted, title);
  if (!extra) return offer;
  return { ...offer, text: withReceiptDetails(offer.text, extra) };
}

/** Cuvintele după care un mesaj aduce bani, nu scoate: salariu, pensie, alocație, un câștig, o vânzare. */
export const INCOME_WORDS = /venit|salariu|leaf[aă]|intrare|am primit|mi-?a venit|mi-?a intrat|mi-?au (dat|trimis|venit)|mi-?a (dat|trimis|platit)|mi-?au platit|mi s-?a (returnat|dat|platit|virat)|returnat|am incasat|incasat|am castigat|castig|pensi|alocati|freelanc|cashback|dividend|am vandut|\bolx\b|bonus|\bprima\b|\bbursa\b|rambursa|primit inapoi|mi-?a dat inapoi/;
/** Titlul venitului după cuvântul lui, ca în registru să nu fie totul „Venit”. */
const INCOME_TITLES: Array<[RegExp, string]> = [
  [/pensi/, "Pensie"], [/alocati/, "Alocație"], [/freelanc|client/, "Freelance"], [/pariu|castig/, "Câștig"],
  [/cashback/, "Cashback"], [/dividend/, "Dividende"], [/vandut|olx/, "Vânzare"], [/bonus/, "Bonus"], [/\bprima\b/, "Primă"],
  [/\bbursa\b/, "Bursă"], [/rambursa|inapoi/, "Bani primiți înapoi"], [/chiri/, "Chirie încasată"], [/parinti|ai mei|mama|tata/, "Bani de la familie"],
];

export function incomeProposal(raw: string, data: AppData): { text: string; choices: ChatChoice[] } | undefined {
  const folded = foldRo(raw);
  if (!INCOME_WORDS.test(folded)) return undefined;
  if (/cheltui|tigar|tutun|taxi|suc|bere|paine|gume|factura/.test(folded) && !/salariu|venit/.test(folded)) return undefined;
  const amount = spendAmount(raw, undefined, 0);
  // Un cashback de 25 de lei e un venit adevărat; pragul de 50 rămâne doar pentru „venit” vag.
  const specific = INCOME_TITLES.some(([pattern]) => pattern.test(folded)) || /salariu|leaf/.test(folded);
  if (!amount || amount < (specific ? 1 : 50)) return undefined;
  const title = /sotie|sotiei|partener/.test(folded) ? t("Salariul soției") : /salariu|leaf/.test(folded) ? "Salariu" : (INCOME_TITLES.find(([pattern]) => pattern.test(folded))?.[1] || "Venit");
  const date = spendDate(raw);
  return {
    text: noDoubleStop(`Am înțeles **${title}**, ${money(amount)}, **${dateCopy(date)}**. Îl trec în registru pe ziua aleasă?`),
    choices: [{ label: `Adaugă venitul · ${money(amount)}`, update: { kind: "income", amount, title, date, memberId: memberIdFor(data, raw, /sotie|sotiei|partener/.test(folded) ? 1 : 0) } }],
  };
}

export function transferProposal(raw: string, data: AppData): { text: string; choices: ChatChoice[] } | undefined {
  const folded = foldRo(raw);
  if (!/\b(mut[ae]|transfer|treci|trece|realoc)/.test(folded) && !/\bia\b.*\b(pune|baga|muta)\b/.test(folded)) return undefined;
  const amount = spendAmount(raw, undefined, 0);
  if (!amount) return undefined;
  // „din X în Y”, „de la X la Y”, „din X și pune la Y”.
  const pair = folded.match(/\b(?:din|de pe|de la)\s+([a-z0-9 &]+?)\s+(?:si\s+(?:pune|baga|muta)-?(?:i|l)?\s+)?(?:in|spre|catre|la)\s+([a-z0-9 &]+)/);
  if (!pair) return undefined;
  const from = matchEnvelope(data, pair[1]);
  const to = matchEnvelope(data, pair[2]);
  if (!from || !to) {
    const missing = !from ? pair[1].trim() : pair[2].trim();
    return { text: `Nu găsesc un plic **${missing}**. Spune-mi numele exact sau creează-l întâi în Plan.`, choices: [] };
  }
  if (from.id === to.id) return undefined;
  const left = allocationStatus(data, from).remaining;
  if (left < amount) {
    return { text: `În **${from.label}** mai sunt ${money(left)}, nu ajung ${money(amount)} de mutat.`, choices: [] };
  }
  return {
    text: `Mut **${money(amount)}** din **${from.label}** în **${to.label}**? Banii rămân pe același card, se mută doar între plicuri.`,
    choices: [{ label: `Mută ${money(amount)}`, update: { kind: "transfer", amount, fromId: from.id, toId: to.id, fromLabel: from.label, toLabel: to.label } }],
  };
}

/**
 * „Deschide-mi Planul.”
 *
 * Ecranele aplicației au nume, iar omul le folosește. Până acum, o cerere de navigare
 * nu însemna nimic pentru ghid: mesajul pleca la model sau cădea în gol, deși nu e nimic
 * de înțeles acolo. Verbele acceptate sunt doar cele care chiar cer o deschidere —
 * „arată-mi cât am cheltuit” rămâne o întrebare cu răspuns, nu un ecran.
 */
const OPEN_VERB = /\b(deschide|deschide-?mi|deschidemi|du-?ma la|duma la|mergi la|mergem la|intra in|hai la|navigheaza la)\b/;
const SCREEN_WORDS: Array<[AppScreen, RegExp]> = [
  ["plan", /\bplan(ul|ului)?\b|\bplicuri(le)?\b/],
  ["journal", /\bmiscari(le)?\b|\bjurnal(ul|e)?\b|\bregistru(l)?\b|\bcheltuieli(le)?\b/],
  ["insights", /\banaliz[ae]\b|\brapoarte(le)?\b|\bstatistici(le)?\b/],
  ["obligations", /\bobligatii(le)?\b|\bscadente(le)?\b|\bdatorii(le)?\b|\brate(le)?\b/],
  ["goals", /\bobiective(le)?\b|\beconomii(le)?\b/],
  ["habits", /\bobiceiuri(le)?\b/],
  ["calendar", /\bcalendar(ul)?\b|\bevenimente(le)?\b/],
  ["utilities", /\bsetari(le)?\b|\bmai mult\b|\bunelte(le)?\b|\bbackup\b|\bsincroniz/],
  ["today", /\bastazi\b|\becranul principal\b|\bacasa\b|\bpagina de start\b/],
];

function openReading(raw: string): Reading | undefined {
  const folded = foldRo(raw);
  if (!OPEN_VERB.test(folded)) return undefined;
  const found = SCREEN_WORDS.find(([, pattern]) => pattern.test(folded));
  if (!found) return undefined;
  return {
    kind: "intents",
    score: BASE.intents,
    why: "cere deschiderea unui ecran",
    intents: [{ intent: { kind: "open", screen: found[0] }, segment: raw }],
  };
}

/**
 * Ce spune modelul despre lucruri care există deja în aplicație — un plic, un eveniment,
 * o scadență — trebuie să se lege de ele, nu să sune bine.
 *
 * Cazul care a cerut funcția: „mută 200 din transport în alimente” se întorcea de la model
 * ca o mutare între două nume. Fără plicuri reale în spatele numelor, aplicația nu avea ce
 * face cu ea și o arunca în tăcere, iar omul primea un răspuns general, ca și cum n-ar fi
 * cerut nimic. Acum numele se caută în registrul lui: dacă se găsesc, intenția pleacă mai
 * departe cu numele exacte; dacă nu, se spune pe față ce lipsește.
 */
export function resolveIntents(intents: ParsedIntent[], data: AppData): { kept: ParsedIntent[]; missing: string[] } {
  const kept: ParsedIntent[] = [];
  const missing: string[] = [];
  for (const parsed of intents) {
    const intent = parsed.intent;
    if (intent.kind === "transfer") {
      const from = matchEnvelope(data, intent.from);
      const to = matchEnvelope(data, intent.to);
      if (!from || !to || from.id === to.id) {
        missing.push(t("plicul „{name}”", { name: !from ? intent.from : intent.to }));
        continue;
      }
      kept.push({ ...parsed, intent: { ...intent, from: from.label, to: to.label } });
      continue;
    }
    if (intent.kind === "event-contribution") {
      const event = matchPlannedEvent(data, intent.name);
      if (!event) {
        missing.push(t("evenimentul „{name}”", { name: intent.name }));
        continue;
      }
      kept.push({ ...parsed, intent: { ...intent, name: event.name } });
      continue;
    }
    if (intent.kind === "transaction-delete" || intent.kind === "transaction-amend") {
      const found = matchTransaction(data, { title: intent.title, amount: intent.kind === "transaction-delete" ? intent.amount : intent.was, date: intent.date });
      if (!found) {
        missing.push(t("mișcarea „{name}”", { name: intent.title || money(intent.kind === "transaction-delete" ? intent.amount || 0 : intent.was || intent.amount) }));
        continue;
      }
      kept.push(parsed);
      continue;
    }
    if (intent.kind === "salary-rule") {
      const envelope = matchEnvelope(data, intent.envelope);
      if (!envelope) {
        missing.push(t("plicul „{name}”", { name: intent.envelope }));
        continue;
      }
      kept.push({ ...parsed, intent: { ...intent, envelope: envelope.label } });
      continue;
    }
    if (intent.kind === "merchant-rule") {
      const envelope = intent.envelope ? matchEnvelope(data, intent.envelope) : undefined;
      if (intent.envelope && !envelope && !intent.category) {
        missing.push(t("plicul „{name}”", { name: intent.envelope }));
        continue;
      }
      kept.push({ ...parsed, intent: { ...intent, envelope: envelope?.label } });
      continue;
    }
    if (intent.kind === "due-paid") {
      const due = matchRecurring(data, intent.name);
      if (!due) {
        missing.push(t("scadența „{name}”", { name: intent.name }));
        continue;
      }
      kept.push({ ...parsed, intent: { ...intent, name: due.name } });
      continue;
    }
    kept.push(parsed);
  }
  return { kept, missing };
}

export function localInsight(raw: string, data: AppData, memory: GuideMemory): string | undefined {
  const folded = foldRo(raw);
  if (!/cat (mai )?am|ramas|sold|situat|bilant|plicur|nealo|obicei|ce mai am|cat am pe/.test(folded)) return undefined;
  if (/adaug|cheltui|repartiz/.test(folded)) return undefined;
  // „cum funcționează plicurile?” cere o explicație, nu soldurile.
  if (/cum (functioneaza|merge|folosesc)|ce inseamna|la ce (foloseste|serveste)/.test(folded)) return undefined;
  const envelopes = data.settings.salaryPlan.allocations.map((envelope) => {
    const week = isWeeklyPaced(envelope, data.settings.salaryPlan) ? allocationWeekStatus(data, envelope) : undefined;
    const left = week ? week.remaining : allocationStatus(data, envelope).remaining;
    return `• ${envelope.label}${week ? ` · S${week.index}` : ""}: ${money(left)}`;
  });
  const sources = data.settings.paymentSources.map((source) => `• ${source.name}: ${money(sourceBalance(data, source.id))}`);
  const unrepartized = planAllocationMath(data).unrepartized;
  const free = unrepartized > 0.005 ? `\n• ${t("Liber, fără plic")}: ${money(unrepartized)}` : "";
  const known = memory.phrases.filter((item) => item.count >= 2).slice(-6).map((item) => item.title);
  const learned = known.length ? `\nȚin minte de la tine: ${known.join(", ")}.` : "";
  /**
   * Cifra de pe ecran spune ce e liber azi. Ce urmează în calendar nu e liber:
   * un Crăciun la trei săptămâni distanță, nefinanțat, schimbă înțelesul sumei.
   */
  const ahead = plannedEventsPressure(data.settings.plannedEvents, isoToday(), 90);
  const events = ahead.next && ahead.remaining > 0.005
    ? `\n${t("Urmează {name} pe {date}: mai ai de strâns {amount}.", { name: ahead.next.event.name, date: dateCopy(ahead.next.date), amount: money(ahead.remaining) })}`
    : "";
  return `Uite ce e disponibil, din registrul de pe telefon:${envelopes.length ? `\n${envelopes.join("\n")}` : ""}\n${sources.join("\n")}${free}${events}${learned}`;
}

/* ------------------------------------------------- corectarea unei greșeli */

/**
 * „Șterge ultima cheltuială”, „am greșit, era 60 nu 50”.
 *
 * Pe telefon se scrie repede și se greșește. Până acum, singura cale de anulare
 * era butonul de sub mesaj, cât timp mesajul se mai vedea; după ce se derula,
 * rămânea căutarea rândului în Mișcări. Iar o frază ca „șterge ultima cheltuială”
 * nu era înțeleasă de nimeni, deci nu se întâmpla nimic.
 *
 * Nimic nu se șterge sau se schimbă fără confirmare: aici se face doar propunerea,
 * cu mișcarea numită pe față, ca omul să vadă exact peste ce dă.
 */
const lastMovement = (data: AppData, amount?: number) => {
  // Mișcările noi se pun în față, deci prima potrivire este cea mai recentă.
  const rows = data.transactions.filter((item) => (amount === undefined ? true : Math.abs(item.amount - amount) < 0.005));
  return rows[0];
};

export function reviseProposal(raw: string, data: AppData): Proposal | undefined {
  const folded = foldRo(raw);

  const amendment = folded.match(/\bera\s+(\d+(?:[.,]\d{1,2})?)\s*(?:lei|ron)?[,\s]+(?:nu|nu era)\s+(\d+(?:[.,]\d{1,2})?)/)
    || folded.match(/\b(?:schimba|modifica|corecteaza)\s+(?:suma|valoarea|ultima\s+(?:cheltuiala|miscare|suma)|ultimul\s+venit)\s+(?:in|la)\s+(\d+(?:[.,]\d{1,2})?)/)
    // „am greșit suma, era 45”: suma corectă, pe ultima mișcare.
    || folded.match(/\bam (?:gresit|scris gresit|pus gresit)(?:\s+suma)?[,\s]+(?:era|erau|e|sunt|trebuia(?:\s+sa\s+fie)?|corect e)\s+(\d+(?:[.,]\d{1,2})?)/);
  if (amendment) {
    const value = (token: string) => parseFloat(token.replace(",", "."));
    // „era 60, nu 50”: 60 e corect, 50 e ce s-a scris greșit.
    const corrected = value(amendment[1]);
    const wrong = amendment[2] ? value(amendment[2]) : undefined;
    const target = lastMovement(data, wrong);
    if (!target) {
      return { text: wrong !== undefined
        ? `Nu găsesc o mișcare de ${money(wrong)} pe care s-o corectez. Spune-mi denumirea ei.`
        : "Nu am ce corecta — nu ai încă nicio mișcare în registru.", choices: [] };
    }
    if (!corrected || corrected <= 0) return undefined;
    return {
      text: `Schimb **${target.title}** din ${money(target.amount)} în **${money(corrected)}**?`,
      choices: [{ label: `Schimbă în ${money(corrected)}`, update: { kind: "amend-transaction", id: target.id, amount: corrected, title: target.title, was: target.amount } }],
    };
  }

  const removal = /\b(sterge|sterg|anuleaza|anulez|elimina|scoate|scoate-o|da inapoi)\b/.test(folded)
    && /\b(ultima|ultimul|ultim|ce am adaugat|ce am trecut|miscarea|cheltuiala|venitul|inregistrarea)\b/.test(folded);
  if (!removal) return undefined;
  const target = lastMovement(data);
  if (!target) return { text: "Nu ai nicio mișcare în registru, deci nu am ce șterge.", choices: [] };
  return {
    text: `Șterg **${target.title}**, ${money(target.amount)} din ${dateCopy(target.date)}?`,
    choices: [{ label: `Șterge ${target.title}`, update: { kind: "delete-transaction", id: target.id, title: target.title, amount: target.amount } }],
  };
}

/**
 * Propunerea e încă pe ecran, nu în registru. „Nu e 7,99, e 66” și „magazinul e Mega Image”
 * rescriu oferta, nu caută o mișcare salvată și nu deschid o cheltuială nouă.
 */
export type PendingSpend = { amount: number; title: string; category: string; date: string; vendor?: string; receipt?: boolean; sourceHint?: "meal" | "cash" | "card"; ownerHint?: string; allocationId?: string };

const SPOKEN_AMOUNT = String.raw`(\d{1,6}(?:[.,]\d{1,2})?)`;
const CATEGORY_ALIASES: Array<[RegExp, string]> = [
  [/^(alimente|mancare|cumparaturi)$/, "Alimente"],
  [/^(transport|benzina|taxi)$/, "Transport"],
  [/^(casa|facturi|chirie)$/, "Casă & facturi"],
  [/^(sanatate|farmacie)$/, "Sănătate"],
  [/^(educatie|scoala|gradinita)$/, "Educație"],
  [/^(timp liber)$/, "Timp liber"],
  [/^(bauturi)$/, "Băuturi"],
  [/^(apa)$/, "Apă"],
  [/^(dulciuri)$/, "Dulciuri"],
  [/^(abonamente)$/, "Abonamente"],
  [/^(credite)$/, "Credite"],
  [/^(altele|diverse)$/, "Altele"],
  [/^(copil|consumabile)$/, "Consumabile copil"],
];

function spokenAmount(token: string) {
  const value = parseFloat(token.replace(",", "."));
  return Number.isFinite(value) && value > 0 && value < 1_000_000 ? Math.round(value * 100) / 100 : undefined;
}

function tidyName(raw: string) {
  const cleaned = raw
    .replace(/\b(?:totalul|suma|categoria|categorie|de fapt|the total|category|lei|ron)\b.*$/i, "")
    .replace(/\d[\d.,]*/g, " ")
    .replace(/[,:.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 2 || cleaned.length > 32) return undefined;
  return cleaned.split(" ").map((word) => word.charAt(0).toLocaleUpperCase("ro-RO") + word.slice(1)).join(" ");
}

function namedCategory(phrase: string, data: AppData) {
  const words = foldRo(phrase).replace(/[^a-z0-9 &]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  for (let size = Math.min(3, words.length); size >= 1; size -= 1) {
    const candidate = words.slice(0, size).join(" ");
    const known = [...expenseCategories, ...data.settings.customCategories].find((item) => foldRo(item) === candidate);
    if (known) return known;
    const alias = CATEGORY_ALIASES.find(([pattern]) => pattern.test(candidate));
    if (alias) return alias[1];
  }
  return undefined;
}

/**
 * „Și 30 parcare” cu o propunere pe ecran: încă o cheltuială, în aceeași zi cu prima,
 * dacă omul n-a spus alta.
 */
export function addOnSpend(raw: string, pending: PendingSpend, data: AppData, memory: GuideMemory = emptyGuideMemory()): Proposal | undefined {
  const hit = raw.trim().match(/^(?:și|si|plus|iar|încă|inca|apoi)\s+(.*\d.*)$/i);
  if (!hit) return undefined;
  const rest = hit[1];
  const said = expenseProposal(rest, undefined, data, memory, true) as Proposal | undefined;
  if (!said?.spend) return undefined;
  const namesDay = /\b(azi|astazi|ieri|alaltaieri|maine|pe \d{1,2}\b|\d{1,2}[./]\d{1,2})/.test(foldRo(rest));
  if (namesDay || said.spend.date === pending.date) return said;
  const payment = readPaymentHint(rest);
  return buildExpenseOffer(data, { ...said.spend, date: pending.date, sourceHint: payment.sourceHint, ownerHint: payment.ownerHint }, memory);
}

/** „A fost ieri”, „de fapt pe 25”, „era alaltăieri”: doar ziua se schimbă. */
const DAY_ONLY = /^(?:(?:nu azi|nu ieri)[, ]*)?(?:(?:a fost|era|de fapt|am uitat,?|scuze,?|nu,?|ba)\s+)*(?:(?:tot\s+)?(azi|astazi|ieri|alaltaieri)|pe\s+(\d{1,2})(?:\s+[a-z]+)?|(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?))$/;

/** „Pune-o pe cash”, „cu tichete”, „de pe cardul Anei”: doar sursa se schimbă. */
const SOURCE_ONLY = /^(?:(?:nu|ba|de fapt|scuze)[, ]+)*(?:(?:pune-?o|pune-?l|trece-?o|trece-?l|treci-?o|pune|treci|am platit|platit|a fost|era|dar|de fapt)\s+)*(?:(?:pe|cu|din|de pe|in)\s+)?(?:cash|numerar|bani gheata|tichete(?:le)?(?: de masa)?|bonuri(?:le)? de masa|card(?:ul)?(?:\s+[a-z]+)?)$/;

export function correctPendingSpend(raw: string, pending: PendingSpend, data: AppData, memory: GuideMemory = emptyGuideMemory()): Proposal | undefined {
  const folded = foldRo(raw).replace(/[?!]/g, " ").replace(/\s+/g, " ").trim();
  if (!folded || !(pending.amount > 0)) return undefined;
  if (/\b(am dat|am platit|am cumparat|adauga|noteaza|treci)\b/.test(folded) && !/\b(nu|totalul|suma|de fapt|corect|magazin|categoria|categorie)\b/.test(folded) && !SOURCE_ONLY.test(folded)) return undefined;

  let amount = pending.amount;
  let title = pending.title;
  let category = pending.category;
  let date = pending.date;
  let sourceHint = pending.sourceHint;
  let ownerHint = pending.ownerHint;
  let allocationId = pending.allocationId;
  let changed = false;

  const dayOnly = folded.replace(/[.,]$/, "").match(DAY_ONLY);
  if (dayOnly) {
    const next = spendDate(raw);
    if (next !== date) { date = next; changed = true; }
  }
  if (SOURCE_ONLY.test(folded.replace(/[.,]$/, ""))) {
    const payment = readPaymentHint(raw);
    if (payment.sourceHint && (payment.sourceHint !== sourceHint || payment.ownerHint !== ownerHint)) {
      sourceHint = payment.sourceHint;
      ownerHint = payment.ownerHint;
      changed = true;
    }
  }
  const envelope = folded.match(/^(?:(?:nu|de fapt|scuze|ba)[, ]+)*(?:(?:scoate-?o|scoate-?l|ia-?i|pune-?o|trece-?o)\s+)?din\s+plic(?:ul)?\s+(?:de\s+|pentru\s+)?([a-z][a-z &]{1,30})$/);
  if (envelope) {
    const found = matchEnvelope(data, envelope[1]);
    if (found && found.id !== allocationId) { allocationId = found.id; changed = true; }
  }
  const meant = folded.match(new RegExp(`^(?:(?:nu|scuze|ba)[, ]+)*(?:am vrut sa (?:zic|scriu)|voiam sa (?:zic|scriu)|era(?:u)?|au fost|a fost|de fapt(?: au fost| a fost| era)?)\\s+${SPOKEN_AMOUNT}\\s*(?:lei|ron)?$`));
  if (meant) {
    const next = spokenAmount(meant[1]);
    if (next && next !== amount) { amount = next; changed = true; }
  }

  const notThen = folded.match(new RegExp(`\\b(?:nu e|not)\\s+${SPOKEN_AMOUNT}\\s*(?:lei|ron)?\\s*[,.]?\\s*(?:e|este|it's|it is)\\s+${SPOKEN_AMOUNT}`));
  const era = folded.match(new RegExp(`\\bera\\s+${SPOKEN_AMOUNT}\\s*(?:lei|ron)?[,\\s]+(?:nu|nu era)\\s+${SPOKEN_AMOUNT}`));
  const stated = folded.match(new RegExp(`\\b(?:the total|totalul|suma|corect(?:ul)?|de fapt|total)\\s+(?:e|este|is|ar fi)?\\s*${SPOKEN_AMOUNT}\\b`));
  const noComma = folded.match(new RegExp(`^(?:nu|ba|no)\\s*[,:]\\s*(?:e|este|it's|it is)?\\s*${SPOKEN_AMOUNT}\\s*(?:lei|ron)?$`));
  const changeTo = folded.match(new RegExp(`\\b(?:schimba|schimb)\\s+(?:suma|totalul|valoarea)\\s+(?:in|la|to)\\s+${SPOKEN_AMOUNT}`));

  if (notThen) {
    const next = spokenAmount(notThen[2]);
    if (next) { amount = next; changed = true; }
  } else if (era) {
    const corrected = spokenAmount(era[1]);
    const wrong = spokenAmount(era[2]);
    if (!corrected || wrong === undefined || Math.abs(wrong - pending.amount) > 0.02) return undefined;
    amount = corrected;
    changed = true;
  } else if (stated?.[1]) {
    const next = spokenAmount(stated[1]);
    if (next) { amount = next; changed = true; }
  } else if (noComma?.[1]) {
    const next = spokenAmount(noComma[1]);
    if (next) { amount = next; changed = true; }
  } else if (changeTo?.[1]) {
    const next = spokenAmount(changeTo[1]);
    if (next) { amount = next; changed = true; }
  }

  const store = folded.match(/\b(?:magazinul|magazin|store|shop)\s+(?:se numeste\s+|e\s+|este\s+|is\s+)?([a-z0-9][a-z0-9 &'._-]{1,40})/);
  const swapped = folded.match(/\bnu e\s+([a-z][a-z .'-]{1,24}),\s*e\s+([a-z0-9][a-z0-9 &'._-]{1,32})/);
  const explicitCategory = folded.match(/\b(?:categoria|categorie|category)\s+(?:e|este|is)?\s*([a-z][a-z &]{2,32})/);
  const categoryPhrase = explicitCategory?.[1] || (swapped && namedCategory(swapped[2], data) ? swapped[2] : "");
  const nextCategory = categoryPhrase ? namedCategory(categoryPhrase, data) : undefined;
  if (nextCategory && nextCategory !== category) {
    category = nextCategory;
    changed = true;
  }
  const storePhrase = store?.[1] || (swapped && !namedCategory(swapped[2], data) ? swapped[2] : "");
  const nextTitle = storePhrase ? tidyName(storePhrase) : undefined;
  if (nextTitle && foldRo(nextTitle) !== foldRo(title)) {
    title = nextTitle;
    changed = true;
  }
  if (!changed) return undefined;
  if (amount === pending.amount && title === pending.title && category === pending.category && date === pending.date && sourceHint === pending.sourceHint && ownerHint === pending.ownerHint && allocationId === pending.allocationId) return undefined;

  const built = preferEnvelope(buildExpenseOffer(data, { amount, title, category, date, sourceHint, ownerHint }, memory), allocationId);
  const offer: Proposal = { ...built, spend: built.spend && { ...built.spend, sourceHint, ownerHint, allocationId } };
  if (allocationId && !offer.choices.some((choice) => choice.update.kind === "expense" && choice.update.allocationId === allocationId)) {
    const label = data.settings.salaryPlan.allocations.find((item) => item.id === allocationId)?.label || "";
    offer.text = noDoubleStop(`${offer.text} În **${label}** nu mai sunt destui bani pentru suma asta.`);
  }
  if (!pending.receipt) return { ...offer, text: noDoubleStop(`Corectat. ${offer.text}`) };
  const extra = receiptDetails({ amount, vendor: title, title, category, confidence: "high" }, title);
  return { ...offer, text: noDoubleStop(`Corectat. ${withReceiptDetails(offer.text, extra)}`) };
}

/** Plicul folosit de obicei urcă primul în listă. */
const preferEnvelope = (offer: Proposal, allocationId?: string): Proposal => {
  if (!allocationId) return offer;
  const first = offer.choices.filter((choice) => choice.update?.kind === "expense" && choice.update.allocationId === allocationId);
  return { ...offer, choices: [...first, ...offer.choices.filter((choice) => !first.includes(choice))] };
};

/**
 * „Cafea”, fără sumă: suma pe care o dai de obicei, din registru. „La fel ca ieri”,
 * „ca data trecută la Lidl”: aceeași cheltuială încă o dată, azi. Tot o propunere.
 */
export function habitProposal(raw: string, data: AppData, memory: GuideMemory, asOf: string): { proposal: Proposal; repeat: boolean } | undefined {
  const again = repeatedSpend(data, raw, asOf);
  if (again) {
    const offer = buildExpenseOffer(data, { amount: again.amount, title: again.title, category: again.category, date: asOf }, memory);
    const lead = `Ca ${/^(azi|ieri|alalt)/.test(dateCopy(again.date, asOf)) ? "" : "pe "}${dateCopy(again.date, asOf)}: **${again.title}**, ${money(again.amount)}.`;
    return { repeat: true, proposal: { ...preferEnvelope(offer, again.allocationId), text: noDoubleStop(`${lead} ${offer.text}`) } };
  }
  const usual = usualSpend(data, raw, asOf);
  if (!usual) return undefined;
  const offer = buildExpenseOffer(data, { amount: usual.amount, title: usual.title, category: usual.category, date: spendDate(raw) }, memory);
  const lead = `De obicei dai **${money(usual.amount)}** pe **${usual.title}** (de ${usual.count} ori în ultimele luni). Dacă a fost altă sumă, scrie-mi-o.`;
  return { repeat: false, proposal: { ...preferEnvelope(offer, usual.allocationId), text: noDoubleStop(`${lead} ${offer.text}`) } };
}

/**
 * „Am plătit chiria.” Fără sumă — fiindcă suma o știe deja aplicația, din
 * scadențele pe care le-ai trecut în Plan. Până acum o astfel de frază nu era
 * înțeleasă de nimeni: cheltuiala are nevoie de o sumă, iar aici nu era niciuna.
 *
 * Propunem plata scadenței cu suma ei, dar numai dacă n-a fost deja trecută în
 * perioada curentă — altfel am invita omul să plătească de două ori.
 */
export function paidRecurringProposal(raw: string, data: AppData): Proposal | undefined {
  const folded = foldRo(raw);
  // „Am plătit chiria”, dar și „chiria e plătită”.
  if (!/\b(am platit|am achitat|platit[aă]?|achitat[aă]?|am dat-?o|am dat-?l|gata cu)\b/.test(folded)) return undefined;
  if (/\d/.test(folded)) return undefined; // cu sumă scrisă, o citește cheltuiala obișnuită
  /**
   * „Chiria” nu conține „chirie”: româna schimbă terminația, iar o potrivire
   * exactă ar rata tocmai felul firesc de a spune lucrul. Comparăm pe rădăcină.
   */
  const due = data.recurring.find((item) => {
    const name = foldRo(item.name);
    if (item.active === false || name.length < 4) return false;
    return folded.includes(name) || folded.includes(name.slice(0, name.length - 1));
  });
  if (!due) return undefined;
  const already = data.transactions.some((item) => item.recurringId === due.id && inPlanPeriod(item.date, data.settings.salaryPlan));
  if (already) {
    return { text: `**${due.name}** este deja trecută în perioada asta. Nu o trec a doua oară.`, choices: [] };
  }
  const source = data.settings.paymentSources.find((item) => item.id === due.sourceId) || data.settings.paymentSources[0];
  const matched = matchingAllocationsForExpense(data, { category: due.category, memberId: due.memberId, sourceId: due.sourceId })[0];
  const from = matched ? `din plicul „${matched.label}”` : source ? `din ${source.name}` : "";
  return {
    text: `Am înțeles: **${due.name}**, ${money(due.amount)}${from ? `, ${from}` : ""}. O trec în registru?`,
    choices: [{
      label: `Plătește ${due.name} · ${money(due.amount)}`,
      update: { kind: "expense", amount: due.amount, title: due.name, category: due.category, date: today(), sourceId: source?.id, allocationId: matched?.id || "outside", memberId: due.memberId, recurringId: due.id },
    }],
  };
}

/* ---------------------------------------------------------------------------
   Citirea mesajului
   --------------------------------------------------------------------------- */

export type Proposal = { text: string; choices: ChatChoice[]; /** Ce s-a înțeles, ca o corectură din chat să rescrie propunerea chiar dacă nu există plic. */ spend?: { amount: number; title: string; category: string; date: string; sourceHint?: "meal" | "cash" | "card"; ownerHint?: string; allocationId?: string } };

/** O citire posibilă a mesajului, cu cât de tare o susține textul și de ce. */
/**
 * `soft` = am înțeles ceva, dar probabil nu tot.
 *
 * Citirea locală câștiga întotdeauna în fața modelului online, chiar și când lăsa pe
 * dinafară jumătate din mesaj: „am 1800 de lei pe care îi împart în plicuri până pe 9
 * octombrie” se oprea la dată, iar cei 1800 și plicurile dispăreau fără ca cineva să
 * afle. Marcajul nu schimbă cine câștigă local — spune doar că, dacă există rețea,
 * merită întrebat modelul înainte de a răspunde cu o bucată.
 */
export type Reading = { soft?: true } & (
  | { kind: "confirm"; score: number; why: string }
  | { kind: "revise"; score: number; why: string; proposal: Proposal }
  | { kind: "intents"; score: number; why: string; intents: ParsedIntent[]; /** Titlu propriu al propunerii, când nu e o simplă înțelegere a mesajului. */ headline?: string }
  | { kind: "question"; score: number; why: string; answer: AnalystAnswer }
  | { kind: "expense"; score: number; why: string; proposal: Proposal }
  | { kind: "transfer"; score: number; why: string; proposal: Proposal }
  | { kind: "due"; score: number; why: string; proposal: Proposal }
  | { kind: "income"; score: number; why: string; proposal: Proposal }
  | { kind: "insight"; score: number; why: string; text: string }
);

export type UnderstandContext = {
  memory?: GuideMemory;
  asOf?: string;
  categories?: string[];
  /** Un bon fotografiat sau un răspuns al modelului: atunci cheltuiala nu mai trebuie dedusă din cuvinte. */
  extracted?: ExtractedGuide;
  forcedExpense?: boolean;
};

/**
 * Scorurile de pornire reproduc exact ordinea de până acum, ca mutarea să nu
 * schimbe nimic din ce vede omul. Diferența este că ordinea a devenit un număr
 * într-un tabel, nu poziția unui `return` în funcție: de acum se poate măsura pe
 * un corpus de fraze și se poate corecta acolo unde greșește, fără să se rupă
 * restul.
 */
const BASE = { confirm: 100, revise: 95, intents: 90, question: 80, due: 78, transfer: 75, expense: 70, income: 50, insight: 40 } as const;

/**
 * „Împarte-mi 1800 în plicuri”, „fă-mi un plan pentru banii ăștia”.
 *
 * Până acum, cererea asta fie nu era înțeleasă deloc, fie fabrica un plic numit „Plic nou”
 * cu toți banii în el. Acum devine o propunere adevărată: plicuri cu nume și sume, calculate
 * din ce are familia (plicurile de dinainte, altfel cheltuielile ultimelor 90 de zile), cu
 * scadențele scoase deoparte. Dacă nu știm nimic despre familie, nu propunem nimic — mesajul
 * pleacă la model, care poate întreba.
 */
const WANTS_SPLIT = /\b(imparte|imparti|impart[ei]?|impartim|reparti\w*|fa-?mi un plan|fa un plan|un plan (pentru|pe)|cum (sa )?impart)\b/;

/**
 * Câte săptămâni are ciclul curent. Aceeași socoteală ca pe ecranul planului, ca ritmul
 * spus în propunere („~275 pe săptămână”) să fie chiar cel pe care îl va vedea omul.
 */
export function planWeeks(data: AppData): number {
  const plan = data.settings.salaryPlan;
  const end = planEndDate(plan);
  if (!end || !plan.periodStart) return 1;
  const days = periodDays(plan.periodStart, end);
  return Math.max(1, Math.ceil(Math.max(1, days) / 7));
}

/** Banii pe care aplicația îi vede acum, plus cei declarați în aceeași frază. */
function visibleMoney(data: AppData, altele: ParsedIntent[]): number {
  const declarati = altele.reduce((sum, item) => item.intent.kind === "funds" ? sum + item.intent.amount : sum, 0);
  return Math.max(0, planAllocationMath(data).unrepartized) + declarati;
}

/**
 * Împărțirea spusă pe nume bate orice propunere a noastră.
 *
 * „Împarte-l pe săptămâni: alimente 800, transport 300, restul diverse” ieșea ca un singur
 * plic cu un nume făcut din toate cuvintele frazei. Omul spusese exact ce vrea; noi îi
 * dădeam altceva și îi ceream să confirme. Aici fiecare nume devine plicul lui, „restul”
 * primește ce rămâne din banii văzuți, iar „pe săptămâni” dă ritmul tuturor.
 */
function namedSplitReading(raw: string, folded: string, data: AppData, altele: ParsedIntent[]): Reading | undefined {
  const lines = explicitSplitLines(raw, data.settings.merchantRules);
  if (lines.length < 2) return undefined;
  const weekly = /saptaman/.test(folded);
  const spuse = lines.reduce((sum, line) => sum + (line.amount || 0), 0);
  const libere = visibleMoney(data, altele);
  const ramas = Math.round((libere - spuse) * 100) / 100;
  const plicuri = lines
    .map((line) => ({ ...line, amount: line.amount ?? (line.rest && ramas > 0 ? ramas : 0) }))
    .filter((line) => line.amount > 0);
  if (plicuri.length < 2) return undefined;
  const intents: ParsedIntent[] = [
    ...altele.filter((item) => item.intent.kind !== "envelope"),
    ...plicuri.map((line) => ({
      intent: { kind: "envelope" as const, label: line.label, amount: line.amount, category: line.category, weeklyPace: weekly },
      segment: raw,
    })),
  ];
  const rest = lines.find((line) => line.rest && line.amount === undefined);
  const headline = rest && ramas > 0
    ? t("Le fac pe rând, cum ai spus; restul de {amount} intră în „{label}”.", { amount: money(ramas), label: rest.label })
    : t("Le fac pe rând, cum ai spus.");
  return {
    kind: "intents",
    score: BASE.intents + 3,
    why: "plicuri spuse pe nume, cu sume",
    intents,
    headline,
  };
}

/** „Am primit salariul”, „mi-a intrat leafa”, „cum împart salariul?” */
const SALARY_TALK = /\b(salari\w*|leafa|lefuri\w*)\b/;
const BANK_CREDIT = /\b(incasare|creditare|creditat|ati primit|ai primit|transfer (primit|intrat)|alimentare cont|plata primita|intrare fonduri)\b/;
const SALARY_ARRIVED = /\b(am (primit|luat|incasat)|mi-?a (intrat|venit)|a (intrat|venit|primit|luat)|au intrat|am si eu)\b/;

/**
 * Salariul, când familia și-a scris „Ce plătim lunar”: propunerea vine din lista ei, nu din
 * istoricul ultimelor 90 de zile. Cu suma în frază („am primit salariul 4700”), venitul și
 * repartizarea se confirmă împreună; fără ea, se repartizează ultimul salariu nerepartizat.
 */
function needsSplitReading(raw: string, data: AppData, asOf: string, said: ParsedIntent[]): Reading | undefined {
  let intents = said;
  if (!activeNeeds(data).length) return undefined;
  const folded = foldRo(raw);
  const spoken = extractAmounts(extractDates(raw).masked).map((hit) => hit.value).filter((value) => value >= 100).sort((a, b) => b - a)[0];
  // Textul băncii lipit în ghid („Încasare 4.700,00 RON de la ACME SRL”): e salariul, dacă seamănă cu unul declarat.
  const fromBank = BANK_CREDIT.test(folded) && spoken ? matchExpectedIncome(data, { amount: spoken, date: asOf }) : undefined;
  const aboutSalary = Boolean(fromBank) || SALARY_TALK.test(folded) || /\bvenit\w*\b/.test(folded);
  const arrived = Boolean(fromBank) || SALARY_ARRIVED.test(folded);
  if (!aboutSalary || !(WANTS_SPLIT.test(folded) || arrived)) return undefined;
  // „Soția a primit salariul 2800”: fraza spune și cine, și suma, chiar dacă cititorul general n-a văzut un venit.
  if (fromBank) {
    intents = [...intents.filter((item) => item.intent.kind !== "expense" && item.intent.kind !== "income"), { intent: { kind: "income", amount: spoken, title: fromBank.label, date: asOf }, segment: raw }];
  } else if (!intents.some((item) => item.intent.kind === "income") && spoken && arrived) {
    intents = [...intents.filter((item) => item.intent.kind !== "expense"), { intent: { kind: "income", amount: spoken, title: "Salariu", date: asOf }, segment: raw }];
  }
  const incomeAt = intents.findIndex((item) => item.intent.kind === "income");
  const dateLabel = (iso: string) => formatDate(iso, { day: "numeric", month: "long" });
  if (incomeAt >= 0) {
    const said = intents[incomeAt];
    if (said.intent.kind !== "income") return undefined;
    const memberId = fromBank?.memberId || memberIdFor(data, raw);
    const source = data.settings.paymentSources.find((item) => item.memberId === memberId && item.kind !== "meal") || data.settings.paymentSources.find((item) => item.kind !== "meal");
    const preview: Transaction = { id: "guide-preview-income", title: said.intent.title, amount: said.intent.amount, kind: "income", category: "Venit", source: source?.name || "", person: "", date: said.intent.date, sourceId: source?.id || "", memberId: memberId || "" };
    const split = proposeIncomeSplit({ ...data, transactions: [...data.transactions, preview] }, preview.id);
    if (!split.ok) return undefined;
    const withMember: ParsedIntent = { ...said, intent: { ...said.intent, memberId } };
    return {
      kind: "intents",
      score: BASE.intents + 5,
      why: "salariu, cu cheltuielile lunare declarate",
      intents: [...intents.slice(0, incomeAt), withMember, ...intents.slice(incomeAt + 1), { intent: { kind: "income-split", preview: splitPreviewText(split, money, dateLabel) }, segment: raw }],
      headline: t("Notez venitul și îl împart după „Ce plătim lunar”."),
    };
  }
  const pending = pendingSplitIncome(data, asOf);
  if (!pending) {
    return { kind: "insight", score: BASE.intents + 1, why: "salariu fără sumă și fără venit nerepartizat", text: t("Nu văd un salariu nerepartizat în ultimele zile. Spune-mi suma — de exemplu „am primit salariul 4700” — și îl împart după „Ce plătim lunar”.") };
  }
  const split = proposeIncomeSplit(data, pending.id);
  if (!split.ok) return { kind: "insight", score: BASE.intents + 1, why: "venitul nu se poate repartiza", text: split.message };
  return {
    kind: "intents",
    score: BASE.intents + 5,
    why: "salariu nerepartizat, cu cheltuielile lunare declarate",
    intents: [{ intent: { kind: "income-split", preview: splitPreviewText(split, money, dateLabel) }, segment: raw }],
    headline: t("Am găsit {title} din {date} ({amount}), încă nerepartizat.", { title: pending.title, date: dateLabel(pending.date), amount: money(pending.amount) }),
  };
}

function splitReading(raw: string, data: AppData, asOf: string, alreadyNamed: boolean, altele: ParsedIntent[] = []): Reading | undefined {
  const folded = foldRo(raw);
  if (!WANTS_SPLIT.test(folded)) return undefined;
  const named = namedSplitReading(raw, folded, data, altele);
  if (named) return named;
  if (alreadyNamed) return undefined;
  const spoken = extractAmounts(extractDates(raw).masked).map((hit) => hit.value).sort((left, right) => right - left)[0];
  const free = Math.max(0, planAllocationMath(data).unrepartized);
  const total = spoken || free;
  if (total <= 0) return undefined;
  const split = proposeSplit(data, total, asOf);
  if (!split.lines.length) return undefined;
  /**
   * Ce a mai spus omul în aceeași frază merge cu propunerea, nu separat: „am 1800, împarte-i
   * în plicuri până pe 9 octombrie” înseamnă și banii, și data, și plicurile. Confirmate pe
   * bucăți, plicurile ar fi stat o clipă peste surse goale, iar ecranul ar fi strigat
   * „peste limita planului” până la următoarea confirmare.
   */
  const intents: ParsedIntent[] = [
    ...altele.filter((item) => item.intent.kind !== "envelope"),
    ...split.lines.map((line) => ({
      intent: { kind: "envelope" as const, label: line.label, amount: line.amount, category: line.category, weeklyPace: true },
      segment: raw,
    })),
  ];
  const reserved = split.reserved > 0 ? t(" Scadențele rezervate ({amount}) rămân deoparte.", { amount: money(split.reserved) }) : "";
  const basis = split.basis === "envelopes" ? t("după cum ai împărțit și până acum") : t("după cheltuielile tale din ultimele 90 de zile");
  return {
    kind: "intents",
    score: BASE.intents,
    why: `cerere de împărțire a ${total} lei`,
    intents,
    headline: t("Îți propun împărțirea celor {amount}, {basis}.{reserved}", { amount: money(split.spendable), basis, reserved }),
  };
}

/**
 * Ce s-ar întâmpla cu planul dacă omul confirmă — spus înainte, nu după.
 *
 * Cazul care a cerut funcția: „am un buget de 1800, pune-l în plic alimente” a creat un
 * plic de 1.800 peste surse goale. Aplicația a tăcut la confirmare, iar omul a găsit pe
 * ecrane „PESTE LIMITA PLANULUI” și „NEREPARTIZAȚI −1.800 RON”, fără să înțeleagă de ce.
 * Cifra există dinainte: o arătăm în propunere, cu ieșirea din impas.
 */
export function planWarningFor(intents: ParsedIntent[], data: AppData): string | undefined {
  const adaugate = intents.reduce((sum, item) => {
    const intent = item.intent;
    if (intent.kind !== "envelope" || intent.delta) return sum;
    const existent = data.settings.salaryPlan.allocations.find((row) => row.label === intent.label || row.category === intent.label);
    return sum + intent.amount - (existent?.amount ?? 0);
  }, 0);
  if (adaugate <= 0) return undefined;
  const declarati = intents.reduce((sum, item) => item.intent.kind === "funds" ? sum + item.intent.amount : sum, 0);
  const libere = Math.max(0, planAllocationMath(data).unrepartized) + declarati;
  const lipsa = Math.round((adaugate - libere) * 100) / 100;
  if (lipsa <= 0.005) return undefined;
  return t("Atenție: plicurile cer {missing} peste banii pe care îi văd ({free}). Spune-mi unde sunt banii — „am {missing} în card” — sau scade plicul.", {
    missing: money(lipsa),
    free: money(libere),
  });
}

/** Sumele pe care o intenție chiar le folosește; restul rămân necitite. */
const intentAmounts = (intent: ParsedIntent["intent"]): number[] => {
  switch (intent.kind) {
    case "expense": case "income": case "recurring": case "funds": case "transfer": case "event-contribution": case "transaction-amend": return [intent.amount];
    case "envelope": return [intent.amount, ...(intent.weeklyLimit ? [intent.weeklyLimit] : [])];
    case "debt": return [intent.remaining, ...(intent.monthly ? [intent.monthly] : [])];
    case "goal": return [intent.target, ...(intent.current ? [intent.current] : [])];
    case "planned-event": return intent.estimate ? [intent.estimate] : [];
    case "payday": case "envelope-delete": case "due-paid": case "open": case "merchant-rule": case "income-split": return [];
    case "transaction-delete": return intent.amount ? [intent.amount] : [];
    case "salary-rule": return intent.mode === "fixed" ? [intent.value] : [];
  }
};

/**
 * A rămas vreo sumă din mesaj pe care nicio intenție nu a folosit-o? Atunci citirea e
 * parțială: omul a spus o cifră, iar noi am înțeles altceva din propoziție.
 */
const leavesMoneyUnread = (raw: string, intents: ParsedIntent[]) => {
  const spoken = extractAmounts(extractDates(raw).masked).map((hit) => hit.value);
  if (!spoken.length) return false;
  const used = intents.flatMap((item) => intentAmounts(item.intent));
  return spoken.some((value) => !used.some((item) => Math.abs(item - value) < 0.005));
};

/**
 * „Împarte în plic alimente cu limita săptămânală” este o comandă, nu o întrebare.
 * Analistul local o revendica oricum și răspundea cu o situație generală, deci omul
 * primea altceva decât ceruse, iar modelul nu mai apuca să vadă mesajul.
 */
const soundsLikeCommand = (raw: string) =>
  !raw.includes("?") && /\b(imparte|imparti|impartiti|impartit|impartita|pune|pune-mi|fa|fa-mi|creeaza|creaza|repartizeaza|repartizeza|aloca|muta|seteaza|schimba)\b/.test(foldRo(raw));

export function understand(text: string, data: AppData, ctx: UnderstandContext = {}): Reading[] {
  // „o sută de lei”, „cincizeci”, „1,5k”, „2 mii” devin cifre înainte de orice altă citire.
  const raw = spokenAmountsToDigits(text.trim());
  const memory = ctx.memory || emptyGuideMemory();
  const readings: Reading[] = [];
  if (!raw) return readings;

  if (isConfirm(raw)) readings.push({ kind: "confirm", score: BASE.confirm, why: "mesajul este doar o confirmare" });

  const revise = reviseProposal(raw, data);
  if (revise) readings.push({ kind: "revise", score: BASE.revise, why: "cere ștergerea sau corectarea unei mișcări", proposal: revise });

  const intents = parseAssistantMessage(raw, {
    asOf: ctx.asOf || isoToday(),
    categories: ctx.categories || [...expenseCategories, ...data.settings.customCategories],
    merchantRules: data.settings.merchantRules || [],
  });
  // O frază pe care n-o știam, dar pe care am învățat-o de la tine: aceeași intenție, cu suma nouă.
  const recalled = intents.length ? undefined : recallPhrasing(memory.learned, raw, ctx.asOf || isoToday());
  if (recalled) readings.push({ kind: "intents", score: BASE.intents, why: "am învățat fraza asta de la tine", intents: [{ intent: recalled, segment: raw }] });
  if (intents.length) {
    readings.push({
      kind: "intents",
      score: BASE.intents,
      why: `${intents.length === 1 ? "o intenție scrisă limpede" : `${intents.length} intenții scrise limpede`}: ${intents.map((item) => item.intent.kind).join(", ")}`,
      intents,
      ...(leavesMoneyUnread(raw, intents) ? { soft: true as const } : {}),
    });
  }

  /**
   * Un răspuns local e o presupunere când mesajul cere o împărțire, sau când conține o
   * sumă pe care nimeni nu a folosit-o: acolo modelul are ce adăuga.
   */
  const guessy = soundsLikeCommand(raw) || (plansMoney(raw) && leavesMoneyUnread(raw, intents));
  const salary = needsSplitReading(raw, data, ctx.asOf || isoToday(), intents);
  const split = salary ? undefined : splitReading(raw, data, ctx.asOf || isoToday(), intents.some((item) => item.intent.kind === "envelope"), intents);
  if (salary) {
    // Propunerea cuprinde și venitul spus în frază, deci înlocuiește citirea simplă.
    const plain = readings.findIndex((item) => item.kind === "intents");
    if (plain >= 0 && salary.kind === "intents") readings.splice(plain, 1);
    readings.push(salary);
  } else if (split) {
    /**
     * Propunerea de împărțire cuprinde și celelalte intenții, deci ea trebuie să câștige —
     * iar citirea simplă, din care s-a născut, iese din cursă. Lăsate amândouă, scorurile
     * cădeau la două puncte una de alta, mesajul părea ambiguu și asistentul întreba în loc
     * să propună, deși înțelesese perfect ce i s-a cerut.
     */
    const plain = readings.findIndex((item) => item.kind === "intents");
    if (plain >= 0) readings.splice(plain, 1);
    readings.push({ ...split, score: Math.max(split.score, BASE.intents + 2) });
  } else if (WANTS_SPLIT.test(foldRo(raw)) && intents.length && !intents.some((item) => item.intent.kind === "envelope")) {
    /**
     * Omul a cerut o împărțire, iar noi știm doar banii și data: în ce plicuri să meargă
     * nu avem de unde ghici. Citirea rămâne validă, dar marcată ca parțială, ca modelul
     * să poată întreba în loc să tăcem pe jumătate de frază.
     */
    const partial = readings.find((item) => item.kind === "intents");
    if (partial) partial.soft = true;
  }

  const goTo = openReading(raw);
  if (goTo) readings.push(goTo);

  const answer = analyze(raw, data, ctx.asOf);
  if (answer) readings.push({ kind: "question", score: BASE.question, why: "are formă de întrebare despre bani", answer, ...(guessy ? { soft: true as const } : {}) });

  const spend = expenseProposal(raw, ctx.extracted, data, memory, ctx.forcedExpense);
  if (spend) readings.push({ kind: "expense", score: BASE.expense, why: "sumă plus un cuvânt de cheltuială", proposal: spend });

  const due = paidRecurringProposal(raw, data);
  if (due) readings.push({ kind: "due", score: BASE.due, why: "spune că a plătit o scadență cunoscută", proposal: due });

  const moved = transferProposal(raw, data);
  // O mutare cu ambele plicuri găsite e mai precisă decât „pune 100 la X” citit ca plic nou.
  if (moved) readings.push({ kind: "transfer", score: moved.choices.length ? BASE.intents + 3 : BASE.transfer, why: "„mută … din … în …”", proposal: moved });

  const income = incomeProposal(raw, data);
  if (income) readings.push({ kind: "income", score: BASE.income, why: "sumă plus un cuvânt de venit", proposal: income });

  // Obiceiurile vin ultimele: intră doar când nimic mai precis n-a înțeles mesajul.
  if (!readings.some((item) => ["intents", "expense", "due", "transfer", "income", "revise"].includes(item.kind))) {
    const habit = habitProposal(raw, data, memory, ctx.asOf || isoToday());
    if (habit && (habit.repeat || !answer)) {
      readings.push({ kind: "expense", score: habit.repeat ? BASE.expense + 15 : BASE.expense - 5, why: habit.repeat ? "„la fel ca…”, din registru" : "suma de obicei, din registru", proposal: habit.proposal });
    }
  }

  const insight = localInsight(raw, data, memory);
  if (insight) readings.push({ kind: "insight", score: BASE.insight, why: "întreabă ce mai are disponibil", text: insight, ...(guessy ? { soft: true as const } : {}) });

  return readings.sort((left, right) => right.score - left.score);
}

/**
 * Cine câștigă — sau, cinstit, că nu se poate ști. Când a doua citire e la mai
 * puțin de `margin` de prima, mesajul e ambiguu: mai bine o întrebare scurtă
 * decât o scriere tăcută în registrul omului.
 */
export function decide(readings: Reading[], margin = 10): { winner?: Reading; runnerUp?: Reading; ambiguous: boolean } {
  const [winner, runnerUp] = readings;
  if (!winner) return { ambiguous: false };
  return { winner, runnerUp, ambiguous: Boolean(runnerUp && winner.score - runnerUp.score < margin) };
}

const isAnswerReading = (item: Reading) => item.kind === "question" || item.kind === "insight";

/**
 * Când `decide` e nesigur, întrebăm — dar nu pentru două citiri care spun același
 * lucru omului (întrebare vs. situație) și nu pentru o confirmare.
 */
export function shouldAskWhichReading(winner: Reading, runnerUp: Reading): boolean {
  if (winner.kind === "confirm") return false;
  if (isAnswerReading(winner) && isAnswerReading(runnerUp)) return false;
  return true;
}

export function readingLabel(reading: Reading): string {
  switch (reading.kind) {
    case "expense": return t("Cheltuială");
    case "income": return t("Venit");
    case "transfer": return t("Mutare între plicuri");
    case "due": return t("Plată scadență");
    case "revise": return t("Corectare");
    case "question": return t("Răspuns din registru");
    case "insight": return t("Situația din registru");
    case "intents": return t("Ce am citit din mesaj");
    case "confirm": return t("Confirmare");
  }
}

/**
 * Perioada, așa cum o vede planul: câte zile mai sunt până la venit, câți bani sunt liberi
 * și ce ritm încap ei pe zilele rămase.
 *
 * Fără cifrele astea, modelul răspundea la „vreau 600 pe săptămână” socotind săptămâni
 * întregi de calendar, deci și zilele care trecuseră deja. `paceWeekly` e ritmul pe care îl
 * susțin banii liberi de azi până la venit, iar `startedWeekShare` e partea care revine
 * zilelor rămase din tranșa curentă — aceleași cifre pe care le arată ecranul Plan.
 */
function planPeriodContext(data: AppData) {
  const round = (value: number) => Math.round(value * 100) / 100;
  const plan = data.settings.salaryPlan;
  const end = planEndDate(plan);
  const today = isoToday();
  if (!end || !plan.periodStart) return null;
  const free = Math.max(0, planAllocationMath(data).unrepartized);
  const pace = remainingPace(free, end, today > plan.periodStart ? today : plan.periodStart);
  const cycle = free > 0 ? calendarBudget(free, plan.periodStart, end) : undefined;
  const current = cycle?.weeks.find((week) => today >= week.start && today <= week.end);
  const share = current && pace ? startedWeekShare(current, today, pace) : undefined;
  return {
    start: plan.periodStart,
    end,
    today,
    started: today > plan.periodStart,
    daysTotal: periodDays(plan.periodStart, end),
    daysLeft: periodDays(today > plan.periodStart ? today : plan.periodStart, end),
    free: round(free),
    /** Ritmul pe săptămână întreagă pe care îl susțin banii liberi, socotit pe zilele rămase. */
    paceWeekly: pace ? round(pace.weekly) : null,
    pacePerDay: pace ? round(pace.perDay) : null,
    /** Tranșa începută: câte zile mai are și cât îi revine din ritmul de mai sus. */
    startedWeek: share && share.daysLeft < share.daysTotal
      ? { index: current?.index ?? 1, daysLeft: share.daysLeft, share: round(share.fair) }
      : null,
  };
}

/**
 * Evenimentele din calendar, așa cum le vede planul: ce urmează, cât costă, cât e
 * strâns și cât mai trebuie pus deoparte.
 *
 * Fără ele, întrebarea „îmi permit 500 acum?” primea un răspuns corect pe ciclul de
 * salariu și greșit pe an: Crăciunul de peste trei săptămâni nu apărea nicăieri.
 * `perMonth` e ritmul care ține evenimentul la zi, socotit pe zilele rămase.
 */
function plannedEventsContext(data: AppData) {
  const round = (value: number) => Math.round(value * 100) / 100;
  const today = isoToday();
  const events = data.settings.plannedEvents;
  if (!events.length) return null;
  const pressure = plannedEventsPressure(events, today);
  return {
    /** Cât cere fondul de evenimente pe lună, pentru tot ce urmează în anul următor. */
    perMonth: round(pressure.perMonth),
    estimate: round(pressure.estimate),
    saved: round(pressure.saved),
    remaining: round(pressure.remaining),
    next: upcomingPlannedEvents(events, today, 180).slice(0, 6).map((status) => ({
      name: status.event.name,
      date: status.date,
      daysLeft: status.daysLeft,
      estimate: round(status.estimate),
      saved: round(status.saved),
      remaining: round(status.remaining),
      perMonth: round(status.perMonth),
      /** Ediția a trecut și nu a fost închisă — banii strânși sunt ai ei, nu ai celei viitoare. */
      passed: status.passed,
    })),
  };
}

/**
 * Ce poate vedea modelul online: perioada, plicuri, scadențe, datorii, evenimentele
 * viitoare, totalul lunii. Nu jurnalul. Lidl-ul de ieri rămâne pe telefon.
 */
export function compactGuideContext(data: AppData, extras: { view?: string; income?: number; expense?: number } = {}) {
  const round = (value: number) => Math.round(value * 100) / 100;
  const todayCard = buildTodaySummary(data);
  return {
    today: isoToday(),
    /** Aceeași cifră mare ca pe Astăzi. „Cât pot cheltui azi” pleacă de aici, nu din solduri împărțite la zile. */
    todayCanUse: round(todayCard.canSpendToday),
    overPlanBy: todayCard.overPlan ? round(todayCard.heroValue) : undefined,
    view: extras.view,
    period: planPeriodContext(data),
    month: { income: round(extras.income || 0), expense: round(extras.expense || 0) },
    members: data.settings.members.map((item) => item.name).slice(0, 6),
    payday: data.settings.salaryPlan.nextPayday || data.settings.salaryPlan.earliestPayday || null,
    /**
     * Numele exacte ale lucrurilor din aplicație. Fără ele, modelul putea doar să
     * inventeze: cerea „mută din Mâncare în Benzină” peste plicuri care se cheamă
     * altfel, iar aplicația arunca intenția fiindcă nu avea ce să atingă. Un nume
     * scris aici este un nume pe care îl poate folosi.
     */
    sources: data.settings.paymentSources.slice(0, 8).map((item) => ({ name: item.name, kind: item.kind, balance: round(sourceBalance(data, item.id)) })),
    categories: [...expenseCategories, ...data.settings.customCategories].slice(0, 26),
    envelopes: data.settings.salaryPlan.allocations.slice(0, 12).map((item) => {
      const status = envelopeDecisionStatus(data, item);
      return { label: item.label, amount: round(item.amount), remaining: round(status.remaining), state: status.state, weekly: isWeeklyPaced(item, data.settings.salaryPlan) };
    }),
    dues: pendingRecurringInPlan(data).slice(0, 6).map((item) => ({ name: item.name, amount: round(item.amount), due: item.dueDate })),
    recurring: data.recurring.filter((item) => item.active !== false).slice(0, 8).map((item) => ({ name: item.name, amount: round(item.amount), dueDay: item.dueDay })),
    goals: data.savings.slice(0, 6).map((item) => ({ name: item.name, target: round(item.target), saved: round(item.current) })),
    debts: data.debts.filter((item) => item.remaining > 0).slice(0, 6).map((item) => ({ name: item.name, remaining: round(item.remaining), monthly: round(item.monthly || 0) })),
    events: plannedEventsContext(data),
    /** „Ce plătim lunar”: cheltuielile știute (interval și cât se rezervă) și veniturile cu ziua lor. */
    monthlyNeeds: activeNeeds(data).slice(0, 20).map((item) => ({ label: item.label, per: item.cadence === "weekly" ? "week" : "month", min: round(item.min), max: round(item.max), reserved: round(reserveOf(item)), payer: data.settings.members.find((member) => member.id === item.payerId)?.name || null, first: item.priority !== "flex" })),
    expectedIncomes: activeIncomes(data).slice(0, 6).map((item) => ({ who: data.settings.members.find((member) => member.id === item.memberId)?.name || null, label: item.label, amount: round(item.amount), day: item.day })),
  };
}

/**
 * Ce a învățat din alegerile tale.
 *
 * O corectură valorează mai mult decât un acord. Când asistentul propune plicul
 * „Alimente” și tu apeși „Din Casă & facturi”, ai spus ceva ce el nu știa; când
 * apeși doar „Confirmă”, ai spus doar că nu s-a înșelat. De aceea corectura intră
 * cu greutate dublă: ajunge la pragul de „de obicei scoți din…” din două atingeri,
 * nu din patru.
 */
export function rememberExpense(
  memory: GuideMemory,
  update: Extract<FinancialUpdate, { kind: "expense" }>,
  weight: 1 | 2 = 1,
): GuideMemory {
  const key = habitKey(update.title);
  if (key.length < 2 || key === "altele" || key === "cheltuiala") return memory;
  const before = memory.phrases.find((item) => item.key === key);
  const phrases = memory.phrases.filter((item) => item.key !== key);
  phrases.push({
    key,
    title: update.title,
    category: update.category,
    allocationId: update.allocationId,
    sourceId: update.sourceId,
    count: (before?.count || 0) + weight,
    lastAt: new Date().toISOString(),
  });
  return { ...memory, phrases: phrases.slice(-80) };
}

/**
 * A fost o corectură? Adică: exista o propunere, iar omul a ales altceva decât ea.
 * Fără propunere nu e corectură, ci prima alegere.
 */
export const isCorrection = (
  proposed: FinancialUpdate | undefined,
  chosen: FinancialUpdate,
): boolean => {
  if (!proposed || proposed.kind !== "expense" || chosen.kind !== "expense") return false;
  return (proposed.allocationId || "") !== (chosen.allocationId || "")
    || (proposed.sourceId || "") !== (chosen.sourceId || "");
};
