import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hideNativeSplash, onAppRevealed, resetNativeSplashForTests } from "./native-splash";

type BootNode = { attrs: Set<string>; setAttribute: (name: string, value?: string) => void; hasAttribute: (name: string) => boolean };

function stubDocument(options?: { card?: boolean; hero?: boolean; appbarHidden?: boolean }) {
  const classes = new Set<string>();
  const boot: BootNode = {
    attrs: new Set<string>(),
    setAttribute(name: string) {
      this.attrs.add(name);
    },
    hasAttribute(name: string) {
      return this.attrs.has(name);
    },
  };
  const firstRun = options?.card === false
    ? null
    : {
        classList: { contains: (name: string) => name === "bf-first-run" },
        getBoundingClientRect: () => ({ height: 640, width: 360 }),
      };
  const hero = options?.hero
    ? {
        classList: { contains: (name: string) => name === "os-hero" },
        getBoundingClientRect: () => ({ height: 280, width: 360 }),
      }
    : null;
  const appbar = {
    classList: { contains: (name: string) => name === "os-appbar" },
    getBoundingClientRect: () => (
      options?.appbarHidden !== false && !options?.hero && options?.card === false
        ? { height: 0, width: 0 }
        : options?.card === false && !options?.hero
          ? { height: 0, width: 0 }
          : { height: 0, width: 0 }
    ),
  };
  const nodes = [firstRun, hero, appbar].filter(Boolean);
  vi.stubGlobal("getComputedStyle", (el: { classList?: { contains: (n: string) => boolean } }) => ({
    display: el.classList?.contains("os-appbar") ? "none" : "block",
    visibility: "visible",
  }));
  vi.stubGlobal("document", {
    documentElement: {
      classList: {
        add: (name: string) => classes.add(name),
        remove: (name: string) => classes.delete(name),
        contains: (name: string) => classes.has(name),
      },
    },
    getElementById: (id: string) => (id === "bf-boot" ? boot : null),
    querySelector: () => nodes[0] ?? null,
    querySelectorAll: () => nodes,
  });
  return { classes, boot };
}

function flushFrames(frames: FrameRequestCallback[], count: number) {
  for (let i = 0; i < count; i += 1) {
    const cb = frames.shift();
    if (!cb) throw new Error(`expected frame ${i + 1}`);
    cb(i * 16);
  }
}

afterEach(() => {
  resetNativeSplashForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("splash nativ", () => {
  beforeEach(() => {
    resetNativeSplashForTests();
  });

  it("scoate puntea nativă imediat și overlay-ul HTML după 1 cadru real", () => {
    const { classes, boot } = stubDocument();
    const hide = vi.fn();
    const setChrome = vi.fn();
    const persistTheme = vi.fn();
    vi.stubGlobal("window", { BugetFamilieSplash: { hide, setChrome, persistTheme } });

    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });

    hideNativeSplash();
    hideNativeSplash();
    expect(hide).toHaveBeenCalled();
    expect(classes.has("bf-ready")).toBe(false);
    expect(boot.hasAttribute("hidden")).toBe(false);

    flushFrames(frames, 1);
    expect(setChrome).toHaveBeenCalledTimes(1);
    expect(persistTheme).toHaveBeenCalledTimes(1);
    expect(classes.has("bf-ready")).toBe(false);

    flushFrames(frames, 1);
    expect(classes.has("bf-ready")).toBe(true);
    expect(boot.hasAttribute("hidden")).toBe(true);
  });

  it("ține overlay-ul HTML dacă nu există card, chiar dacă puntea nativă a plecat", () => {
    const { boot } = stubDocument({ card: false });
    const hide = vi.fn();
    vi.stubGlobal("window", { BugetFamilieSplash: { hide } });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });

    hideNativeSplash();
    expect(hide).toHaveBeenCalled();
    flushFrames(frames, 4);
    expect(boot.hasAttribute("hidden")).toBe(false);
  });

  it("acceptă hero-ul Astăzi ca prim cadru", () => {
    const { boot, classes } = stubDocument({ card: false, hero: true });
    const hide = vi.fn();
    vi.stubGlobal("window", { BugetFamilieSplash: { hide } });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });

    hideNativeSplash();
    expect(hide).toHaveBeenCalled();
    flushFrames(frames, 2);
    expect(classes.has("bf-ready")).toBe(true);
    expect(boot.hasAttribute("hidden")).toBe(true);
  });

  it("pornește foile amânate abia după reveal", () => {
    stubDocument();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    const later = vi.fn();
    onAppRevealed(later);
    expect(later).not.toHaveBeenCalled();
    hideNativeSplash();
    flushFrames(frames, 1);
    expect(later).not.toHaveBeenCalled();
    flushFrames(frames, 1);
    expect(later).toHaveBeenCalledTimes(1);
  });
});
