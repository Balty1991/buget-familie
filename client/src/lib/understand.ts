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
import {
  allocationStatus,
  allocationWeekStatus,
  allocationWeeksStatus,
  envelopeDecisionStatus,
  expenseCategories,
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
} from "./finance-data";
import { calendarBudget, periodDays, remainingPace, startedWeekShare } from "./calendar-budget";
import { buildTodaySummary } from "./today-summary";
import { plannedEventsPressure, upcomingPlannedEvents } from "./planned-events";
import { proposeSplit } from "./split-proposal";
import { t } from "./i18n";
import { dateCopy, noDoubleStop, shiftDay, today } from "./proposal-date";
import { relatedCategories } from "./suggest-source";
import { spendGroupOf } from "./product-catalog";
import { explicitSplitLines, extractAmounts, extractDates, parseAssistantMessage, repeatFactor, type AppScreen, type ParsedIntent } from "./assistant-intents";
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
  | { kind: "delete-transaction"; id: string; title: string; amount: number }
  | { kind: "amend-transaction"; id: string; amount: number; title: string; was: number };

export type ChatChoice = { label: string; update: FinancialUpdate };
export type PhraseHabit = { key: string; title: string; category: string; allocationId?: string; sourceId?: string; count: number; lastAt: string };
export type GuideMemory = { phrases: PhraseHabit[]; skippedOnline: number };
export const emptyGuideMemory = (): GuideMemory => ({ phrases: [], skippedOnline: 0 });

/** Cheltuiala/venitul din ghid cer plic (sau sursă) și o zi atinsă explicit — nu salvăm pe data ghicită. */
export function isDatedSpendChoice(choice: ChatChoice): boolean {
  return choice.update.kind === "expense" || choice.update.kind === "income";
}

export function canCommitGuideSpend(sourcePicked: boolean, dateTapped: boolean): boolean {
  return sourcePicked && dateTapped;
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
    || /^(cat|cate|cati|unde|cand|care|cum|ce |ce-|cine |sfat|recomand|e normal|prea mult|imi permit|mi permit|pot sa|as putea|ajung |mai am |merita |arata|listeaza|vreau sa vad|spune mi)/.test(folded);
}

export function isConfirm(raw: string) {
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  return /^(da+|ok|okay|confirm|confirma|confirmat|sigur|adauga|adaug[- ]o|inregistreaza|salveaza)([.! ]*)?$/.test(folded);
}

export function claimsSaved(raw: string) {
  return /am (adăugat|adaugat|înregistrat|inregistrat|trecut|notat|salvat)/i.test(raw);
}

export function sourceTextSafe(raw: string) { return raw.replace(/data:[^ ]+/g, "").slice(0, 800); }

export function memberIdFor(data: AppData, hint: string, index = 0) {
  const folded = hint.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const members = data.settings.members;
  if (/sotie|sotiei|partenera|ea\b/.test(folded)) return members[1]?.id || members[0]?.id;
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

export function receiptDetails(extracted?: ExtractedGuide) {
  if (!extracted?.amount && !extracted?.vendor && !extracted?.category) return "";
  const vendor = extracted.vendor ? ` **${extracted.vendor}**.` : "";
  const total = extracted.amount ? ` Total bon: **${money(extracted.amount)}**.` : "";
  const group = extracted.category ? spendGroupOf(extracted.category) : "";
  const category = extracted.category
    ? ` ${t("Categorie")}: **${extracted.category}** (${group === "Alimente" ? t("alimente") : t("nealimentare")}).`
    : "";
  const confidence = extracted.confidence === "low" ? t(" Verifică atent suma; fotografia nu este suficient de clară.") : "";
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

/** Locurile din care se poate scoate suma: plicuri (cu săptămâna) și, doar dacă a rămas liber, nealocat. */
export function buildExpenseOffer(
  data: AppData,
  spend: { amount: number; title: string; category: string; date: string },
  memory: GuideMemory = emptyGuideMemory(),
): { text: string; choices: ChatChoice[] } {
  const { amount, title, category, date } = spend;
  const when = dateCopy(date);
  const member = selfMemberOf(data);
  const fallbackSource = data.settings.paymentSources.find((item) => item.memberId === member?.id) || data.settings.paymentSources[0];
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
      sourceId: envelope.sourceId || fallbackSource?.id,
      memberId: envelope.memberId || member?.id,
      fromWeekIndex: weekIndex,
    },
  }));
  data.settings.paymentSources.forEach((source) => {
    const unrepartized = planAllocationMath(data).unrepartized;
    if (unrepartized < amount) return;
    const left = Math.round(Math.min(unrepartized, sourceBalance(data, source.id)) * 100) / 100;
    if (left < amount) return;
    choices.push({
      label: `Din nealocat · ${source.name} · ${money(left)}`,
      update: { kind: "expense", amount, title, category, date, allocationId: "outside", sourceId: source.id, memberId: source.memberId || member?.id },
    });
  });
  if (!choices.length) {
    return { text: noDoubleStop(`Am înțeles **${title}**, ${money(amount)}, ${when}. Nu am găsit un plic sau o sursă cu destui bani disponibili.`), choices: [] };
  }
  const preferred = (habit?.allocationId && funded.find((item) => item.envelope.id === habit.allocationId))
    || funded.find((item) => item.envelope.category === category)
    || funded.find((item) => related.includes(item.envelope.category || ""));
  const usual = habit && habit.count >= 2;
  const weekHint = funded.some((item) => item.weekIndex) ? " Alege din ce săptămână scoatem banii." : " Alege de unde scoatem banii.";
  const text = preferred
    ? `Am înțeles **${title}**, ${money(amount)}, **${when}**. ${usual ? `De obicei scoți din **${preferred.envelope.label}**.` : `Cea mai apropiată opțiune cu bani e **${preferred.envelope.label}**.`}${weekHint}`
    : `Am înțeles **${title}**, ${money(amount)}, **${when}**. Nu am un plic exact pentru ${category}. Banii sunt în plicuri — alege din ce săptămână scoatem suma.`;
  return { text: noDoubleStop(text), choices };
}

