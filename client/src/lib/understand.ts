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
  expenseCategories,
  inPlanPeriod,
  isoToday,
  parseNaturalSpendScenario,
  sourceBalance,
  type AppData,
} from "./finance-data";
import { t } from "./i18n";
import { dateCopy, noDoubleStop, shiftDay, today } from "./proposal-date";
import { relatedCategories } from "./suggest-source";
import { parseAssistantMessage, type ParsedIntent } from "./assistant-intents";
import { analyze, type AnalystAnswer } from "./analyst";

export type FinancialUpdate =
  | { kind: "income"; amount: number; title: string; date?: string; memberId?: string }
  | { kind: "expense"; amount: number; title: string; category: string; date?: string; allocationId?: string; sourceId?: string; memberId?: string }
  | { kind: "debt"; name: string; remaining: number; due?: string }
  | { kind: "debt-monthly"; amount: number; name?: string }
  | { kind: "allocation"; category: string; amount: number; weekly: boolean; weeklyAmount?: number; weeks?: number; payday?: string; label?: string }
  | { kind: "recurring"; name: string; amount: number; dueDay: number; category: string }
  | { kind: "goal"; name: string; target: number; current?: number; dueDate?: string }
  | { kind: "payday"; date: string; flexDays: number }
  | { kind: "transfer"; amount: number; fromId: string; toId: string; fromLabel: string; toLabel: string }
  | { kind: "delete-transaction"; id: string; title: string; amount: number }
  | { kind: "amend-transaction"; id: string; amount: number; title: string; was: number };

export type ChatChoice = { label: string; update: FinancialUpdate };
export type PhraseHabit = { key: string; title: string; category: string; allocationId?: string; sourceId?: string; count: number; lastAt: string };
export type GuideMemory = { phrases: PhraseHabit[]; skippedOnline: number };
export const emptyGuideMemory = (): GuideMemory => ({ phrases: [], skippedOnline: 0 });

const money = (value: number) => `${Number(value.toFixed(2)).toLocaleString("ro-RO", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })} RON`;

