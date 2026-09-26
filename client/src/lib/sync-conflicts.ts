/**
 * Conflictele de sincronizare, rezolvate de om: alege varianta ta sau a partenerului și
 * poți anula alegerea. Funcții pure, fără criptare, ca bannerul de pe Astăzi să nu tragă
 * family-crypto în pachetul de pornire (P3-12 din auditul de performanță).
 */
import type { AllocationAmountConflict, AppData, TransactionConflict } from "@/lib/finance-data";

/**
 * Varianta clară: rezolvă și scoate conflictul din listă, păstrând un stub de undo
 * în allocationConflicts cu resolvedChoice setat (filtrat de UI ca „recent rezolvat”).
 */
export function applyAllocationConflictChoice(data: AppData, conflictId: string, choice: "local" | "remote"): AppData {
  const conflict = data.allocationConflicts.find((item) => item.id === conflictId && !item.resolvedChoice);
  if (!conflict) return data;
  const amount = choice === "local" ? conflict.localAmount : conflict.remoteAmount;
  const current = data.settings.salaryPlan.allocations.find((item) => item.id === conflict.allocationId);
  const previousAmount = current?.amount ?? conflict.localAmount;
  const allocations = data.settings.salaryPlan.allocations.map((item) =>
    item.id === conflict.allocationId ? { ...item, amount, updatedAt: new Date().toISOString() } : item,
  );
  const resolved: AllocationAmountConflict = {
    ...conflict,
    previousAmount,
    resolvedChoice: choice,
    resolvedAt: new Date().toISOString(),
    localAmount: conflict.localAmount,
    remoteAmount: conflict.remoteAmount,
  };
  return {
    ...data,
    allocationConflicts: [
      resolved,
      ...data.allocationConflicts.filter((item) => item.id !== conflictId),
    ].slice(0, 40),
    settings: {
      ...data.settings,
      salaryPlan: {
        ...data.settings.salaryPlan,
        allocations,
        totalLimit: allocations.reduce((sum, item) => sum + item.amount, 0),
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

export function undoAllocationConflictChoice(data: AppData, conflictId: string): AppData {
  const conflict = data.allocationConflicts.find((item) => item.id === conflictId && item.resolvedChoice && item.previousAmount !== undefined);
  if (!conflict || conflict.previousAmount === undefined) return data;
  const allocations = data.settings.salaryPlan.allocations.map((item) =>
    item.id === conflict.allocationId
      ? { ...item, amount: conflict.previousAmount!, updatedAt: new Date().toISOString() }
      : item,
  );
  const reopened: AllocationAmountConflict = {
    ...conflict,
    previousAmount: undefined,
    resolvedChoice: undefined,
    resolvedAt: undefined,
    detectedAt: new Date().toISOString(),
  };
  return {
    ...data,
    allocationConflicts: [reopened, ...data.allocationConflicts.filter((item) => item.id !== conflictId)].slice(0, 40),
    settings: {
      ...data.settings,
      salaryPlan: {
        ...data.settings.salaryPlan,
        allocations,
        totalLimit: allocations.reduce((sum, item) => sum + item.amount, 0),
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

export function activeAllocationConflicts(data: AppData): AllocationAmountConflict[] {
  return (data.allocationConflicts || []).filter((item) => !item.resolvedChoice);
}


export function applyTransactionConflictChoice(data: AppData, conflictId: string, choice: "local" | "remote"): AppData {
  const conflict = data.transactionConflicts.find((item) => item.id === conflictId && !item.resolvedChoice);
  if (!conflict) return data;
  const current = data.transactions.find((item) => item.id === conflict.transactionId);
  if (!current) {
    return {
      ...data,
      transactionConflicts: data.transactionConflicts.filter((item) => item.id !== conflictId),
    };
  }
  const previousSnapshot = { ...current };
  const nextTx = choice === "local"
    ? { ...current, updatedAt: new Date().toISOString() }
    : { ...conflict.remoteSnapshot, id: conflict.transactionId, updatedAt: new Date().toISOString() };
  const resolved: TransactionConflict = {
    ...conflict,
    previousSnapshot,
    resolvedChoice: choice,
    resolvedAt: new Date().toISOString(),
  };
  return {
    ...data,
    transactions: data.transactions.map((item) => (item.id === conflict.transactionId ? nextTx : item)),
    transactionConflicts: [resolved, ...data.transactionConflicts.filter((item) => item.id !== conflictId)].slice(0, 40),
  };
}

export function undoTransactionConflictChoice(data: AppData, conflictId: string): AppData {
  const conflict = data.transactionConflicts.find((item) => item.id === conflictId && item.resolvedChoice && item.previousSnapshot);
  if (!conflict || !conflict.previousSnapshot) return data;
  const reopened: TransactionConflict = {
    ...conflict,
    previousSnapshot: undefined,
    resolvedChoice: undefined,
    resolvedAt: undefined,
    detectedAt: new Date().toISOString(),
  };
  return {
    ...data,
    transactions: data.transactions.map((item) =>
      item.id === conflict.transactionId ? { ...conflict.previousSnapshot!, updatedAt: new Date().toISOString() } : item,
    ),
    transactionConflicts: [reopened, ...data.transactionConflicts.filter((item) => item.id !== conflictId)].slice(0, 40),
  };
}

export function activeTransactionConflicts(data: AppData): TransactionConflict[] {
  return (data.transactionConflicts || []).filter((item) => !item.resolvedChoice);
}
