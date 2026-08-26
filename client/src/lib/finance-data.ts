/**
 * Atelierul Financiar — model local, privat și portabil pentru GitHub Pages.
 * Datele sunt create de utilizator și rămân în browser până la export/import.
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

export type Debt = {
  id: string;
  name: string;
  remaining: number;
  monthly: number;
  due: string;
  tone: "forest" | "honey" | "coral";
};

export type SavingsGoal = {
  id: string;
  name: string;
  current: number;
  target: number;
  due: string;
  tone: "forest" | "honey" | "coral";
};

export type FamilySettings = {
  familyName: string;
  memberName: string;
  familyCode: string;
};

export type AppData = {
  version: 3;
  transactions: Transaction[];
  debts: Debt[];
  savings: SavingsGoal[];
  settings: FamilySettings;
};

export const expenseCategories = ["Alimente", "Băuturi", "Apă", "Dulciuri", "Transport", "Casă & facturi", "Sănătate", "Timp liber", "Rate produse", "Altele"];

export const categoryColors: Record<string, string> = {
  Alimente: "#143C36",
  "Casă & facturi": "#61756B",
  Transport: "#E6B84A",
  "Timp liber": "#C9674D",
  Sănătate: "#6A9AB3",
  "Rate produse": "#B1794E",
  Altele: "#7C857F",
};

export const createFamilyCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
};

export const createEmptyAppData = (): AppData => ({
  version: 3,
  transactions: [],
  debts: [],
  savings: [],
  settings: { familyName: "Familia mea", memberName: "Eu", familyCode: createFamilyCode() },
});
