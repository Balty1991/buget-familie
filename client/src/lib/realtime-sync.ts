/**
 * Sincronizare în timp real a familiei, fără token generat de fiecare utilizator.
 * Toate telefoanele care instalează aplicația împart același proiect Firebase
 * (configurat o singură dată de administrator în firebase-config.ts); fiecare
 * familie primește propria "cameră" izolată, dedusă din parola ei de familie.
 * Firestore nu vede niciodată datele în clar — doar pachetul AES-GCM criptat local.
 */
import { initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";
import { doc, getDoc, getFirestore, onSnapshot, serverTimestamp, setDoc, type Firestore, type Unsubscribe } from "firebase/firestore";
import { appCheckDebug, firebaseConfig, isFirebaseConfigured, recaptchaSiteKey } from "@/lib/firebase-config";
import type { EncryptedEnvelope } from "@/lib/family-crypto";
import { deriveFamilyRoomId } from "@/lib/family-crypto";

export { deriveFamilyRoomId };

export class RealtimeSyncError extends Error {
  constructor(public readonly kind: "not-configured" | "unavailable", message: string) { super(message); }
}

let app: FirebaseApp | undefined;
let firestore: Firestore | undefined;
let appCheck: AppCheck | undefined;

function ensureAppCheck(firebaseApp: FirebaseApp) {
  if (appCheck) return;
  if (!recaptchaSiteKey) return; // fără cheie: sync merge; Enforce NU trebuie activat în Console
  if (appCheckDebug && typeof self !== "undefined") {
    const existing = (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN;
    if (existing === undefined) {
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
  }
  appCheck = initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

function db(): Firestore {
  if (!isFirebaseConfigured) throw new RealtimeSyncError("not-configured", "Sincronizarea nu a fost încă configurată de administratorul aplicației.");
  if (!firestore) {
    app = app || initializeApp(firebaseConfig);
    ensureAppCheck(app);
    firestore = getFirestore(app);
  }
  return firestore;
}

const roomRef = (roomId: string) => doc(db(), "familySync", roomId);

export async function fetchFamilyEnvelope(roomId: string): Promise<EncryptedEnvelope | null> {
  try {
    const snapshot = await getDoc(roomRef(roomId));
    return snapshot.exists() ? (snapshot.data().envelope as EncryptedEnvelope) : null;
  } catch (error) {
    if (error instanceof RealtimeSyncError) throw error;
    throw new RealtimeSyncError("unavailable", "Serviciul de sincronizare este temporar indisponibil.");
  }
}

export async function pushFamilyEnvelope(roomId: string, envelope: EncryptedEnvelope): Promise<void> {
  try {
    await setDoc(roomRef(roomId), { envelope, updatedAt: serverTimestamp() });
  } catch (error) {
    if (error instanceof RealtimeSyncError) throw error;
    throw new RealtimeSyncError("unavailable", "Actualizarea nu a putut fi trimisă către serviciul de sincronizare.");
  }
}

/** Ascultă actualizări live ale familiei; ignoră ecoul propriei scrieri via `hasPendingWrites`. */
export function subscribeFamilyRoom(roomId: string, onEnvelope: (envelope: EncryptedEnvelope) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(roomRef(roomId), { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.hasPendingWrites || !snapshot.exists()) return;
    const envelope = snapshot.data().envelope as EncryptedEnvelope | undefined;
    if (envelope) onEnvelope(envelope);
  }, (error) => onError(error instanceof RealtimeSyncError ? error : new RealtimeSyncError("unavailable", "Conexiunea live cu serviciul de sincronizare a fost întreruptă.")));
}
