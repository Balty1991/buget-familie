import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  },
});

import {
  familieTrialActive,
  gateSecondPhone,
  gateWeeklyShare,
  readWeeklyShares,
} from "./launch-offer";

beforeEach(() => {
  store.clear();
});

describe("oferta de lansare", () => {
  it("nu numără și nu blochează cât billing-ul e oprit", () => {
    expect(gateWeeklyShare({ billingLive: false, hasPaidFamilie: false })).toBe("allow");
    expect(gateWeeklyShare({ billingLive: false, hasPaidFamilie: false })).toBe("allow");
    expect(readWeeklyShares()).toBe(0);
    expect(familieTrialActive()).toBe(false);
    expect(gateSecondPhone({ billingLive: false, hasPaidFamilie: false })).toBe("allow");
  });

  it("primul bilanț e gratuit, al doilea pornește proba, după expirare se oprește", () => {
    const start = Date.parse("2026-10-06T10:00:00Z");
    expect(gateWeeklyShare({ billingLive: true, hasPaidFamilie: false }, start)).toBe("allow");
    expect(familieTrialActive(start)).toBe(false);
    expect(gateWeeklyShare({ billingLive: true, hasPaidFamilie: false }, start + 1000)).toBe("allow");
    expect(familieTrialActive(start + 1000)).toBe(true);
    const after = start + 31 * 24 * 60 * 60 * 1000;
    expect(familieTrialActive(after)).toBe(false);
    expect(gateWeeklyShare({ billingLive: true, hasPaidFamilie: false }, after)).toBe("blocked");
  });

  it("abonamentul plătit nu cere probă", () => {
    expect(gateWeeklyShare({ billingLive: true, hasPaidFamilie: true })).toBe("allow");
    expect(familieTrialActive()).toBe(false);
    expect(gateSecondPhone({ billingLive: true, hasPaidFamilie: true })).toBe("allow");
  });

  it("invitația către al doilea telefon pornește proba la apăsare", () => {
    const start = Date.parse("2026-10-06T10:00:00Z");
    expect(gateSecondPhone({ billingLive: true, hasPaidFamilie: false }, start)).toBe("allow");
    expect(familieTrialActive(start + 1000)).toBe(true);
    const after = start + 31 * 24 * 60 * 60 * 1000;
    expect(gateSecondPhone({ billingLive: true, hasPaidFamilie: false }, after)).toBe("blocked");
  });

  it("după proba pornită de invitație, bilanțul nu mai trece gratis", () => {
    const start = Date.parse("2026-10-06T10:00:00Z");
    gateSecondPhone({ billingLive: true, hasPaidFamilie: false }, start);
    const after = start + 31 * 24 * 60 * 60 * 1000;
    expect(gateWeeklyShare({ billingLive: true, hasPaidFamilie: false }, after)).toBe("blocked");
    expect(readWeeklyShares()).toBe(0);
  });
});
