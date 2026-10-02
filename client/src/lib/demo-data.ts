/**
 * Familia exemplu de la prima pornire: omul vede aplicația plină înainte să scrie ceva.
 * Totul e inventat și relativ la azi (salariul a intrat acum două săptămâni, următorul vine
 * peste două). Cât ține exemplul, sincronizarea e oprită; „Încep cu datele mele” golește tot.
 */
import { addIsoDays, createEmptyAppData, type AppData, type Transaction } from "@/lib/finance-data";
import { safeSetItem } from "@/lib/safe-storage";

export const DEMO_KEY = "buget-familie:demo-mode";

export function isDemoMode(storage: Pick<Storage, "getItem"> | undefined = typeof window !== "undefined" ? window.localStorage : undefined): boolean {
  try { return storage?.getItem(DEMO_KEY) === "1"; } catch { return false; }
}

export function setDemoMode(on: boolean) {
  try {
    if (on) safeSetItem(window.localStorage, DEMO_KEY, "1");
    else window.localStorage.removeItem(DEMO_KEY);
  } catch { /* fără stocare: exemplul ține cât e deschisă aplicația */ }
}

export function buildDemoData(today: string): AppData {
  const data = createEmptyAppData();
  const day = (offset: number) => addIsoDays(today, offset);
  const stamp = `${day(-14)}T08:00:00.000Z`;
  const me = { id: "member-me", name: "Andrei", color: "#256B5B" };
  const partner = { id: "member-demo-maria", name: "Maria", color: "#2F6FD6" };
  data.settings.familyName = "Familia Popescu";
  data.settings.memberName = me.name;
  data.settings.members = [me, partner];
  data.settings.selfMemberId = me.id;
  data.settings.paymentSources = [
    { id: "source-debit", name: "Card Andrei", kind: "card", memberId: me.id, openingBalance: 900 },
    { id: "source-maria", name: "Card Maria", kind: "card", memberId: partner.id, openingBalance: 700 },
    { id: "source-cash", name: "Cash", kind: "cash", memberId: me.id, openingBalance: 200 },
    { id: "source-transfer", name: "Transfer comun", kind: "transfer", openingBalance: 0 },
  ];
  const plan = data.settings.salaryPlan;
  plan.periodStart = day(-14);
  plan.nextPayday = day(16);
  plan.paydayFlexDays = 3;
  plan.sourceIds = ["source-debit", "source-maria"];
  plan.incomes = [
    { id: "inc-andrei", memberId: me.id, label: "Salariul lui Andrei", amount: 4700, day: Number(day(-14).slice(8, 10)), updatedAt: stamp },
    { id: "inc-maria", memberId: partner.id, label: "Salariul Mariei", amount: 4300, day: Number(day(-12).slice(8, 10)), updatedAt: stamp },
  ];
  plan.allocations = [
    { id: "a-chirie", label: "Chirie", category: "Casă & facturi", amount: 1800, weeklyPace: false, alertThreshold: 80 },
    { id: "a-rata", label: "Rată bancă", category: "Credite", amount: 1100, weeklyPace: false, alertThreshold: 80 },
    { id: "a-utilitati", label: "Utilități", category: "Casă & facturi", amount: 480, weeklyPace: false, alertThreshold: 80 },
    { id: "a-mancare", label: "Mâncare", category: "Alimente", amount: 2400, weeklyPace: true, alertThreshold: 80 },
    { id: "a-transport", label: "Transport", category: "Transport", amount: 700, weeklyPace: true, alertThreshold: 80 },
    { id: "a-copil", label: "Copil", category: "Consumabile copil", amount: 600, weeklyPace: false, alertThreshold: 80 },
    { id: "a-timp", label: "Timp liber", category: "Timp liber", amount: 600, weeklyPace: true, alertThreshold: 80 },
    { id: "a-sanatate", label: "Neprevăzute", category: "Sănătate", amount: 300, weeklyPace: false, alertThreshold: 80 },
  ];
  let n = 0;
  const tx = (offset: number, title: string, amount: number, category: string, who = me, sourceId = "source-debit", kind: "expense" | "income" = "expense", allocationId?: string): Transaction => ({
    id: `demo-${++n}`, date: day(offset), title, amount, kind, category, memberId: who.id, person: who.name, sourceId,
    source: sourceId === "source-maria" ? "Card Maria" : sourceId === "source-cash" ? "Cash" : "Card Andrei",
    ...(allocationId ? { allocationId } : {}), createdAt: `${day(offset)}T09:00:00.000Z`, updatedAt: `${day(offset)}T09:00:00.000Z`,
  });
  data.transactions = [
    tx(-14, "Salariul lui Andrei", 4700, "Salariu", me, "source-debit", "income"),
    tx(-12, "Salariul Mariei", 4300, "Salariu", partner, "source-maria", "income"),
    tx(-13, "Chirie", 1800, "Casă & facturi", me, "source-debit", "expense", "a-chirie"),
    tx(-11, "Rată bancă", 1100, "Credite", me, "source-debit", "expense", "a-rata"),
    tx(-9, "Enel", 212.3, "Casă & facturi", me, "source-debit", "expense", "a-utilitati"),
    tx(-8, "Apa Nova", 86.5, "Casă & facturi", partner, "source-maria", "expense", "a-utilitati"),
    tx(-12, "Kaufland", 318.4, "Alimente", partner, "source-maria", "expense", "a-mancare"),
    tx(-9, "Lidl", 241.9, "Alimente", me, "source-debit", "expense", "a-mancare"),
    tx(-6, "Mega Image", 96.2, "Alimente", partner, "source-maria", "expense", "a-mancare"),
    tx(-4, "Piață", 74, "Alimente", me, "source-cash", "expense", "a-mancare"),
    tx(-2, "Lidl", 124.3, "Alimente", me, "source-debit", "expense", "a-mancare"),
    tx(-1, "Profi", 38.6, "Alimente", partner, "source-maria", "expense", "a-mancare"),
    tx(-10, "Benzină", 250, "Transport", me, "source-debit", "expense", "a-transport"),
    tx(-5, "Bolt", 32, "Transport", partner, "source-maria", "expense", "a-transport"),
    tx(-10, "Grădiniță", 450, "Consumabile copil", partner, "source-maria", "expense", "a-copil"),
    tx(-3, "Pampers", 89.9, "Consumabile copil", me, "source-debit", "expense", "a-copil"),
    tx(-7, "Farmacia Catena", 64, "Sănătate", partner, "source-maria", "expense", "a-sanatate"),
    tx(-6, "Cinema", 96, "Timp liber", me, "source-debit", "expense", "a-timp"),
    tx(-2, "Pizza", 78, "Timp liber", partner, "source-maria", "expense", "a-timp"),
    tx(-11, "Netflix", 59.99, "Abonamente", me, "source-debit"),
    tx(0, "Cafea", 14, "Alimente", me, "source-cash", "expense", "a-mancare"),
  ];
  data.debts = [{ id: "demo-debt", name: "Credit nevoi personale", remaining: 18500, monthly: 1100, annualRate: 11.5, kind: "credit", due: "", tone: "coral", dueDate: day(19) }];
  data.savings = [{ id: "demo-saving", name: "Vacanță la mare", current: 1800, target: 5000, due: "", tone: "forest", dueDate: day(240) }];
  data.recurring = [
    { id: "demo-net", name: "Internet", amount: 60, category: "Casă & facturi", sourceId: "source-debit", memberId: me.id, dueDay: Number(day(6).slice(8, 10)), active: true },
    { id: "demo-netflix", name: "Netflix", amount: 59.99, category: "Abonamente", sourceId: "source-debit", memberId: me.id, dueDay: Number(day(-11).slice(8, 10)), active: true },
  ];
  return data;
}
