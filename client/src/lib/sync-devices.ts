/**
 * Telefoanele din camera de familie — listă în pachetul criptat (nu pe server în clar).
 *
 * Revocarea e un semnal între clienți onești: oprește sesiunea și refuză reconectarea
 * în aplicația oficială. Cine încă știe parola poate, cu un client modificat, să
 * rescrie pachetul — încuietoarea reală rămâne schimbarea parolei (cameră nouă).
 */
import { newId, type AppData, type SyncDevice } from "@/lib/finance-data";
import { safeSetItem } from "@/lib/safe-storage";

const DEVICE_KEY = "buget-familie:device-id";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined" || !window.localStorage) return newId("device");
  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = newId("device");
  safeSetItem(window.localStorage, DEVICE_KEY, id);
  return id;
}

export function defaultDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Telefon";
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad/i.test(ua)) return "iPhone";
  return "Acest telefon";
}

export function touchSyncDevice(data: AppData, label = defaultDeviceLabel()): AppData {
  const id = getOrCreateDeviceId();
  const now = new Date().toISOString();
  const devices = [...(data.settings.syncDevices || [])];
  const index = devices.findIndex((item) => item.id === id);
  const existing = index >= 0 ? devices[index] : undefined;
  // Un telefon revocat nu-și șterge singur semnul: altfel „Revocă” nu ar ține
  // decât până la următoarea conectare cu aceeași parolă.
  if (existing?.revokedAt) {
    devices[index] = { ...existing, label: label.slice(0, 48) };
  } else {
    const next: SyncDevice = { id, label: label.slice(0, 48), lastSeenAt: now, revokedAt: undefined };
    if (index >= 0) devices[index] = { ...existing, ...next };
    else devices.unshift(next);
  }
  return {
    ...data,
    settings: { ...data.settings, syncDevices: devices.slice(0, 20) },
  };
}

export function revokeSyncDevice(data: AppData, deviceId: string): AppData {
  const now = new Date().toISOString();
  return {
    ...data,
    settings: {
      ...data.settings,
      syncDevices: (data.settings.syncDevices || []).map((item) =>
        item.id === deviceId ? { ...item, revokedAt: now, lastSeenAt: now } : item,
      ),
    },
  };
}

export function restoreSyncDevice(data: AppData, deviceId: string): AppData {
  const now = new Date().toISOString();
  return {
    ...data,
    settings: {
      ...data.settings,
      syncDevices: (data.settings.syncDevices || []).map((item) =>
        item.id === deviceId ? { ...item, revokedAt: undefined, lastSeenAt: now } : item,
      ),
    },
  };
}

export function isThisDeviceRevoked(data: AppData): boolean {
  const id = typeof window !== "undefined" ? window.localStorage?.getItem(DEVICE_KEY) : null;
  if (!id) return false;
  const mine = (data.settings.syncDevices || []).find((item) => item.id === id);
  return Boolean(mine?.revokedAt);
}

export function listActiveSyncDevices(data: AppData): SyncDevice[] {
  return listSyncDevices(data).filter((item) => !item.revokedAt);
}

/** Toate telefoanele, activele primele, apoi cele revocate. */
export function listSyncDevices(data: AppData): SyncDevice[] {
  return [...(data.settings.syncDevices || [])].sort((a, b) => {
    const revoked = Number(Boolean(a.revokedAt)) - Number(Boolean(b.revokedAt));
    if (revoked !== 0) return revoked;
    return b.lastSeenAt.localeCompare(a.lastSeenAt);
  });
}
