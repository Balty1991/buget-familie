/**
 * Atelierul Financiar — export CSV local pentru rândurile deja filtrate în Jurnal.
 * Nu trimite date în rețea; formează un fișier UTF-8 compatibil cu Excel și foi de calcul.
 */
import { csvSafe, saveExport } from "@/lib/save-export";
import type { AppData, Transaction } from "./finance-data";
import { t } from "./i18n";

const quote = csvSafe;

const envelopeLabel = (data: AppData | undefined, allocationId?: string) => {
  if (!allocationId || allocationId === "outside") return t("În afara plicurilor");
  const hit = data?.settings.salaryPlan.allocations.find((item) => item.id === allocationId);
  return hit?.label || allocationId;
};

export const journalCsvSnapshot = (transactions: Transaction[], data?: AppData) => [
  [t("Data"), t("Tip"), t("Denumire"), t("Categorie"), t("Sumă (RON)"), t("Membru"), t("Sursă"), t("Plic"), t("Notiță")],
  ...transactions.map((item) => [
    item.date,
    item.kind === "income" ? t("Venit") : t("Cheltuială"),
    item.title,
    t(item.category),
    item.amount.toFixed(2).replace(".", ","),
    item.person,
    item.source,
    envelopeLabel(data, item.allocationId),
    item.note || "",
  ]),
].map((row) => row.map(quote).join(";")).join("\r\n");

export const downloadJournalCsv = (transactions: Transaction[], filename = "jurnal-buget-familie.csv", data?: AppData) => {
  const csv = `\uFEFF${journalCsvSnapshot(transactions, data)}`;
  void saveExport(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
};
