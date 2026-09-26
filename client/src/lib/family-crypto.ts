/**
 * Atelierul Financiar — criptare locală a registrului de familie și unirea a două copii.
 * Parola nu se persistă; doar un pachet AES-GCM deja criptat părăsește telefonul.
 * Pe telefon poate rămâne cheia PBKDF2 neexportabilă (vezi family-session.ts).
 */
import { mergePlanScalars } from "@/lib/plan-scalars";
import {
  buildPendingReviewMeta,
  normalizeAppData,
  pruneTombstones,
  type AllocationAmountConflict,
  type AllocationHistoryEntry,
  type AppData,
  type BudgetAllocation,
  type DeletedRecord,
  type PendingReviewMeta,
  type PaymentSource,
  type SyncDevice,
  type Transaction,
  type TransactionConflict,
} from "@/lib/finance-data";
import { type PlannedEvent } from "@/lib/planned-events";
import { t } from "@/lib/i18n";

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

/**
 * Parola familiei sau cheia PBKDF2 făcută din ea. Cheia e neexportabilă: poate sta pe
 * telefon ca sesiunea să se reia singură, fără ca parola să poată fi citită înapoi.
 */
export type FamilySecret = string | CryptoKey;

export const importFamilyKeyMaterial = (password: string) =>
  crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);

async function deriveKey(secret: FamilySecret, salt: Uint8Array) {
  const material = typeof secret === "string" ? await importFamilyKeyMaterial(secret) : secret;
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptFamilyData(data: AppData, secret: FamilySecret): Promise<EncryptedEnvelope> {
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
      seenWeeklyPlanTranches: [],
      basketProducts: [],
      merchantRules: [],
      selfMemberId: undefined,
    },
  };
  // Comprimat înainte de criptare (registrul scade de 5–8 ori): un document Firestore are cel mult 1 MiB.
  const plain = await gzip(encoder.encode(JSON.stringify(shareable)));
  const ciphertext = toBase64(new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain)));
  if (ciphertext.length > SYNC_ENVELOPE_LIMIT) throw new Error(t("Registrul familiei a devenit prea mare pentru sincronizare ({size} KB). Șterge bonurile vechi sau fă o copie de siguranță și arhivează anii trecuți.", { size: Math.round(ciphertext.length / 1024) }));
  return { version: 1, createdAt: new Date().toISOString(), salt: toBase64(salt), iv: toBase64(iv), ciphertext };
}

/** Sub limita de 1 MiB a unui document, cu loc pentru restul câmpurilor. */
export const SYNC_ENVELOPE_LIMIT = 900_000;

const GZIP_MAGIC = [0x1f, 0x8b];
async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzipIfNeeded(bytes: Uint8Array): Promise<Uint8Array> {
  // JSON-ul necomprimat (pachetele vechi) începe cu „{”, niciodată cu semnătura gzip.
  if (bytes[0] !== GZIP_MAGIC[0] || bytes[1] !== GZIP_MAGIC[1]) return bytes;
  if (typeof DecompressionStream === "undefined") throw new Error("gzip indisponibil");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function decryptFamilyData(envelope: EncryptedEnvelope, secret: FamilySecret): Promise<AppData> {
  if (envelope.version !== 1) throw new Error("Format de pachet necunoscut.");
  try {
    const key = await deriveKey(secret, fromBase64(envelope.salt));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.ciphertext));
    return JSON.parse(decoder.decode(await gunzipIfNeeded(new Uint8Array(plain)))) as AppData;
  } catch {
    throw new Error("Parola familiei este greșită sau pachetul nu poate fi decriptat.");
  }
}

