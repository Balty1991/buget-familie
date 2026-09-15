import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hideNativeSplash, onAppRevealed, resetNativeSplashForTests } from "./native-splash";

type BootNode = { attrs: Set<string>; setAttribute: (name: string, value?: string) => void; hasAttribute: (name: string) => boolean };

function stubDocument(options?: { card?: boolean; hero?: boolean; transparentCard?: boolean }) {
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
        __bg: options?.transparentCard ? "rgba(0, 0, 0, 0)" : "rgb(247, 248, 246)",
      };
  const hero = options?.hero
    ? {
        classList: { contains: (name: string) => name === "os-hero" },
        getBoundingClientRect: () => ({ height: 280, width: 360 }),
        __bg: "rgb(247, 248, 246)",
      }
    : null;
  const nodes = [firstRun, hero].filter(Boolean) as Array<{ classList: { contains: (n: string) => boolean }; __bg?: string }>;
  vi.stubGlobal("getComputedStyle", (el: { classList?: { contains: (n: string) => boolean }; __bg?: string }) => ({
    display: "block",
    visibility: "visible",
    backgroundColor: el.__bg || "rgb(247, 248, 246)",
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

  it("nu ascunde puntea până există un cadru real, apoi overlay-ul HTML după 4 cadre", () => {
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
    expect(hide).not.toHaveBeenCalled();
    expect(classes.has("bf-ready")).toBe(false);

    flushFrames(frames, 3);
    expect(hide).toHaveBeenCalledTimes(1);
    expect(setChrome).toHaveBeenCalledTimes(1);
    expect(persistTheme).toHaveBeenCalledTimes(1);
    expect(classes.has("bf-ready")).toBe(false);
    expect(boot.hasAttribute("hidden")).toBe(false);

    flushFrames(frames, 4);
    expect(classes.has("bf-ready")).toBe(true);
    expect(boot.hasAttribute("hidden")).toBe(true);
  });

  it("așteaptă cardul First Run, nu rAF gol", () => {
    stubDocument({ card: false });
    const hide = vi.fn();
    vi.stubGlobal("window", { BugetFamilieSplash: { hide } });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });

    hideNativeSplash();
    flushFrames(frames, 4);
    expect(hide).not.toHaveBeenCalled();
  });

  it("nu dezvăluie First Run-ul transparent (CSS încă neîncărcat)", () => {
    stubDocument({ transparentCard: true });
    const hide = vi.fn();
    vi.stubGlobal("window", { BugetFamilieSplash: { hide } });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });

    hideNativeSplash();
    flushFrames(frames, 4);
    expect(hide).not.toHaveBeenCalled();
  });

  it("acceptă hero-ul Astăzi ca prim cadru, nu doar antetul", () => {
    stubDocument({ card: false, hero: true });
    const hide = vi.fn();
    vi.stubGlobal("window", { BugetFamilieSplash: { hide } });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });

    hideNativeSplash();
    flushFrames(frames, 3);
    expect(hide).toHaveBeenCalledTimes(1);
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
    flushFrames(frames, 3);
    expect(later).not.toHaveBeenCalled();
    flushFrames(frames, 4);
    expect(later).toHaveBeenCalledTimes(1);
  });
});
