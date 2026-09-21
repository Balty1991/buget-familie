/**
 * Verificarea soldului: singura întrebare care ține aplicația onestă.
 *
 * O aplicație de plicuri moare mereu la fel — în luna a treia cifra din ecran nu mai
 * seamănă cu cea din card, fiindcă s-au uitat niște cumpărături cu cash. Omul o deschide,
 * vede o minciună politicoasă și o închide la loc.
 *
 * Nimic din aplicație nu întreba până acum „cât ai de fapt?”. Aici e întrebarea, pusă rar
 * (o dată pe tranșă) și doar pentru locurile unde chiar se mișcă bani. Răspunsul nu
 * rescrie soldul pe ascuns: diferența intră în registru ca mișcare, cu ziua ei, ca omul
 * să vadă mai târziu de ce nu se potriveau cifrele.
 */
import {
  isoToday,
  newId,
  planEndDate,
  sourceBalance,
  type AppData,
  type PaymentSource,
  type Transaction,
} from "./finance-data";
import { t } from "./i18n";

const CHECK_KEY = "buget-familie:last-balance-check";
/** O tranșă are șapte zile; mai des de atât, întrebarea devine zgomot. */
const ZILE_INTRE_VERIFICARI = 7;
/** Sub atâtea mișcări, registrul e prea tânăr ca să fi apucat să se abată de la realitate. */
const MISCARI_MINIME = 4;

export type BalanceCheckRow = { id: string; name: string; kind: PaymentSource["kind"]; balance: number };
export type BalanceCheckPrompt = { due: boolean; why: string; rows: BalanceCheckRow[] };

const zile = (from: string, to: string) =>
  Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000);

/** Locurile unde chiar se mișcă bani: sursele planului, iar dacă planul tace, cele cu activitate. */
export function balanceCheckRows(data: AppData): BalanceCheckRow[] {
  const plan = data.settings.salaryPlan;
  const folosite = new Set([
    ...(plan.sourceIds || []),
    ...data.transactions.slice(0, 200).map((item) => item.sourceId || ""),
  ]);
  return data.settings.paymentSources
    .filter((item) => folosite.has(item.id) || item.openingBalance > 0)
    // Bonurile de masă nu se verifică pe card: soldul lor se vede pe bon, nu în bancă.
    .filter((item) => item.kind !== "meal")
    .slice(0, 4)
    .map((item) => ({ id: item.id, name: item.name, kind: item.kind, balance: Math.round(sourceBalance(data, item.id) * 100) / 100 }));
}

/**
 * Se cuvine întrebat acum? Prima dată abia după ce registrul are ce să piardă, apoi o dată
 * la șapte zile — sau imediat ce începe un ciclu nou, fiindcă atunci se compară cel mai ușor.
 */
export function balanceCheckDue(data: AppData, lastCheck: string | null, today = isoToday()): BalanceCheckPrompt {
  const rows = balanceCheckRows(data);
  const gol = { due: false, why: "", rows };
  if (!rows.length || data.transactions.length < MISCARI_MINIME) return gol;
  const plan = data.settings.salaryPlan;
  if (!plan.periodStart || !planEndDate(plan)) return gol;
  if (!lastCheck) return { due: true, why: t("Prima verificare: potrivim cifrele cu realitatea."), rows };
  const trecute = zile(lastCheck, today);
  if (trecute < 0) return gol;
  if (lastCheck < plan.periodStart && today >= plan.periodStart) {
    return { due: true, why: t("Ciclu nou — e cel mai ușor moment să potrivim cifrele."), rows };
  }
  if (trecute >= ZILE_INTRE_VERIFICARI) {
    return { due: true, why: t("Au trecut {days} zile de la ultima verificare.", { days: String(trecute) }), rows };
  }
  return gol;
}

/**
 * Cât spune omul că are, scris ca mișcare adevărată. Se adaugă doar diferența, deci soldul
 * ajunge exact la suma spusă, iar a doua declarație a aceleiași sume nu mai scrie nimic.
 */
export function applyDeclaredBalance(data: AppData, sourceId: string, amount: number, today = isoToday()): AppData {
  const target = data.settings.paymentSources.find((item) => item.id === sourceId);
  if (!target || !Number.isFinite(amount) || amount < 0) return data;
  const diferenta = Math.round((amount - sourceBalance(data, sourceId)) * 100) / 100;
  if (Math.abs(diferenta) < 0.005) return data;
  const urcare = diferenta > 0;
  const persoana = data.settings.members.find((item) => item.id === target.memberId) || data.settings.members[0];
  const miscare: Transaction = {
    id: newId("balance-check"),
    title: urcare ? t("Bani disponibili") : t("Corecție de sold"),
    amount: Math.abs(diferenta),
    kind: urcare ? "income" : "expense",
    category: urcare ? "Venit" : "Altele",
    sourceId: target.id,
    source: target.name,
    memberId: persoana?.id,
    person: persoana?.name || "",
    date: today,
    allocationId: urcare ? undefined : "outside",
    note: t("Sold verificat — diferența față de cât vedea aplicația."),
    createdAt: new Date().toISOString(),
  };
  return { ...data, transactions: [miscare, ...data.transactions] };
}

/* ------------------------------------------------ când am întrebat ultima oară */

export function readLastBalanceCheck(): string | null {
  try {
    const raw = window.localStorage.getItem(CHECK_KEY);
    return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function markBalanceChecked(today = isoToday()): void {
  try {
    window.localStorage.setItem(CHECK_KEY, today);
  } catch {
    // Fără localStorage întrebarea revine la următoarea deschidere; nu e o pagubă.
  }
}
