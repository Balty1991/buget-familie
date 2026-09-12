/**
 * Atelierul Financiar — criptare locală a registrului de familie și unirea a două copii.
 * Parola nu se persistă; doar un pachet AES-GCM deja criptat părăsește telefonul.
 */
import {
  buildPendingReviewMeta,
  normalizeAppData,
  type AllocationAmountConflict,
  type AllocationHistoryEntry,
  type AppData,
  type BudgetAllocation,
  type DeletedRecord,
  type PendingReviewMeta,
  type SyncDevice,
  type Transaction,
  type TransactionConflict,
} from "@/lib/finance-data";

export type EncryptedEnvelope = {
  version: 1;
  createdAt: string;
  salt: string;
  iv: string;
  ciphertext: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const iterations = 250_000;

const toBase64 = (bytes: Uint8Array) => {
  let output = "";
  bytes.forEach((byte) => { output += String.fromCharCode(byte); });
  return btoa(output);
};

const fromBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

async function deriveKey(secret: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptFamilyData(data: AppData, secret: string): Promise<EncryptedEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret, salt);
  // Preferințele de viteză și de lectură rămân pe telefon; registrul financiar rămâne partea sincronizată.
  // Propunerile de verificat rămân pe telefonul care le-a creat: fără ele, o propunere
  // ignorată pe un telefon ar fi readusă de celălalt la următoarea unire.
  // Ciornele complete rămân pe telefon; partajăm doar un rezumat fără imagini.
  // Conflictele de mișcare/plic se trimit ca meta, ca partenerul să le vadă.
  const shareable = {
    ...data,
    pendingReview: [],
    pendingReviewMeta: buildPendingReviewMeta(data),
    receipts: data.receipts.map(({ imageData: _one, imageData2: _two, imageKeys: _keys, ...receipt }) => receipt),
    settings: {
      ...data.settings,
      quickTemplates: [],
      archivedQuickTemplates: [],
      savedJournalFilters: [],
      salaryCycleTemplates: [],
      exchangeRates: [],
      seenWeeklyPlanTranches: [],
      basketProducts: [],
      merchantRules: [],
    },
  };
  const plain = encoder.encode(JSON.stringify(shareable));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return { version: 1, createdAt: new Date().toISOString(), salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptFamilyData(envelope: EncryptedEnvelope, secret: string): Promise<AppData> {
  if (envelope.version !== 1) throw new Error("Format de pachet necunoscut.");
  try {
    const key = await deriveKey(secret, fromBase64(envelope.salt));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.ciphertext));
    return JSON.parse(decoder.decode(plain)) as AppData;
  } catch {
    throw new Error("Parola familiei este greșită sau pachetul nu poate fi decriptat.");
  }
}

const timestamp = (item: { updatedAt?: string; createdAt?: string }) => Date.parse(item.updatedAt || item.createdAt || "") || 0;
const deletionKey = (item: DeletedRecord) => `${item.entity}:${item.id}`;

function mergeCollection<T extends { id: string; updatedAt?: string; createdAt?: string }>(entity: DeletedRecord["entity"], local: T[], remote: T[], deleted: DeletedRecord[]) {
  const tombstones = new Map(deleted.filter((item) => item.entity === entity).map((item) => [item.id, item]));
  const all = new Map<string, T>();
  [...remote, ...local].forEach((item) => {
    const existing = all.get(item.id);
    if (!existing || timestamp(item) >= timestamp(existing)) all.set(item.id, item);
  });
  return Array.from(all.values()).filter((item) => {
    const tombstone = tombstones.get(item.id);
    // Fără ștergere înregistrată păstrăm elementul chiar dacă nu are marcaj de timp:
    // datoriile și obiectivele salvate din dialog nu poartă `updatedAt`, iar o comparație
    // strictă le-ar fi scos definitiv din registru la prima unire a două telefoane.
    if (!tombstone) return true;
    return (Date.parse(tombstone.deletedAt) || 0) < timestamp(item);
  });
}

