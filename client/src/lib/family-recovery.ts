/**
 * Cod de recuperare a parolei de familie.
 *
 * Nu e resetare pe email: serverul tot nu vede parola în clar. Codul e un al doilea
 * secret, arătat o dată, din care se decriptează parola. Fără el (și fără backup
 * sau registru local), camera rămâne încuiată — ăsta e prețul criptării pe telefon.
 */
import { decryptText, encryptText, type EncryptedEnvelope } from "@/lib/family-crypto";

const LOOKUP_PREFIX = "buget-familie-recovery:";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRecoveryCode(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}-${group()}`;
}

/** Ignoră spații, cratime și minuscule — ca să poți scrie codul cum l-ai notat. */
export function normalizeRecoveryCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatRecoveryCode(raw: string): string {
  const compact = normalizeRecoveryCode(raw);
  return compact.replace(/(.{4})(?=.)/g, "$1-").slice(0, 19);
}

export async function deriveRecoveryLookupId(code: string): Promise<string> {
  const compact = normalizeRecoveryCode(code);
  if (compact.length < 16) throw new Error("Codul de recuperare e prea scurt.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${LOOKUP_PREFIX}${compact}`));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function wrapFamilyPassword(password: string, recoveryCode: string): Promise<EncryptedEnvelope> {
  return encryptText(password, normalizeRecoveryCode(recoveryCode));
}

export async function unwrapFamilyPassword(envelope: EncryptedEnvelope, recoveryCode: string): Promise<string> {
  return decryptText(envelope, normalizeRecoveryCode(recoveryCode));
}
