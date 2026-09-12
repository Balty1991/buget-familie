/**
 * Telefoanele din camera de familie — listă în pachetul criptat (nu pe server în clar).
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
  const next: SyncDevice = { id, label: label.slice(0, 48), lastSeenAt: now, revokedAt: undefined };
  if (index >= 0) devices[index] = { ...devices[index], ...next, revokedAt: undefined };
  else devices.unshift(next);
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
        item.id === deviceId ? { ...item, revokedAt: now } : item,
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
  return (data.settings.syncDevices || [])
    .filter((item) => !item.revokedAt)
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}
