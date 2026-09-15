import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deferredStylesDelayMs,
  deferredStylesStateForTests,
  ensureDeferredStyles,
  resetRamHygieneForTests,
  setDeferredStyleLoaderForTests,
  shouldRegisterServiceWorker,
} from "./ram-hygiene";

afterEach(() => {
  resetRamHygieneForTests();
  vi.restoreAllMocks();
});

describe("igienă RAM", () => {
  it("nu înregistrează service worker pe Android sau iOS, doar PWA de producție", () => {
    expect(shouldRegisterServiceWorker(true, "android")).toBe(false);
    expect(shouldRegisterServiceWorker(true, "ios")).toBe(false);
    expect(shouldRegisterServiceWorker(true, "web")).toBe(true);
    expect(shouldRegisterServiceWorker(false, "web")).toBe(false);
  });

  it("amână foile atelier mai mult pe telefon decât în browser", () => {
    expect(deferredStylesDelayMs("android")).toBeGreaterThanOrEqual(10000);
    expect(deferredStylesDelayMs("web")).toBeLessThan(deferredStylesDelayMs("android"));
  });

  it("încarcă foile atelier o singură dată", async () => {
    const loader = vi.fn(async () => undefined);
    setDeferredStyleLoaderForTests(loader);
    await Promise.all([ensureDeferredStyles(), ensureDeferredStyles()]);
    await ensureDeferredStyles();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(deferredStylesStateForTests()).toEqual({ started: true, done: true });
  });

  it("reîncearcă dacă încărcarea eșuează", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    setDeferredStyleLoaderForTests(loader);
    await ensureDeferredStyles();
    expect(deferredStylesStateForTests().started).toBe(false);
    await ensureDeferredStyles();
    expect(loader).toHaveBeenCalledTimes(2);
    expect(deferredStylesStateForTests().done).toBe(true);
  });
});
