/**
 * Motorul de trimitere al sincronizării, fără React și fără Firebase (dev D16).
 *
 * `pushWithRetry` face exact ce făcea efectul din useFamilySync: citește camera, unește
 * copia partenerului cu cea locală, criptează și scrie cu precondiție (IV-ul citit). Dacă
 * partenerul a scris între timp (conflict), reia de cel mult `maxAttempts` ori. Dependențele
 * vin din afară, deci scenariile (conflict, cameră mutată, eșec) se testează direct.
 */
import type { AppData } from "@/lib/finance-data";

export type SyncEnvelopeLike = { iv: string; ciphertext: string };

export type PushDeps<E extends SyncEnvelopeLike> = {
  /** Starea locală de acum (poate avansa între încercări). */
  current: () => AppData;
  fetch: () => Promise<E | null>;
  decrypt: (envelope: E) => Promise<AppData>;
  merge: (local: AppData, remote: AppData) => AppData;
  encrypt: (data: AppData) => Promise<E>;
  /** Scrie doar dacă documentul are încă IV-ul citit (`null` = nu exista). */
  write: (envelope: E, expectedIv: string | null) => Promise<void>;
  isConflict: (error: unknown) => boolean;
  /** Pachetul camerei a fost citit și unit: strămoșul comun și starea afișată se actualizează. */
  onRemoteMerged?: (remote: AppData, merged: AppData, remoteIv: string) => void;
};

export type PushResult = { status: "pushed"; data: AppData; iv: string; size: number } | { status: "moved" };

export async function pushWithRetry<E extends SyncEnvelopeLike>(deps: PushDeps<E>, maxAttempts = 3): Promise<PushResult> {
  for (let attempt = 1; ; attempt += 1) {
    const remoteEnvelope = await deps.fetch();
    let toPush = deps.current();
    if (remoteEnvelope) {
      const remote = await deps.decrypt(remoteEnvelope);
      if (remote.settings.syncRoomMovedAt) return { status: "moved" };
      toPush = deps.merge(toPush, remote);
      deps.onRemoteMerged?.(remote, toPush, remoteEnvelope.iv);
    }
    const envelope = await deps.encrypt(toPush);
    try {
      await deps.write(envelope, remoteEnvelope?.iv ?? null);
      return { status: "pushed", data: toPush, iv: envelope.iv, size: envelope.ciphertext.length };
    } catch (error) {
      if (attempt >= maxAttempts || !deps.isConflict(error)) throw error;
    }
  }
}

/** Reîncercarea după un eșec: 5 s, 30 s, apoi la 2 minute. */
export const retryDelay = (failures: number) => [5_000, 30_000, 120_000][Math.min(Math.max(0, failures), 2)];

/**
 * Starea de pus pe ecran după ce a sosit pachetul unit. Dacă omul a notat ceva cât se
 * decripta pachetul (starea curentă nu mai e instantaneul unit), unim în 3 căi: ce s-a
 * schimbat de la instantaneu rămâne, ce aduce pachetul unit se adaugă. Altfel cheltuiala
 * dispărea tăcut.
 */
export const keepConcurrentEdits = <T>(current: T, snapshot: T | undefined, merged: T, merge3: (current: T, merged: T, snapshot: T) => T): T =>
  !snapshot || current === snapshot || current === merged ? merged : merge3(current, merged, snapshot);
