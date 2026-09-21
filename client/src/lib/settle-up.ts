/**
 * Cine cui datorează la sfârșitul ciclului.
 *
 * Două persoane care țin bugetul împreună au o întrebare pe care aplicația o ocolea:
 * unul plătește cumpărăturile, celălalt facturile, iar la sfârșit nimeni nu știe cine a
 * pus mai mult. Aplicația avea deja toate cifrele — persoana fiecărei mișcări și
 * deosebirea dintre comun și personal — dar nu făcea niciodată scăderea.
 *
 * Se numără doar cheltuielile comune, din ciclul curent, de la ultima decontare încoace.
 * Împărțirea e în părți egale, spusă pe față: orice altă regulă ar fi o părere pe care
 * aplicația nu are de unde s-o știe.
 */
import {
  inPlanPeriod,
  isoToday,
  newId,
  transactionShareScope,
  type AppData,
  type Transaction,
} from "./finance-data";
import { t } from "./i18n";

/** Urma unei decontări, ca socoteala următoare să înceapă de la zero. */
export const SETTLE_NOTE = "decontare-intre-membri";

export type SettleRow = { memberId: string; name: string; paid: number; balance: number };
export type SettleUp = {
  since: string;
  /** Ziua ultimei echilibrări din ciclul curent, dacă a fost una. */
  settledAt?: string;
  total: number;
  perPerson: number;
  rows: SettleRow[];
  /** Cine, cui, cât. Lipsește când diferența e neglijabilă. */
  debt?: { fromId: string; fromName: string; toId: string; toName: string; amount: number };
};

const round = (value: number) => Math.round(value * 100) / 100;

/** Adulții gospodăriei: banii copiilor au ecranul lor, nu intră în decontare. */
const adults = (data: AppData) => data.settings.members.filter((item) => item.kind !== "child");

export function settleUp(data: AppData, today = isoToday()): SettleUp | undefined {
  const membri = adults(data);
  if (membri.length !== 2) return undefined;
  const plan = data.settings.salaryPlan;
  if (!plan.periodStart) return undefined;
  const inCycle = (item: Transaction) => inPlanPeriod(item.date, plan) && item.date <= today;
  const ultimaDecontare = data.transactions
    .filter((item) => item.note === SETTLE_NOTE && inCycle(item))
    .map((item) => item.date)
    .sort()
    .pop();
  const since = ultimaDecontare && ultimaDecontare > plan.periodStart ? ultimaDecontare : plan.periodStart;
  const comune = data.transactions.filter((item) =>
    item.kind === "expense"
    && item.note !== SETTLE_NOTE
    && transactionShareScope(item) === "shared"
    && item.date >= since
    && inCycle(item));
  const total = round(comune.reduce((sum, item) => sum + item.amount, 0));
  const perPerson = round(total / membri.length);
  const rows: SettleRow[] = membri.map((member) => {
    const paid = round(comune.filter((item) => item.memberId === member.id).reduce((sum, item) => sum + item.amount, 0));
    return { memberId: member.id, name: member.name, paid, balance: round(paid - perPerson) };
  });
  const creditor = rows.reduce((cel, item) => item.balance > cel.balance ? item : cel, rows[0]);
  const debitor = rows.reduce((cel, item) => item.balance < cel.balance ? item : cel, rows[0]);
  const diferenta = round(creditor.balance);
  return {
    since,
    settledAt: ultimaDecontare,
    total,
    perPerson,
    rows,
    // Sub un leu nu se cheamă datorie, se cheamă rotunjire.
    debt: diferenta >= 1 && creditor.memberId !== debitor.memberId
      ? { fromId: debitor.memberId, fromName: debitor.name, toId: creditor.memberId, toName: creditor.name, amount: diferenta }
      : undefined,
  };
}

/**
 * Echilibrarea: bani adevărați care trec de la unul la altul, deci două mișcări — una
 * care iese, una care intră. Amândouă sunt personale, ca să nu intre în socoteala
 * următoare, și poartă aceeași urmă, ca socoteala să repornească de aici.
 */
export function applySettlement(data: AppData, today = isoToday()): AppData {
  const socoteala = settleUp(data, today);
  if (!socoteala?.debt) return data;
  const { fromId, fromName, toId, toName, amount } = socoteala.debt;
  const sursa = (memberId: string) => data.settings.paymentSources.find((item) => item.memberId === memberId) || data.settings.paymentSources[0];
  const de_la = sursa(fromId);
  const catre = sursa(toId);
  if (!de_la || !catre) return data;
  const now = new Date().toISOString();
  const iesire: Transaction = {
    id: newId("settle-out"),
    title: t("Decontare către {name}", { name: toName }),
    amount,
    kind: "expense",
    category: "Altele",
    sourceId: de_la.id,
    source: de_la.name,
    memberId: fromId,
    person: fromName,
    date: today,
    allocationId: "outside",
    shareScope: "personal",
    note: SETTLE_NOTE,
    createdAt: now,
  };
  const intrare: Transaction = {
    id: newId("settle-in"),
    title: t("Decontare de la {name}", { name: fromName }),
    amount,
    kind: "income",
    category: "Venit",
    sourceId: catre.id,
    source: catre.name,
    memberId: toId,
    person: toName,
    date: today,
    shareScope: "personal",
    note: SETTLE_NOTE,
    createdAt: now,
  };
  return { ...data, transactions: [intrare, iesire, ...data.transactions] };
}
