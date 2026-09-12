/**
 * Atelierul Financiar — export CSV local pentru rândurile deja filtrate în Jurnal.
 * Nu trimite date în rețea; formează un fișier UTF-8 compatibil cu Excel și foi de calcul.
 */
import type { AppData, Transaction } from "./finance-data";

const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const envelopeLabel = (data: AppData | undefined, allocationId?: string) => {
  if (!allocationId || allocationId === "outside") return "În afara plicurilor";
  const hit = data?.settings.salaryPlan.allocations.find((item) => item.id === allocationId);
  return hit?.label || allocationId;
};

export const journalCsvSnapshot = (transactions: Transaction[], data?: AppData) => [
  ["Data", "Tip", "Denumire", "Categorie", "Sumă (RON)", "Membru", "Sursă", "Plic", "Notiță"],
  ...transactions.map((item) => [
    item.date,
    item.kind === "income" ? "Venit" : "Cheltuială",
    item.title,
    item.category,
    item.amount.toFixed(2).replace(".", ","),
    item.person,
    item.source,
    envelopeLabel(data, item.allocationId),
    item.note || "",
  ]),
].map((row) => row.map(quote).join(";")).join("\r\n");

export const downloadJournalCsv = (transactions: Transaction[], filename = "jurnal-buget-familie.csv", data?: AppData) => {
  const csv = `\uFEFF${journalCsvSnapshot(transactions, data)}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
};