function mergeSyncDevices(local: SyncDevice[], remote: SyncDevice[]): SyncDevice[] {
  const all = new Map<string, SyncDevice>();
  [...remote, ...local].forEach((item) => {
    const existing = all.get(item.id);
    if (!existing) {
      all.set(item.id, item);
      return;
    }
    const newer = Date.parse(item.lastSeenAt) >= Date.parse(existing.lastSeenAt) ? item : existing;
    const revokedCandidates = [item.revokedAt, existing.revokedAt].filter(Boolean).sort() as string[];
    const revokedAt = revokedCandidates.length ? revokedCandidates[revokedCandidates.length - 1] : undefined;
    all.set(item.id, { ...newer, revokedAt });
  });
  return Array.from(all.values()).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)).slice(0, 20);
}

/**
 * Unește plicurile pe id. Dacă același id are sume diferite pe cele două telefoane,
 * păstrăm suma locală pentru continuitate pe telefonul curent și înregistrăm un conflict
 * — niciodată LWW tăcut pe bani.
 */
function mergeAllocationsWithConflicts(
  localAllocations: BudgetAllocation[],
  remoteAllocations: BudgetAllocation[],
  previousConflicts: AllocationAmountConflict[],
): { allocations: BudgetAllocation[]; conflicts: AllocationAmountConflict[] } {
  const remoteById = new Map(remoteAllocations.map((item) => [item.id, item]));
  const localById = new Map(localAllocations.map((item) => [item.id, item]));
  const ids = new Set([...Array.from(localById.keys()), ...Array.from(remoteById.keys())]);
  const allocations: BudgetAllocation[] = [];
  const freshConflicts: AllocationAmountConflict[] = [];
  const now = new Date().toISOString();

  ids.forEach((id) => {
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);
    if (localItem && remoteItem) {
      if (localItem.amount !== remoteItem.amount) {
        allocations.push(localItem);
        freshConflicts.push({
          id: `conflict-${id}`,
          allocationId: id,
          label: localItem.label || remoteItem.label || "Plic",
          localAmount: localItem.amount,
          remoteAmount: remoteItem.amount,
          localUpdatedAt: localItem.updatedAt,
          remoteUpdatedAt: remoteItem.updatedAt,
          detectedAt: now,
        });
        return;
      }
      const winner = timestamp(localItem) >= timestamp(remoteItem) ? localItem : remoteItem;
      allocations.push(winner);
      return;
    }
    allocations.push((localItem || remoteItem)!);
  });

  const openPrevious = previousConflicts.filter((item) => !item.resolvedChoice && allocations.some((allocation) => allocation.id === item.allocationId));
  const byAllocation = new Map<string, AllocationAmountConflict>();
  [...openPrevious, ...freshConflicts].forEach((item) => byAllocation.set(item.allocationId, item));
  return { allocations, conflicts: Array.from(byAllocation.values()).slice(0, 40) };
}


/** Câmpuri care, dacă diferă pe același id, ar corupe ledgerul la LWW tăcut. */
function transactionMateriallyDiffers(localItem: Transaction, remoteItem: Transaction): boolean {
  return (
    localItem.amount !== remoteItem.amount
    || localItem.kind !== remoteItem.kind
    || localItem.date !== remoteItem.date
    || (localItem.allocationId || "") !== (remoteItem.allocationId || "")
    || (localItem.sourceId || "") !== (remoteItem.sourceId || "")
    || (localItem.memberId || "") !== (remoteItem.memberId || "")
  );
}

/**
 * Unește mișcările pe id. La același id cu editări materiale diferite păstrăm local
 * și înregistrăm conflict — niciodată LWW tăcut pe sumă/dată/plic/sursă.
 */
