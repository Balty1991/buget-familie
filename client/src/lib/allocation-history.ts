import { formatDate, type AllocationHistoryEntry, type AppData } from "./finance-data";

const labelsFor = (data: AppData) => new Map(data.settings.salaryPlan.allocations.map((item) => [item.id, item.label]));

/** Combines explicit future events with legacy plan records that predate the history field. */
export function allocationHistorySnapshot(data: AppData): AllocationHistoryEntry[] {
  const plan = data.settings.salaryPlan;
  const labels = labelsFor(data);
  const explicit = plan.allocationHistory || [];
  const references = new Set(explicit.map((item) => item.referenceId).filter(Boolean));
  const legacyTransfers: AllocationHistoryEntry[] = plan.transfers.filter((item) => !references.has(item.id)).map((item) => ({
    id: `legacy-envelope-transfer-${item.id}`, referenceId: item.id, kind: "envelope-transfer", fromAllocationId: item.fromAllocationId, fromAllocationLabel: labels.get(item.fromAllocationId), toAllocationId: item.toAllocationId, toAllocationLabel: labels.get(item.toAllocationId), amount: item.amount, note: item.note, createdAt: item.createdAt,
  }));
  const legacyWeekTransfers: AllocationHistoryEntry[] = (plan.weekTransfers || []).filter((item) => !references.has(item.id)).map((item) => ({
    id: `legacy-week-transfer-${item.id}`, referenceId: item.id, kind: "week-transfer", allocationId: item.allocationId, allocationLabel: labels.get(item.allocationId), amount: item.amount, fromWeekIndex: item.fromWeekIndex, toWeekIndex: item.toWeekIndex, note: item.note, createdAt: item.createdAt,
  }));
  const legacySalaryApplications: AllocationHistoryEntry[] = (plan.salaryAllocationApplications || []).filter((item) => !references.has(item.id)).map((item) => ({
    id: `legacy-income-application-${item.id}`, referenceId: item.id, kind: "income-applied", allocationLabel: item.allocations.map((entry) => labels.get(entry.allocationId) || "Plic eliminat").join(", "), amount: item.allocations.reduce((sum, entry) => sum + entry.amount, 0), incomeId: item.incomeId, incomeTitle: item.incomeTitle, note: `Venit de ${item.incomeAmount.toLocaleString("ro-RO")} RON`, createdAt: item.appliedAt,
  }));
  return [...explicit, ...legacyTransfers, ...legacyWeekTransfers, ...legacySalaryApplications].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

const csvCell = (value: string | number | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const kindLabel = (kind: AllocationHistoryEntry["kind"]) => ({ created: "Plic creat", updated: "Plic modificat", deleted: "Plic șters", "income-applied": "Repartizare din venit", "income-reverted": "Repartizare anulată", "envelope-transfer": "Realocare între plicuri", "week-transfer": "Transfer între săptămâni" })[kind];

export function downloadAllocationHistoryCsv(data: AppData, entries = allocationHistorySnapshot(data)): void {
  const rows = [
    ["Data", "Acțiune", "Plic / sursă", "Sumă", "Modificare", "Notă"],
    ...entries.map((entry) => [
      formatDate(entry.createdAt.slice(0, 10), { day: "2-digit", month: "2-digit", year: "numeric" }),
      kindLabel(entry.kind),
      entry.allocationLabel || [entry.fromAllocationLabel, entry.toAllocationLabel].filter(Boolean).join(" → ") || entry.incomeTitle || "—",
      entry.amount === undefined ? "" : entry.amount.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      entry.previousAmount !== undefined || entry.newAmount !== undefined ? `${entry.previousAmount ?? "—"} → ${entry.newAmount ?? "—"}` : entry.fromWeekIndex !== undefined ? `S${entry.fromWeekIndex} → S${entry.toWeekIndex}` : "",
      entry.note || "",
    ].map((value) => csvCell(value)).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + rows.map((row) => Array.isArray(row) ? row.join(";") : row).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `istoric-repartizari-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
