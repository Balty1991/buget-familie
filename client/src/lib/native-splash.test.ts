import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hideNativeSplash, onAppRevealed, resetNativeSplashForTests } from "./native-splash";

type BootNode = { attrs: Set<string>; setAttribute: (name: string, value?: string) => void; hasAttribute: (name: string) => boolean };

function stubDocument(options?: { card?: boolean; appbarHidden?: boolean }) {
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
  const appbar = {
    classList: { contains: (name: string) => name === "os-appbar" },
    getBoundingClientRect: () => (
      options?.appbarHidden ? { height: 0, width: 0 } : { height: 64, width: 360 }
    ),
  };
  const nodes = [appbar, firstRun].filter(Boolean);
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

  it("nu ascunde puntea până există un cadru real, apoi overlay-ul HTML după 2 cadre", () => {
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

    flushFrames(frames, 2);
    expect(hide).toHaveBeenCalledTimes(1);
    expect(setChrome).toHaveBeenCalledTimes(1);
    expect(persistTheme).toHaveBeenCalledTimes(1);
    expect(classes.has("bf-ready")).toBe(false);
    expect(boot.hasAttribute("hidden")).toBe(false);

    flushFrames(frames, 2);
    expect(classes.has("bf-ready")).toBe(true);
    expect(boot.hasAttribute("hidden")).toBe(true);
  });

  it("așteaptă cardul First Run, nu rAF gol", () => {
    stubDocument({ card: false, appbarHidden: true });
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

  it("ignoră antetul display:none din First Run și așteaptă cardul", () => {
    stubDocument({ appbarHidden: true });
    const hide = vi.fn();
    vi.stubGlobal("window", { BugetFamilieSplash: { hide } });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });

    hideNativeSplash();
    flushFrames(frames, 2);
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
    flushFrames(frames, 2);
    expect(later).not.toHaveBeenCalled();
    flushFrames(frames, 2);
    expect(later).toHaveBeenCalledTimes(1);
  });
});