export function expenseProposal(raw: string, extracted: ExtractedGuide | undefined, data: AppData, memory: GuideMemory, forced = false): { text: string; choices: ChatChoice[] } | undefined {
  if (isDebtOrInstallmentMessage(raw)) return undefined;
  if (!forced && isQuestion(raw)) return undefined;
  const parsed = parseNaturalSpendScenario(raw, [...expenseCategories, ...data.settings.customCategories]);
  const amount = spendAmount(raw, extracted, parsed.amount) * (extracted?.amount ? 1 : repeatFactor(raw));
  if (!amount || amount <= 0) return undefined;
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const draftTitle = spendTitle(folded, extracted, parsed.category || "Altele");
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
    || /cheltui|adaug|inregist|platit|cumpar|cumpăr|taxi|uber|bolt|apa\b|dulce|dulciuri|tigar|tutun|factura|benzina|combustibil|mancare|uitat|\bpe |\bpentru /.test(folded)
    || Boolean(parsed.category && !/venit|salariu|intrare/.test(folded));
  if (!looksSpend || /venit|salariu|intrare/.test(folded)) return undefined;
  const category = (parsed.category && parsed.category !== "Altele") ? parsed.category : (habit?.category || extracted?.category || "Altele");
  const title = draftTitle === "Altele" && habit ? habit.title : draftTitle;
  const date = extracted?.date && /^20\d{2}-\d{2}-\d{2}$/.test(extracted.date) ? extracted.date : spendDate(raw);
  const offer = buildExpenseOffer(data, { amount, title, category, date }, memory);
  const extra = receiptDetails(extracted);
  if (!extra) return offer;
  return { ...offer, text: noDoubleStop(offer.text.replace(/\.\s/, `.${extra} `)) };
}

export function incomeProposal(raw: string, data: AppData): { text: string; choices: ChatChoice[] } | undefined {
  const folded = foldRo(raw);
  if (!/venit|salariu|intrare|am primit|mi-a venit/.test(folded)) return undefined;
  if (/cheltui|tigar|tutun|taxi|suc|bere|paine|gume|factura/.test(folded) && !/salariu|venit/.test(folded)) return undefined;
  const amount = spendAmount(raw, undefined, 0);
  if (!amount || amount < 50) return undefined;
  const title = /sotie|sotiei|partener/.test(folded) ? t("Salariul soției") : /salariu/.test(folded) ? "Salariu" : "Venit";
  const date = spendDate(raw);
  return {
    text: noDoubleStop(`Am înțeles **${title}**, ${money(amount)}, **${dateCopy(date)}**. Îl trec în registru pe ziua aleasă?`),
    choices: [{ label: `Adaugă venitul · ${money(amount)}`, update: { kind: "income", amount, title, date, memberId: memberIdFor(data, raw, /sotie|sotiei|partener/.test(folded) ? 1 : 0) } }],
  };
}

export function transferProposal(raw: string, data: AppData): { text: string; choices: ChatChoice[] } | undefined {
  const folded = foldRo(raw);
  if (!/\b(mut[ae]|transfer|treci|realoc)/.test(folded)) return undefined;
  const amount = spendAmount(raw, undefined, 0);
  if (!amount) return undefined;
  const pair = folded.match(/\b(?:din|de pe)\s+([a-z0-9 &ăâîșț]+?)\s+(?:in|în|spre|catre|către)\s+([a-z0-9 &ăâîșț]+)/);
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
    || folded.match(/\bschimba (?:suma|valoarea)\s+(?:in|la)\s+(\d+(?:[.,]\d{1,2})?)/);
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
 * „Am plătit chiria.” Fără sumă — fiindcă suma o știe deja aplicația, din
 * scadențele pe care le-ai trecut în Plan. Până acum o astfel de frază nu era
 * înțeleasă de nimeni: cheltuiala are nevoie de o sumă, iar aici nu era niciuna.
 *
 * Propunem plata scadenței cu suma ei, dar numai dacă n-a fost deja trecută în
 * perioada curentă — altfel am invita omul să plătească de două ori.
 */
export function paidRecurringProposal(raw: string, data: AppData): Proposal | undefined {
  const folded = foldRo(raw);
  if (!/\b(am platit|am achitat|platit|achitat)\b/.test(folded)) return undefined;
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
  const from = matched ? `din plicul «${matched.label}»` : source ? `din ${source.name}` : "";
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

export type Proposal = { text: string; choices: ChatChoice[] };

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
    case "payday": case "envelope-delete": case "due-paid": case "open": case "merchant-rule": return [];
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
  const raw = text.trim();
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
  const split = splitReading(raw, data, ctx.asOf || isoToday(), intents.some((item) => item.intent.kind === "envelope"), intents);
  if (split) {
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
  if (moved) readings.push({ kind: "transfer", score: BASE.transfer, why: "«mută … din … în …»", proposal: moved });

  const income = incomeProposal(raw, data);
  if (income) readings.push({ kind: "income", score: BASE.income, why: "sumă plus un cuvânt de venit", proposal: income });

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
    todayCanUse: round(todayCard.heroValue),
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
  return { phrases: phrases.slice(-80), skippedOnline: memory.skippedOnline };
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
