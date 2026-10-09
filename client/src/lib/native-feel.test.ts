import { afterEach, describe, expect, it, vi } from "vitest";
import { haptic } from "./native-feel";

describe("vibrația în browser", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const setup = () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { ...globalThis.navigator, vibrate });
    vi.stubGlobal("window", { ...globalThis.window, matchMedia: () => ({ matches: false }) });
    return vibrate;
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("nu bâzâie la schimbarea ecranului", async () => {
    const vibrate = setup();
    haptic("tick");
    await flush();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("vibrează scurt la salvare și la ștergere", async () => {
    const vibrate = setup();
    haptic("confirm");
    haptic("reject");
    await flush();
    expect(vibrate).toHaveBeenCalledWith(14);
    expect(vibrate).toHaveBeenCalledWith([10, 40, 10]);
  });
});
