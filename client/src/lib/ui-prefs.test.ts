import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasSeenEnvelopeGlossary,
  isOfflineOnly,
  isSimpleMode,
  markEnvelopeGlossarySeen,
  markOpeningBalanceAsked,
  setOfflineOnly,
  setSimpleMode,
  shouldAskOpeningBalance,
} from "./ui-prefs";

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
  };
};

describe("ui-prefs", () => {
  beforeEach(() => {
    const store = memory();
    vi.stubGlobal("window", {
      localStorage: store,
      dispatchEvent: () => true,
    });
  });

  it("simple mode toggles locally", () => {
    expect(isSimpleMode()).toBe(false);
    setSimpleMode(true);
    expect(isSimpleMode()).toBe(true);
    setSimpleMode(false);
    expect(isSimpleMode()).toBe(false);
  });

  it("offline-only toggles locally", () => {
    expect(isOfflineOnly()).toBe(false);
    setOfflineOnly(true);
    expect(isOfflineOnly()).toBe(true);
    setOfflineOnly(false);
    expect(isOfflineOnly()).toBe(false);
  });

  it("glossary and balance prompts are one-shot", () => {
    expect(hasSeenEnvelopeGlossary()).toBe(false);
    markEnvelopeGlossarySeen();
    expect(hasSeenEnvelopeGlossary()).toBe(true);
    expect(shouldAskOpeningBalance()).toBe(true);
    markOpeningBalanceAsked();
    expect(shouldAskOpeningBalance()).toBe(false);
  });
});