function mergeTransactionsWithConflicts(
  localTx: Transaction[],
  remoteTx: Transaction[],
  deleted: DeletedRecord[],
  previousConflicts: TransactionConflict[],
): { transactions: Transaction[]; conflicts: TransactionConflict[] } {
  const tombstones = new Map(deleted.filter((item) => item.entity === "transactions").map((item) => [item.id, item]));
  const remoteById = new Map(remoteTx.map((item) => [item.id, item]));
  const localById = new Map(localTx.map((item) => [item.id, item]));
  const ids = new Set([...Array.from(localById.keys()), ...Array.from(remoteById.keys())]);
  const transactions: Transaction[] = [];
  const freshConflicts: TransactionConflict[] = [];
  const now = new Date().toISOString();

  ids.forEach((id) => {
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);
    const tombstone = tombstones.get(id);
    const alive = (item: Transaction) => {
      if (!tombstone) return true;
      return (Date.parse(tombstone.deletedAt) || 0) < timestamp(item);
    };
    if (localItem && remoteItem) {
      if (!alive(localItem) && !alive(remoteItem)) return;
      if (transactionMateriallyDiffers(localItem, remoteItem) && alive(localItem)) {
        transactions.push(localItem);
        freshConflicts.push({
          id: `tx-conflict-${id}`,
          transactionId: id,
          label: localItem.title || remoteItem.title || "Mișcare",
          localAmount: localItem.amount,
          remoteAmount: remoteItem.amount,
          localKind: localItem.kind,
          remoteKind: remoteItem.kind,
          localDate: localItem.date,
          remoteDate: remoteItem.date,
          localTitle: localItem.title,
          remoteTitle: remoteItem.title,
          localUpdatedAt: localItem.updatedAt || localItem.createdAt,
          remoteUpdatedAt: remoteItem.updatedAt || remoteItem.createdAt,
          remoteSnapshot: remoteItem,
          detectedAt: now,
        });
        return;
      }
      const winner = timestamp(localItem) >= timestamp(remoteItem) ? localItem : remoteItem;
      if (alive(winner)) transactions.push(winner);
      return;
    }
    const only = (localItem || remoteItem)!;
    if (alive(only)) transactions.push(only);
  });

  const openPrevious = previousConflicts.filter(
    (item) => !item.resolvedChoice && transactions.some((tx) => tx.id === item.transactionId),
  );
  const byTx = new Map<string, TransactionConflict>();
  [...openPrevious, ...freshConflicts].forEach((item) => byTx.set(item.transactionId, item));
  return { transactions, conflicts: Array.from(byTx.values()).slice(0, 40) };
}

function mergePendingReviewMeta(localMeta: PendingReviewMeta[], remoteMeta: PendingReviewMeta[], _localDraftIds: Set<string>): PendingReviewMeta[] {
  const all = new Map<string, PendingReviewMeta>();
  [...remoteMeta, ...localMeta].forEach((item) => {
    const existing = all.get(item.id);
    if (!existing || Date.parse(item.createdAt) >= Date.parse(existing.createdAt)) all.set(item.id, item);
  });
  // Meta pentru ciorne confirmate/respinse local dispara la următorul push; aici păstrăm
  // și meta remote ca partenerul să vadă coada celuilalt telefon.
  return Array.from(all.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 120);
}

