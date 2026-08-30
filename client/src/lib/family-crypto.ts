/**
 * Atelierul Financiar — criptare locală a registrului de familie și unirea a două copii.
 * Parola nu se persistă; doar un pachet AES-GCM deja criptat părăsește telefonul.
 */
import { normalizeAppData, type AllocationHistoryEntry, type AppData, type DeletedRecord } from "@/lib/finance-data";

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
  const shareable = { ...data, receipts: data.receipts.map(({ imageData: _one, imageData2: _two, imageKeys: _keys, ...receipt }) => receipt), settings: { ...data.settings, quickTemplates: [], archivedQuickTemplates: [], savedJournalFilters: [], salaryCycleTemplates: [], seenWeeklyPlanTranches: [] } };
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
  return Array.from(all.values()).filter((item) => (Date.parse(tombstones.get(item.id)?.deletedAt || "") || 0) < timestamp(item));
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
  const salaryPlanBase = timestamp(local.settings.salaryPlan) >= timestamp(remote.settings.salaryPlan) ? local.settings.salaryPlan : remote.settings.salaryPlan;
  const allocationHistory: AllocationHistoryEntry[] = [...(remote.settings.salaryPlan.allocationHistory || []), ...(local.settings.salaryPlan.allocationHistory || [])].reduce<AllocationHistoryEntry[]>((all, item) => all.some((entry) => entry.id === item.id) ? all : [...all, item], []).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)).slice(0, 400);
  const salaryPlan = { ...salaryPlanBase, allocationHistory };
  return normalizeAppData({ version: 8, transactions: mergeCollection("transactions", local.transactions, remote.transactions, deleted), debts: mergeCollection("debts", local.debts, remote.debts, deleted), savings: mergeCollection("savings", local.savings, remote.savings, deleted), receipts: mergeCollection("receipts", local.receipts.map(({ imageData: _one, imageData2: _two, imageKeys: _keys, ...item }) => item), remote.receipts, deleted), recurring: mergeCollection("recurring", local.recurring, remote.recurring, deleted), deleted, settings: { ...remote.settings, ...local.settings, familyName: local.settings.familyName || remote.settings.familyName, memberName: local.settings.memberName, familyCode: local.settings.familyCode || remote.settings.familyCode, members: Array.from(memberMap.values()), paymentSources: Array.from(sourceMap.values()), customCategories: Array.from(categorySet), quickTemplates: local.settings.quickTemplates, archivedQuickTemplates: local.settings.archivedQuickTemplates, savedJournalFilters: local.settings.savedJournalFilters, salaryCycleTemplates: local.settings.salaryCycleTemplates, seenWeeklyPlanTranches: local.settings.seenWeeklyPlanTranches, salaryPlan } });
}

/** Transformă parola de familie într-un identificator de cameră, fără a expune parola. */
export async function deriveFamilyRoomId(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`buget-familie-room:${secret}`));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
