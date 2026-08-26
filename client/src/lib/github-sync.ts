/**
 * Atelierul Financiar — criptare locală și sincronizare explicită cu repo GitHub privat.
 * Tokenul nu se persistă; aplicația trimite doar un pachet AES-GCM deja criptat.
 */
import type { AppData } from "@/lib/finance-data";

export type EncryptedEnvelope = {
  version: 1;
  createdAt: string;
  salt: string;
  iv: string;
  ciphertext: string;
};

export type RemotePackage = { envelope: EncryptedEnvelope; sha: string; createdAt?: string };

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
  const plain = encoder.encode(JSON.stringify(data));
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

function headers(token: string) {
  return { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" };
}

function endpoint(owner: string, repo: string, path: string) {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export async function getRemotePackage({ token, owner, repo, path }: { token: string; owner: string; repo: string; path: string }): Promise<RemotePackage | null> {
  const response = await fetch(endpoint(owner, repo, path), { headers: headers(token) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("GitHub nu a acceptat accesul. Verifică tokenul și repo-ul privat.");
  const payload = await response.json() as { content: string; sha: string };
  const json = decoder.decode(fromBase64(payload.content.replace(/\n/g, "")));
  return { envelope: JSON.parse(json) as EncryptedEnvelope, sha: payload.sha };
}

export async function saveRemotePackage({ token, owner, repo, path, envelope, sha }: { token: string; owner: string; repo: string; path: string; envelope: EncryptedEnvelope; sha?: string }) {
  const content = toBase64(encoder.encode(JSON.stringify(envelope)));
  const response = await fetch(endpoint(owner, repo, path), { method: "PUT", headers: headers(token), body: JSON.stringify({ message: `sync: actualizare criptată ${envelope.createdAt}`, content, ...(sha ? { sha } : {}) }) });
  if (response.status === 409 || response.status === 422) throw new Error("Există o versiune nouă pe GitHub. Descarcă înainte de a încărca sau confirmă suprascrierea.");
  if (!response.ok) throw new Error("GitHub nu a putut salva pachetul. Tokenul are nevoie de Contents: Read and write doar pentru acest repo.");
  const payload = await response.json() as { content: { sha: string } };
  return payload.content.sha;
}
