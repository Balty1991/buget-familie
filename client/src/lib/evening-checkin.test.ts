import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyAppData, type Transaction } from "./finance-data";

const tx = (patch: Partial<Transaction>): Transaction => ({
  id: "t",
  title: "Lidl",
  amount: 20,
  kind: "expense",
  category: "Alimente",
  source: "Card",
  person: "Eu",
  date: "2026-10-06",
  ...patch,
});

describe("amintirea de seară", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T07:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("îl întreabă pe cel care n-a notat, chiar dacă partenerul a notat", async () => {
    const { buildLocalAlerts } = await import("./local-notifications");
    const data = createEmptyAppData();
    data.settings.members = [
      { id: "member-me", name: "Andrei" },
      { id: "maria", name: "Maria" },
    ];
    data.settings.selfMemberId = "member-me";
    data.transactions = [tx({ memberId: "maria", person: "Maria" })];
    const checkin = buildLocalAlerts(data).find((item) => item.tag.startsWith("checkin-"));
    expect(checkin?.title).toBe("Tu n-ai notat azi");
    expect(checkin?.body).toContain("Maria");
    expect(checkin?.body).toContain("incompletă");
  });

  it("nu îl mai întreabă pe cel care a notat deja", async () => {
    const { buildLocalAlerts } = await import("./local-notifications");
    const data = createEmptyAppData();
    data.settings.members = [{ id: "member-me", name: "Andrei" }, { id: "maria", name: "Maria" }];
    data.settings.selfMemberId = "member-me";
    data.transactions = [tx({ memberId: "member-me", person: "Andrei" })];
    expect(buildLocalAlerts(data).some((item) => item.tag.startsWith("checkin"))).toBe(false);
  });
});
