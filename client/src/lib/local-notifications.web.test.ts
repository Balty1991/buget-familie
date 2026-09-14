/**
 * Pe PWA/Chrome (Huawei inclus), dialogul de permisiune poate întoarce
 * „default” deși utilizatorul a apăsat Permite. Activarea nu trebuie să
 * rămână pe Oprit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyAppData } from "./finance-data";

let store: Record<string, string> = {};
let permission = "default";
let requestImpl: () => Promise<string>;
const shown: Array<{ title: string; body: string }> = [];

class FakeNotification {
  static get permission() {
    return permission;
  }
  static requestPermission() {
    return requestImpl();
  }
  constructor(title: string, options: { body: string }) {
    shown.push({ title, body: options.body });
  }
}

const stubWeb = () => {
  store = {};
  permission = "default";
  shown.length = 0;
  requestImpl = async () => "default";
  const localStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
  };
  Object.assign(globalThis, {
    window: {
      localStorage,
      Notification: FakeNotification,
      setTimeout: (...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
    document: {
      documentElement: { classList: { contains: () => false } },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
    Notification: FakeNotification,
  });
  try {
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
  } catch {
    /* navigator e read-only în jsdom; Permissions API lipsește oricum */
  }
};

beforeEach(() => {
  vi.resetModules();
  stubWeb();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "document");
  Reflect.deleteProperty(globalThis, "navigator");
  Reflect.deleteProperty(globalThis, "Notification");
  vi.useRealTimers();
});

describe("activarea reamintirilor pe web/PWA", () => {
  it("folosește rezultatul lui requestPermission chiar dacă Notification.permission e încă default", async () => {
    requestImpl = async () => {
      permission = "default";
      return "granted";
    };
    const { enableLocalAlerts, isNotificationsEnabled, getNotificationPermission } = await import("./local-notifications");
    const status = await enableLocalAlerts(createEmptyAppData());
    expect(status).toBe("granted");
    expect(isNotificationsEnabled()).toBe(true);
    expect(await getNotificationPermission()).not.toBe("denied");
  });

  it("prinde grant-ul întârziat după un dialog care s-a rezolvat pe default", async () => {
    vi.useFakeTimers();
    requestImpl = () =>
      new Promise((resolve) => {
        window.setTimeout(() => {
          permission = "granted";
          resolve("default");
        }, 80);
      });
    const { requestNotificationPermission } = await import("./local-notifications");
    const pending = requestNotificationPermission();
    await vi.advanceTimersByTimeAsync(500);
    await expect(pending).resolves.toBe("granted");
  });

  it("un Permite care rămâne unknown nu marchează alertele ca oprite", async () => {
    vi.useFakeTimers();
    requestImpl = () => new Promise(() => { /* Huawei: promise-ul nu se rezolvă niciodată */ });
    const { enableLocalAlerts, isNotificationsEnabled, isNotificationsArmed } = await import("./local-notifications");
    const pending = enableLocalAlerts(createEmptyAppData());
    await vi.advanceTimersByTimeAsync(4500);
    await expect(pending).resolves.toBe("unknown");
    expect(isNotificationsEnabled()).toBe(true);
    expect(isNotificationsArmed()).toBe(true);
  });

  it("nu lasă butonul blocat: un requestPermission care atârnă se închide în câteva secunde", async () => {
    vi.useFakeTimers();
    requestImpl = () => new Promise(() => undefined);
    const { requestNotificationPermission } = await import("./local-notifications");
    const pending = requestNotificationPermission();
    await vi.advanceTimersByTimeAsync(4500);
    await expect(pending).resolves.toBe("unknown");
  });

  it("un refuz explicit oprește preferința", async () => {
    requestImpl = async () => {
      permission = "denied";
      return "denied";
    };
    const { enableLocalAlerts, isNotificationsEnabled } = await import("./local-notifications");
    const status = await enableLocalAlerts(createEmptyAppData());
    expect(status).toBe("denied");
    expect(isNotificationsEnabled()).toBe(false);
  });
});
