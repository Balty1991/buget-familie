/**
 * Clientul worker-ului de sync (P2-9). Dacă worker-ul nu pornește (browser vechi, teste,
 * CSP), aceleași funcții rulează pe firul principal: rezultatul e identic, doar mai lent.
 * O eroare de conținut (parolă greșită, pachet prea mare) vine înapoi ca eroare normală.
 */
import type { EncryptedEnvelope, FamilySecret } from "@/lib/family-crypto";
import { normalizeAppData, type AppData } from "@/lib/finance-data";

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };
let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    if (typeof Worker === "undefined" || import.meta.env.MODE === "test") { worker = null; return worker; }
    worker = new Worker(new URL("./sync.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      if (event.data.ok) entry.resolve(event.data.result);
      else entry.reject(new Error(event.data.error || "Sincronizarea a eșuat."));
    };
    worker.onerror = () => {
      // Worker-ul a căzut: cererile în curs trec pe firul principal, iar cele noi la fel.
      pending.forEach((entry) => entry.reject(new WorkerUnavailable()));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

class WorkerUnavailable extends Error {}

function call<T>(message: Record<string, unknown>): Promise<T> {
  const target = getWorker();
  if (!target) return Promise.reject(new WorkerUnavailable());
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    try {
      target.postMessage({ ...message, id });
    } catch {
      pending.delete(id);
      reject(new WorkerUnavailable());
    }
  });
}

export async function encryptInWorker(data: AppData, secret: FamilySecret): Promise<EncryptedEnvelope> {
  try {
    return await call<EncryptedEnvelope>({ op: "encrypt", data, secret });
  } catch (error) {
    if (!(error instanceof WorkerUnavailable)) throw error;
    const crypto = await import("@/lib/family-crypto");
    return crypto.encryptFamilyData(data, secret);
  }
}

/** Decriptează și normalizează pachetul camerei. */
export async function decryptInWorker(envelope: EncryptedEnvelope, secret: FamilySecret): Promise<AppData> {
  try {
    return await call<AppData>({ op: "decrypt", envelope, secret });
  } catch (error) {
    if (!(error instanceof WorkerUnavailable)) throw error;
    const crypto = await import("@/lib/family-crypto");
    return normalizeAppData(await crypto.decryptFamilyData(envelope, secret));
  }
}