/** Unește două copii de familie fără a expedia imagini de bon și fără a reintroduce elemente șterse. */
export function mergeFamilyData(localRaw: AppData, remoteRaw: AppData): AppData {
  const local = normalizeAppData(localRaw); const remote = normalizeAppData(remoteRaw);
  const deleted = [...remote.deleted, ...local.deleted].reduce<DeletedRecord[]>((all, item) => {
    const index = all.findIndex((entry) => deletionKey(entry) === deletionKey(item));
    if (index < 0) return [...all, item];
    if (Date.parse(item.deletedAt) > Date.parse(all[index].deletedAt)) all[index] = item;
    return all;
  }, []).sort((a, b) => a.deletedAt.localeCompare(b.deletedAt)).slice(-500);
  const memberMap = new Map([...remote.settings.members, ...local.settings.members].map((item) => [item.id, item]));
  const sourceMap = new Map([...remote.settings.paymentSources, ...local.settings.paymentSources].map((item) => [item.id, item]));
  const categorySet = new Set([...remote.settings.customCategories, ...local.settings.customCategories]);
  // Plan scalars follow LWW on the plan stamp, but plicuri / transferuri / reguli
  // se unesc pe id — altfel o modificare pe un telefon șterge plicul creat pe celălalt.
  const localPlan = local.settings.salaryPlan;
  const remotePlan = remote.settings.salaryPlan;
  const salaryPlanBase = timestamp(localPlan) >= timestamp(remotePlan) ? localPlan : remotePlan;
  const itemTime = (item: { updatedAt?: string; createdAt?: string; appliedAt?: string }) =>
    Date.parse(item.updatedAt || item.createdAt || item.appliedAt || "") || 0;
  const mergeById = <T extends { id: string }>(left: T[], right: T[], time: (item: T) => number = (item) => itemTime(item as { updatedAt?: string; createdAt?: string; appliedAt?: string })) => {
    const all = new Map<string, T>();
    [...right, ...left].forEach((item) => {
      const existing = all.get(item.id);
      if (!existing || time(item) >= time(existing)) all.set(item.id, item);
    });
    return Array.from(all.values());
  };
  const allocationHistory: AllocationHistoryEntry[] = [...(remotePlan.allocationHistory || []), ...(localPlan.allocationHistory || [])].reduce<AllocationHistoryEntry[]>((all, item) => all.some((entry) => entry.id === item.id) ? all : [...all, item], []).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)).slice(0, 400);
  const { allocations, conflicts } = mergeAllocationsWithConflicts(
    localPlan.allocations || [],
    remotePlan.allocations || [],
    [...(local.allocationConflicts || []), ...(remote.allocationConflicts || [])],
  );
  const salaryPlan = {
    ...salaryPlanBase,
    allocations,
    transfers: mergeById(localPlan.transfers || [], remotePlan.transfers || []),
    weekTransfers: mergeById(localPlan.weekTransfers || [], remotePlan.weekTransfers || []),
    salaryAllocationRules: mergeById(localPlan.salaryAllocationRules || [], remotePlan.salaryAllocationRules || []),
    salaryAllocationApplications: mergeById(localPlan.salaryAllocationApplications || [], remotePlan.salaryAllocationApplications || []),
    allocationHistory,
  };
  const syncDevices = mergeSyncDevices(local.settings.syncDevices || [], remote.settings.syncDevices || []);
  const { transactions, conflicts: txConflicts } = mergeTransactionsWithConflicts(
    local.transactions,
    remote.transactions,
    deleted,
    [...(local.transactionConflicts || []), ...(remote.transactionConflicts || [])],
  );
  const localDraftIds = new Set(local.pendingReview.map((item) => item.id));
  const pendingReviewMeta = mergePendingReviewMeta(
    buildPendingReviewMeta(local),
    [...(local.pendingReviewMeta || []), ...(remote.pendingReviewMeta || [])],
    localDraftIds,
  );
  return normalizeAppData({
    version: 9,
    pendingReview: local.pendingReview,
    pendingReviewMeta,
    allocationConflicts: conflicts,
    transactionConflicts: txConflicts,
    transactions,
    debts: mergeCollection("debts", local.debts, remote.debts, deleted),
    savings: mergeCollection("savings", local.savings, remote.savings, deleted),
    receipts: mergeCollection("receipts", local.receipts.map(({ imageData: _one, imageData2: _two, imageKeys: _keys, ...item }) => item), remote.receipts, deleted),
    recurring: mergeCollection("recurring", local.recurring, remote.recurring, deleted),
    deleted,
    settings: {
      ...remote.settings,
      ...local.settings,
      familyName: local.settings.familyName || remote.settings.familyName,
      memberName: local.settings.memberName,
      familyCode: local.settings.familyCode || remote.settings.familyCode,
      members: Array.from(memberMap.values()),
      paymentSources: Array.from(sourceMap.values()),
      customCategories: Array.from(categorySet),
      quickTemplates: local.settings.quickTemplates,
      archivedQuickTemplates: local.settings.archivedQuickTemplates,
      savedJournalFilters: local.settings.savedJournalFilters,
      salaryCycleTemplates: local.settings.salaryCycleTemplates,
      exchangeRates: local.settings.exchangeRates,
      seenWeeklyPlanTranches: local.settings.seenWeeklyPlanTranches,
      basketProducts: local.settings.basketProducts,
      merchantRules: local.settings.merchantRules || [],
      syncDevices,
      salaryPlan,
    },
  });
}

/** Transformă parola de familie într-un identificator de cameră, fără a expune parola. */
export async function deriveFamilyRoomId(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`buget-familie-room:${secret}`));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

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

/** Meta remote pe care acest telefon nu le are ca ciornă locală (coada partenerului). */
export function partnerPendingReviewMeta(data: AppData): PendingReviewMeta[] {
  const localIds = new Set(data.pendingReview.map((item) => item.id));
  return (data.pendingReviewMeta || []).filter((item) => !localIds.has(item.id));
}
