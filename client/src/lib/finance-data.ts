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

export type Receipt = {
  id: string;
  vendor: string;
  amount: number;
  category: string;
  date: string;
  note?: string;
  imageData?: string;
};

export type FamilyMember = {
  id: string;
  name: string;
};

export type PaymentSource = {
  id: string;
  name: string;
  kind: "card" | "cash" | "meal" | "transfer";
  memberId?: string;
  balance: number;
};

export type BudgetAllocation = {
  id: string;
  label: string;
  amount: number;
  memberId?: string;
  category?: string;
};

export type SalaryPlan = {
  periodStart: string;
  nextPayday: string;
  sourceIds: string[];
  totalLimit: number;
  weeklyLimit: number;
  allocations: BudgetAllocation[];
};

export type FamilySettings = {
  familyName: string;
  memberName: string;
  familyCode: string;
  members: FamilyMember[];
  paymentSources: PaymentSource[];
  customCategories: string[];
  salaryPlan: SalaryPlan;
};

export type AppData = {
  version: 5;
  transactions: Transaction[];
  debts: Debt[];
  savings: SavingsGoal[];
  receipts: Receipt[];
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
  version: 5,
  transactions: [],
  debts: [],
  savings: [],
  receipts: [],
  settings: { familyName: "Familia mea", memberName: "Eu", familyCode: createFamilyCode(), members: [{ id: "member-me", name: "Eu" }], paymentSources: [{ id: "source-debit", name: "Card debit", kind: "card", memberId: "member-me", balance: 0 }, { id: "source-cash", name: "Cash", kind: "cash", memberId: "member-me", balance: 0 }, { id: "source-meal", name: "Bonuri de masă", kind: "meal", memberId: "member-me", balance: 0 }, { id: "source-transfer", name: "Transfer", kind: "transfer", balance: 0 }], customCategories: [], salaryPlan: { periodStart: new Date().toISOString().slice(0, 10), nextPayday: "", sourceIds: [], totalLimit: 0, weeklyLimit: 0, allocations: [] } },
});
