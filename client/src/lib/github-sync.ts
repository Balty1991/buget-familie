/**
 * Atelierul Financiar — criptare locală și sincronizare explicită cu repo GitHub privat.
 * Tokenul nu se persistă; aplicația trimite doar un pachet AES-GCM deja criptat.
 */
import { normalizeAppData, type AllocationHistoryEntry, type AppData, type DeletedRecord } from "@/lib/finance-data";

export type EncryptedEnvelope = {
  version: 1;
  createdAt: string;
  salt: string;
  iv: string;
  ciphertext: string;
};

export type RemotePackage = { envelope: EncryptedEnvelope; sha: string; createdAt?: string };
export type GitHubSyncIssueKind = "conflict" | "rate-limit" | "temporary" | "access";

export class GitHubSyncError extends Error {
  constructor(public readonly kind: GitHubSyncIssueKind, message: string, public readonly retryAfterMs?: number) { super(message); }
}

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
    throw new Error("Codul familiei este greșit sau pachetul nu poate fi decriptat.");
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

function headers(token: string) {
  return { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" };
}

function endpoint(owner: string, repo: string, path: string) {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
}

const retryAfter = (response: Response) => {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(4_000, seconds * 1_000) : undefined;
};

const pause = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** Reîncearcă numai erorile trecătoare cât aplicația rămâne deschisă; conflictele cer reunire explicită. */
export async function retryGitHubOperation<T>(operation: () => Promise<T>, retries = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try { return await operation(); }
    catch (error) {
      const retryable = error instanceof GitHubSyncError ? error.kind === "temporary" || error.kind === "rate-limit" : error instanceof TypeError;
      if (!retryable || attempt >= retries) throw error;
      const delay = error instanceof GitHubSyncError && error.retryAfterMs ? error.retryAfterMs : 700 * 2 ** attempt;
      attempt += 1;
      await pause(delay);
    }
  }
}

function responseProblem(response: Response) {
  if (response.status === 409 || response.status === 422) return new GitHubSyncError("conflict", "O altă actualizare a ajuns pe GitHub. Reunim copiile înainte de a încerca din nou.");
  if (response.status === 429 || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")) return new GitHubSyncError("rate-limit", "GitHub a cerut o pauză scurtă înainte de următoarea actualizare.", retryAfter(response));
  if (response.status >= 500) return new GitHubSyncError("temporary", "GitHub este temporar indisponibil; mai încercăm cât aplicația rămâne deschisă.");
  return new GitHubSyncError("access", "GitHub nu a acceptat accesul. Verifică tokenul și repo-ul privat.");
}

export async function getRemotePackage({ token, owner, repo, path }: { token: string; owner: string; repo: string; path: string }): Promise<RemotePackage | null> {
  const response = await retryGitHubOperation(async () => {
    const result = await fetch(endpoint(owner, repo, path), { headers: headers(token) });
    if (result.status === 404 || result.ok) return result;
    throw responseProblem(result);
  });
  if (response.status === 404) return null;
  const payload = await response.json() as { content: string; sha: string };
  const json = decoder.decode(fromBase64(payload.content.replace(/\n/g, "")));
  return { envelope: JSON.parse(json) as EncryptedEnvelope, sha: payload.sha };
}

export async function saveRemotePackage({ token, owner, repo, path, envelope, sha }: { token: string; owner: string; repo: string; path: string; envelope: EncryptedEnvelope; sha?: string }) {
  const content = toBase64(encoder.encode(JSON.stringify(envelope)));
  const response = await retryGitHubOperation(async () => {
    const result = await fetch(endpoint(owner, repo, path), { method: "PUT", headers: headers(token), body: JSON.stringify({ message: `sync: actualizare criptată ${envelope.createdAt}`, content, ...(sha ? { sha } : {}) }) });
    if (result.ok) return result;
    throw responseProblem(result);
  });
  const payload = await response.json() as { content: { sha: string } };
  return payload.content.sha;
}
