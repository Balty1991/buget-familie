import { afterEach, describe, expect, it, vi } from "vitest";
import { genitiveName, memberModeWaitSeconds, setMemberModePin, verifyMemberModePin } from "./member-mode";

const store = new Map<string, string>();
vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }, dispatchEvent: () => true });

describe("telefonul unui membru", () => {
  afterEach(() => store.clear());
  it("genitivul corect: Anei, Mariei, lui Andrei", () => {
    expect(genitiveName("Ana")).toBe("Anei");
    expect(genitiveName("Maria")).toBe("Mariei");
    expect(genitiveName("Andrei")).toBe("lui Andrei");
  });
  it("codul de ieșire: bun trece, greșit nu; după 5 greșeli trebuie așteptat", async () => {
    await setMemberModePin("1234");
    expect(await verifyMemberModePin("1234")).toBe(true);
    for (let i = 0; i < 5; i += 1) expect(await verifyMemberModePin("0000")).toBe(false);
    expect(memberModeWaitSeconds()).toBeGreaterThan(0);
    expect(await verifyMemberModePin("1234")).toBe(false);
  });
});