/** Text scurt (parolă de familie) încuiat cu un alt secret — folosit de codul de recuperare. */
export async function encryptText(plain: string, secret: string): Promise<EncryptedEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plain));
  return { version: 1, createdAt: new Date().toISOString(), salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptText(envelope: EncryptedEnvelope, secret: string): Promise<string> {
  if (envelope.version !== 1) throw new Error("Format de pachet necunoscut.");
  try {
    const key = await deriveKey(secret, fromBase64(envelope.salt));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.ciphertext));
    return decoder.decode(plain);
  } catch {
    throw new Error("Codul de recuperare e greșit sau pachetul nu poate fi decriptat.");
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
    // Ultima scriere pe lastSeenAt câștigă tot rândul, inclusiv revokedAt.
    // Revocarea și reactivarea ridică amândouă lastSeenAt, deci un telefon
    // revocat nu-și poate șterge semnul printr-un heartbeat mai vechi.
    const newer = Date.parse(item.lastSeenAt) >= Date.parse(existing.lastSeenAt) ? item : existing;
    all.set(item.id, newer);
  });
  return Array.from(all.values()).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)).slice(0, 20);
}

const sourceEditedAt = (item: PaymentSource) => Date.parse(item.updatedAt || "") || 0;

/**
 * Sursele implicite au aceleași id-uri pe fiecare telefon nou (`source-debit` etc.).
 * Un Map care lasă localul să scrie peste remote punea soldul 0 al telefonului
 * al doilea în locul soldului real, apoi îl împingea înapoi în familie.
 * Un 0 cu `updatedAt` mai nou rămâne: e o ștergere explicită, nu un default.
 */
function mergePaymentSource(local: PaymentSource, remote: PaymentSource): PaymentSource {
  const localAt = sourceEditedAt(local);
  const remoteAt = sourceEditedAt(remote);
  if (localAt !== remoteAt) {
    const newer = localAt > remoteAt ? local : remote;
    const older = newer === local ? remote : local;
    return { ...older, ...newer, currency: newer.currency ?? older.currency };
  }
  if (local.openingBalance === 0 && remote.openingBalance > 0) {
    return { ...local, openingBalance: remote.openingBalance, currency: remote.currency || local.currency };
  }
  if (remote.openingBalance === 0 && local.openingBalance > 0) {
    return { ...remote, ...local, currency: local.currency || remote.currency };
  }
  return { ...remote, ...local, currency: local.currency || remote.currency };
}

