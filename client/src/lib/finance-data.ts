/**
 * Atelierul Financiar — model local demonstrativ pentru UI; cifrele sunt fictive și rămân doar în browser.
 */
export type TransactionKind = "income" | "expense";

export type Transaction = {
  id: string;
  title: string;
  amount: number;
  kind: TransactionKind;
  category: string;
  source: string;
  person: string;
  date: string;
  note?: string;
};

export const categoryBudgets = [
  { label: "Alimente", spent: 842, budget: 1200, color: "#143C36" },
  { label: "Casă & facturi", spent: 1160, budget: 1450, color: "#61756B" },
  { label: "Transport", spent: 248, budget: 420, color: "#E6B84A" },
  { label: "Timp liber", spent: 316, budget: 350, color: "#C9674D" },
];

export const weeklyTrend = [
  { day: "Lu", amount: 128 },
  { day: "Ma", amount: 86 },
  { day: "Mi", amount: 214 },
  { day: "Jo", amount: 64 },
  { day: "Vi", amount: 168 },
  { day: "Sâ", amount: 292 },
  { day: "Du", amount: 120 },
];

export const initialTransactions: Transaction[] = [
  { id: "t-01", title: "Lidl — cumpărături", amount: 186.42, kind: "expense", category: "Alimente", source: "Card", person: "Andrei", date: "Astăzi, 18:42", note: "Bon atașat · 14 produse" },
  { id: "t-02", title: "Salariu", amount: 5400, kind: "income", category: "Venit", source: "Card", person: "Andrei", date: "25 aug.", note: "Venit recurent" },
  { id: "t-03", title: "Benzină", amount: 220, kind: "expense", category: "Transport", source: "Card", person: "Maria", date: "25 aug.", note: "Stație carburant" },
  { id: "t-04", title: "Rată frigider", amount: 189, kind: "expense", category: "Rate produse", source: "Card", person: "Andrei", date: "24 aug.", note: "Plată lunară" },
];

export const debts = [
  { name: "Credit locuință", remaining: 178420, monthly: 1760, due: "5 sept.", progress: 21, tone: "forest" },
  { name: "Rată frigider", remaining: 1323, monthly: 189, due: "24 sept.", progress: 62, tone: "honey" },
  { name: "Împrumut familie", remaining: 900, monthly: 150, due: "15 sept.", progress: 40, tone: "coral" },
];

export const expenseCategories = ["Alimente", "Băuturi", "Apă", "Dulciuri", "Transport", "Casă & facturi", "Sănătate", "Timp liber", "Rate produse", "Altele"];
