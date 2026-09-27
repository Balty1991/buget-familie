/// <reference lib="webworker" />
/**
 * P2-9: criptarea, decomprimarea și normalizarea pachetului de sync, în afara firului
 * principal. Cu 5.000 de mișcări erau ~250 ms de blocaj la fiecare trimitere/primire.
 * Cheile derivate (PBKDF2) rămân în memoria worker-ului, pe sare, ca pe firul principal.
 */
import { decryptFamilyData, encryptFamilyData, type EncryptedEnvelope, type FamilySecret } from "@/lib/family-crypto";
import { normalizeAppData, type AppData } from "@/lib/finance-data";

type Request =
  | { id: number; op: "encrypt"; data: AppData; secret: FamilySecret }
  | { id: number; op: "decrypt"; envelope: EncryptedEnvelope; secret: FamilySecret };

self.onmessage = async (event: MessageEvent<Request>) => {
  const message = event.data;
  try {
    const result = message.op === "encrypt"
      ? await encryptFamilyData(message.data, message.secret)
      : normalizeAppData(await decryptFamilyData(message.envelope, message.secret));
    self.postMessage({ id: message.id, ok: true, result });
  } catch (error) {
    self.postMessage({ id: message.id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