function mergePaymentSources(local: PaymentSource[], remote: PaymentSource[]): PaymentSource[] {
  const localById = new Map(local.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const merged: PaymentSource[] = [];
  for (const item of remote) {
    seen.add(item.id);
    const mine = localById.get(item.id);
    merged.push(mine ? mergePaymentSource(mine, item) : item);
  }
  for (const item of local) {
    if (!seen.has(item.id)) merged.push(item);
  }
  return merged;
}

/**
 * Ce era în cameră la ultima sincronizare: suma fiecărui plic și „semnătura” fiecărei mișcări.
 * Cu ea, o schimbare făcută doar pe un telefon trece la celălalt fără „conflict”; conflict
 * rămâne doar când amândouă telefoanele au schimbat același lucru.
 */
export type SyncBase = { allocations: Record<string, number>; transactions: Record<string, string> };
const txSignature = (item: Transaction) => [item.amount, item.kind, item.date, item.allocationId || "", item.sourceId || "", item.memberId || ""].join("|");
export const syncBaseOf = (data: AppData): SyncBase => ({
  allocations: Object.fromEntries(data.settings.salaryPlan.allocations.map((item) => [item.id, item.amount])),
  transactions: Object.fromEntries(data.transactions.map((item) => [item.id, txSignature(item)])),
});

/**
 * Unește plicurile pe id. Dacă același id are sume diferite pe cele două telefoane,
 * păstrăm suma locală pentru continuitate pe telefonul curent și înregistrăm un conflict
 * — niciodată LWW tăcut pe bani.
 */
function mergeAllocationsWithConflicts(
  localAllocations: BudgetAllocation[],
  remoteAllocations: BudgetAllocation[],
  previousConflicts: AllocationAmountConflict[],
  base?: SyncBase,
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
      const before = base?.allocations[id];
      // Doar un telefon a schimbat suma de la ultima sincronizare: schimbarea lui câștigă.
      if (localItem.amount !== remoteItem.amount && before !== undefined && before === localItem.amount) { allocations.push(remoteItem); return; }
      if (localItem.amount !== remoteItem.amount && before !== undefined && before === remoteItem.amount) { allocations.push(localItem); return; }
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
  base?: SyncBase,
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
      const before = base?.transactions[id];
      if (before !== undefined && transactionMateriallyDiffers(localItem, remoteItem)) {
        // O singură parte s-a schimbat de la ultima sincronizare: ea câștigă, fără conflict.
        if (before === txSignature(localItem)) { if (alive(remoteItem)) transactions.push(remoteItem); return; }
        if (before === txSignature(remoteItem)) { if (alive(localItem)) transactions.push(localItem); return; }
      }
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
export function mergeFamilyData(localRaw: AppData, remoteRaw: AppData, base?: SyncBase): AppData {
  const local = normalizeAppData(localRaw); const remote = normalizeAppData(remoteRaw);
  // O singură trecere (înainte era O(n²): 350 ms la 1.500 de ștergeri).
  const newest = new Map<string, DeletedRecord>();
  for (const item of [...remote.deleted, ...local.deleted]) {
    const key = deletionKey(item);
    const existing = newest.get(key);
    if (!existing || Date.parse(item.deletedAt) > Date.parse(existing.deletedAt)) newest.set(key, item);
  }
  const deletedAll = Array.from(newest.values()).sort((a, b) => a.deletedAt.localeCompare(b.deletedAt));
  // Aceeași regulă ca la normalizare: vârsta ține locul numărului, ca o curățenie mare să
  // nu șteargă urmele ștergerilor dinainte și să le învie de pe celălalt telefon.
  const deleted = pruneTombstones(deletedAll);
  const tombstoneOf = new Map(deleted.map((item) => [deletionKey(item), item]));
  /** Rămâne dacă nu e șters, sau dacă a fost modificat (readus) după ștergere. */
  const alive = (entity: DeletedRecord["entity"], id: string, stamp?: string) => {
    const tombstone = tombstoneOf.get(`${entity}:${id}`);
    return !tombstone || (Date.parse(stamp || "") || 0) > (Date.parse(tombstone.deletedAt) || 0);
  };
  // Același membru pe ambele telefoane: câștigă ultima redenumire; fără marcaj rămâne varianta locală.
  const memberMap = new Map(remote.settings.members.map((item) => [item.id, item]));
  local.settings.members.forEach((item) => {
    const theirs = memberMap.get(item.id);
    if (!theirs || (Date.parse(item.updatedAt || "") || 0) >= (Date.parse(theirs.updatedAt || "") || 0)) memberMap.set(item.id, item);
  });
  const members = Array.from(memberMap.values()).filter((item) => alive("members", item.id, item.updatedAt));
  const paymentSources = mergePaymentSources(local.settings.paymentSources, remote.settings.paymentSources).filter((item) => alive("paymentSources", item.id, (item as { updatedAt?: string }).updatedAt));
  const categorySet = new Set([...remote.settings.customCategories, ...local.settings.customCategories].filter((name) => alive("categories", name)));
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
  const merged = mergeAllocationsWithConflicts(
    localPlan.allocations || [],
    remotePlan.allocations || [],
    [...(local.allocationConflicts || []), ...(remote.allocationConflicts || [])],
    base,
  );
  const allocations = merged.allocations.filter((item) => alive("allocations", item.id, item.updatedAt));
  const conflicts = merged.conflicts.filter((item) => allocations.some((allocation) => allocation.id === item.allocationId));
  const salaryPlan = {
    ...salaryPlanBase,
    ...mergePlanScalars(localPlan, remotePlan),
    allocations,
    transfers: mergeById(localPlan.transfers || [], remotePlan.transfers || []).filter((item) => alive("transfers", item.id, item.createdAt)),
    weekTransfers: mergeById(localPlan.weekTransfers || [], remotePlan.weekTransfers || []).filter((item) => alive("weekTransfers", item.id, item.createdAt)),
    salaryAllocationRules: mergeById(localPlan.salaryAllocationRules || [], remotePlan.salaryAllocationRules || []).filter((item) => alive("salaryRules", item.id, item.updatedAt)),
    salaryAllocationApplications: mergeById(localPlan.salaryAllocationApplications || [], remotePlan.salaryAllocationApplications || []),
    needs: mergeById(localPlan.needs || [], remotePlan.needs || []),
    incomes: mergeById(localPlan.incomes || [], remotePlan.incomes || []),
    allocationHistory,
  };
  /**
   * Evenimentele viitoare se unesc pe id, dar jurnalul „pus deoparte” se adună din
   * ambele telefoane: dacă 200 puși de acasă și 150 puși de la serviciu ar intra în
   * LWW, o sumă reală ar dispărea din fondul de Crăciun fără ca cineva să vadă.
   */
  const mergePlannedEvents = (left: PlannedEvent[], right: PlannedEvent[]): PlannedEvent[] => {
    const ids = Array.from(new Set([...right, ...left].map((item) => item.id)));
    return ids.map((id) => {
      const mine = left.find((item) => item.id === id);
      const theirs = right.find((item) => item.id === id);
      const base = !theirs ? mine! : !mine ? theirs : itemTime(mine) >= itemTime(theirs) ? mine : theirs;
      const contributions = mergeById([...(mine?.contributions || [])], [...(theirs?.contributions || [])], (item) => Date.parse(item.date) || 0)
        .sort((first, second) => first.date.localeCompare(second.date));
      return { ...base, contributions: contributions.length ? contributions : undefined };
    }).slice(0, 80);
  };
  const plannedEvents = mergePlannedEvents(local.settings.plannedEvents || [], remote.settings.plannedEvents || []).filter((item) => alive("plannedEvents", item.id, item.updatedAt));
  const syncDevices = mergeSyncDevices(local.settings.syncDevices || [], remote.settings.syncDevices || []);
  const { transactions, conflicts: txConflicts } = mergeTransactionsWithConflicts(
    local.transactions,
    remote.transactions,
    deleted,
    [...(local.transactionConflicts || []), ...(remote.transactionConflicts || [])],
    base,
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
      members,
      paymentSources,
      customCategories: Array.from(categorySet),
      quickTemplates: local.settings.quickTemplates,
      archivedQuickTemplates: local.settings.archivedQuickTemplates,
      savedJournalFilters: local.settings.savedJournalFilters,
      salaryCycleTemplates: local.settings.salaryCycleTemplates,
      // Cursurile se împart cu familia: soldul unei surse în euro trebuie să fie același pe ambele telefoane.
      exchangeRates: Array.from([...remote.settings.exchangeRates, ...local.settings.exchangeRates].reduce((all, item) => {
        const existing = all.get(item.currency);
        if (!existing || (Date.parse(item.updatedAt) || 0) >= (Date.parse(existing.updatedAt) || 0)) all.set(item.currency, item);
        return all;
      }, new Map<string, (typeof local.settings.exchangeRates)[number]>()).values()).filter((item) => alive("exchangeRates", item.currency, item.updatedAt)).slice(0, 12),
      seenWeeklyPlanTranches: local.settings.seenWeeklyPlanTranches,
      basketProducts: local.settings.basketProducts,
      merchantRules: local.settings.merchantRules || [],
      plannedEvents,
      syncDevices,
      salaryPlan,
      syncRecoveryIssuedAt: local.settings.syncRecoveryIssuedAt || remote.settings.syncRecoveryIssuedAt,
      // Cine folosește telefonul e o alegere locală; pachetul altui telefon nu o schimbă.
      selfMemberId: local.settings.selfMemberId,
      syncRoomMovedAt: undefined,
      // Fusul familiei: câștigă alegerea făcută mai recent de mână; altfel cel al camerei,
      // ca un telefon nou să preia ziua familiei, nu pe a lui.
      ...(() => {
        const localAt = Date.parse(local.settings.familyTimeZoneSetAt || "") || 0;
        const remoteAt = Date.parse(remote.settings.familyTimeZoneSetAt || "") || 0;
        const pick = localAt > remoteAt || !remote.settings.familyTimeZone ? local.settings : remote.settings;
        return { familyTimeZone: pick.familyTimeZone, familyTimeZoneSetAt: pick.familyTimeZoneSetAt };
      })(),
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