export function foldRo(raw: string) {
  return raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

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
export function isQuestion(raw: string) {
  const folded = foldRo(raw).replace(/\s+/g, " ").trim();
  return /\?\s*$/.test(raw.trim())
    || /^(cat|cate|cati|unde|cand|care|cum|ce |imi permit|mi permit|pot sa|as putea|ajung |mai am |merita |arata|listeaza|vreau sa vad|spune mi)/.test(folded);
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
  return members[index]?.id || members[0]?.id;
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
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\balaltaieri\b/.test(folded)) return shiftDay(-2);
  if (/\bieri\b/.test(folded)) return shiftDay(-1);
  if (/\bmaine\b/.test(folded)) return shiftDay(1);
  if (/\b(azi|astazi)\b/.test(folded)) return shiftDay(0);
  const dmy = raw.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](20\d{2}))?\b/);
  if (dmy && Number(dmy[2]) <= 12 && Number(dmy[1]) <= 31) {
    const year = dmy[3] || String(new Date().getFullYear());
    return `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return shiftDay(0);
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
  if (!extracted?.receiptLines?.length && !extracted?.confidence) return "";
  const lines = (extracted.receiptLines || []).slice(0, 8).filter((line) => line.name);
  const products = lines.length ? ` Produse citite: ${lines.map((line) => `${line.quantity && line.quantity !== 1 ? `${line.quantity}× ` : ""}${line.name}${line.amount ? ` ${money(line.amount)}` : ""}`).join(", ")}.` : " Produsele nu au fost suficient de lizibile.";
  const lineTotal = lines.reduce((sum, line) => sum + (line.amount || 0), 0);
  const difference = extracted.amount && lineTotal > 0 ? Math.round((extracted.amount - lineTotal) * 100) / 100 : 0;
  const reconciliation = extracted.amount
    ? lineTotal > 0
      ? Math.abs(difference) <= 0.01
        ? ` Total bon: **${money(extracted.amount)}**. Liniile se potrivesc cu totalul.`
        : ` Total bon: **${money(extracted.amount)}**. Liniile însumează **${money(lineTotal)}**; diferență de **${money(Math.abs(difference))}**${difference > 0 ? " (posibilă reducere sau linie necitită)" : " (verifică o posibilă citire dublă)"}.`
      : ` Total bon identificat: **${money(extracted.amount)}**.`
    : "";
  const confidence = extracted.confidence === "low" ? t(" Verifică atent suma; fotografia nu este suficient de clară.") : "";
  return `${reconciliation}${products}${confidence}`;
}

function matchEnvelope(data: AppData, token: string) {
  const key = habitKey(token);
  if (key.length < 3) return undefined;
  return data.settings.salaryPlan.allocations.find((item) => {
    const hay = habitKey(`${item.label} ${item.category || ""}`);
    return hay.includes(key) || key.includes(hay);
  });
}

export function expenseProposal(raw: string, extracted: ExtractedGuide | undefined, data: AppData, memory: GuideMemory, forced = false): { text: string; choices: ChatChoice[] } | undefined {
  if (isDebtOrInstallmentMessage(raw)) return undefined;
  if (!forced && isQuestion(raw)) return undefined;
  const parsed = parseNaturalSpendScenario(raw, [...expenseCategories, ...data.settings.customCategories]);
  const amount = spendAmount(raw, extracted, parsed.amount);
  if (!amount || amount <= 0) return undefined;
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const draftTitle = spendTitle(folded, extracted, parsed.category || "Altele");
  const habit = findHabit(memory, raw, draftTitle);
  const looksSpend = forced
    || Boolean(habit)
    || /cheltui|adaug|inregist|platit|cumpar|cumpăr|taxi|uber|bolt|apa\b|dulce|dulciuri|tigar|tutun|factura|benzina|combustibil|mancare|uitat|\bpe |\bpentru /.test(folded)
    || Boolean(parsed.category && !/venit|salariu|intrare/.test(folded));
  if (!looksSpend || /venit|salariu|intrare/.test(folded)) return undefined;
  const category = (parsed.category && parsed.category !== "Altele") ? parsed.category : (habit?.category || extracted?.category || "Altele");
  const title = draftTitle === "Altele" && habit ? habit.title : draftTitle;
  const date = extracted?.date && /^20\d{2}-\d{2}-\d{2}$/.test(extracted.date) ? extracted.date : spendDate(raw);
  const when = dateCopy(date);
  const member = data.settings.members[0];
  const fallbackSource = data.settings.paymentSources.find((item) => item.memberId === member?.id) || data.settings.paymentSources[0];
  const related = relatedCategories(category);
  const funded = [...data.settings.salaryPlan.allocations]
    .map((envelope) => {
      const week = envelope.weeklyPace !== false ? allocationWeekStatus(data, envelope) : undefined;
      const left = week ? week.remaining : allocationStatus(data, envelope).remaining;
      return { envelope, week, left };
    })
    .filter((item) => item.left >= amount)
    .sort((left, right) => {
      const score = (item: typeof left) => {
        if (habit?.allocationId && item.envelope.id === habit.allocationId) return 6;
        if (habit?.category && item.envelope.category === habit.category) return 5;
        if (item.envelope.category === category) return 4;
        if (related.includes(item.envelope.category || "")) return 3;
        if ((item.envelope.category || item.envelope.label) === "Alimente") return 2;
        return 1;
      };
      return score(right) - score(left) || right.left - left.left;
    });
  const choices: ChatChoice[] = funded.map(({ envelope, week, left }) => ({
    label: `Din ${envelope.label}${week ? ` · S${week.index}` : ""} · ${money(left)}`,
    update: { kind: "expense" as const, amount, title, category, date, allocationId: envelope.id, sourceId: envelope.sourceId || fallbackSource?.id, memberId: envelope.memberId || member?.id },
  }));
  data.settings.paymentSources.forEach((source) => {
    const left = sourceBalance(data, source.id);
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
  const text = preferred
    ? `Am înțeles **${title}**, ${money(amount)}, **${when}**.${receiptDetails(extracted)} ${usual ? `De obicei scoți din **${preferred.envelope.label}**.` : `Cea mai apropiată opțiune cu bani e **${preferred.envelope.label}**.`} Alege de unde scoatem banii.`
    : `Am înțeles **${title}**, ${money(amount)}, **${when}**.${receiptDetails(extracted)} Nu am un plic exact pentru ${category}. Alege din locurile unde sunt bani disponibili.`;
  return { text: noDoubleStop(text), choices };
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

export function localInsight(raw: string, data: AppData, memory: GuideMemory): string | undefined {
  const folded = foldRo(raw);
  if (!/cat (mai )?am|ramas|sold|situat|bilant|plicur|nealo|obicei|ce mai am|cat am pe/.test(folded)) return undefined;
  if (/adaug|cheltui|repartiz/.test(folded)) return undefined;
  // „cum funcționează plicurile?” cere o explicație, nu soldurile.
  if (/cum (functioneaza|merge|folosesc)|ce inseamna|la ce (foloseste|serveste)/.test(folded)) return undefined;
  const envelopes = data.settings.salaryPlan.allocations.map((envelope) => {
    const week = envelope.weeklyPace !== false ? allocationWeekStatus(data, envelope) : undefined;
    const left = week ? week.remaining : allocationStatus(data, envelope).remaining;
    return `• ${envelope.label}${week ? ` · S${week.index}` : ""}: ${money(left)}`;
  });
  const sources = data.settings.paymentSources.map((source) => `• Nealocat · ${source.name}: ${money(sourceBalance(data, source.id))}`);
  const known = memory.phrases.filter((item) => item.count >= 2).slice(-6).map((item) => item.title);
  const learned = known.length ? `\nȚin minte de la tine: ${known.join(", ")}.` : "";
  return `Uite ce e disponibil, din registrul de pe telefon:${envelopes.length ? `\n${envelopes.join("\n")}` : ""}\n${sources.join("\n")}${learned}`;
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
  return {
    text: `Am înțeles: **${due.name}**, ${money(due.amount)}${source ? `, din ${source.name}` : ""}. O trec în registru?`,
    choices: [{
      label: `Plătește ${due.name} · ${money(due.amount)}`,
      update: { kind: "expense", amount: due.amount, title: due.name, category: due.category, date: today(), sourceId: source?.id, allocationId: "outside", memberId: due.memberId },
    }],
  };
}

/* ---------------------------------------------------------------------------
   Citirea mesajului
   --------------------------------------------------------------------------- */

export type Proposal = { text: string; choices: ChatChoice[] };

/** O citire posibilă a mesajului, cu cât de tare o susține textul și de ce. */
export type Reading =
  | { kind: "confirm"; score: number; why: string }
  | { kind: "revise"; score: number; why: string; proposal: Proposal }
  | { kind: "intents"; score: number; why: string; intents: ParsedIntent[] }
  | { kind: "question"; score: number; why: string; answer: AnalystAnswer }
  | { kind: "expense"; score: number; why: string; proposal: Proposal }
  | { kind: "transfer"; score: number; why: string; proposal: Proposal }
  | { kind: "due"; score: number; why: string; proposal: Proposal }
  | { kind: "income"; score: number; why: string; proposal: Proposal }
  | { kind: "insight"; score: number; why: string; text: string };

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
  });
  if (intents.length) {
    readings.push({
      kind: "intents",
      score: BASE.intents,
      why: `${intents.length === 1 ? "o intenție scrisă limpede" : `${intents.length} intenții scrise limpede`}: ${intents.map((item) => item.intent.kind).join(", ")}`,
      intents,
    });
  }

  const answer = analyze(raw, data);
  if (answer) readings.push({ kind: "question", score: BASE.question, why: "are formă de întrebare despre bani", answer });

  const spend = expenseProposal(raw, ctx.extracted, data, memory, ctx.forcedExpense);
  if (spend) readings.push({ kind: "expense", score: BASE.expense, why: "sumă plus un cuvânt de cheltuială", proposal: spend });

  const due = paidRecurringProposal(raw, data);
  if (due) readings.push({ kind: "due", score: BASE.due, why: "spune că a plătit o scadență cunoscută", proposal: due });

  const moved = transferProposal(raw, data);
  if (moved) readings.push({ kind: "transfer", score: BASE.transfer, why: "«mută … din … în …»", proposal: moved });

  const income = incomeProposal(raw, data);
  if (income) readings.push({ kind: "income", score: BASE.income, why: "sumă plus un cuvânt de venit", proposal: income });

  const insight = localInsight(raw, data, memory);
  if (insight) readings.push({ kind: "insight", score: BASE.insight, why: "întreabă ce mai are disponibil", text: insight });

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
