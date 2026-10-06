import { describe, expect, it } from "vitest";
import { createEmptyAppData, type Transaction } from "./finance-data";
import { otherPhoneHasLogged, partnersLoggedToday, partnersQuietToday, selfLoggedToday, stampLocalTransactions } from "./habit-hold";

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

describe("obiceiul de azi", () => {
  it("cere abonamentul doar după o mișcare de pe alt telefon", () => {
    const data = createEmptyAppData();
    data.transactions = [tx({ deviceId: "device-a" })];
    expect(otherPhoneHasLogged(data, "device-a")).toBe(false);
    expect(otherPhoneHasLogged(data, "device-b")).toBe(true);
    data.transactions = [tx({ id: "vechi" })];
    expect(otherPhoneHasLogged(data, "device-a")).toBe(false);
  });

  it("spune cine n-a notat azi, fără să certe copilul", () => {
    const data = createEmptyAppData();
    data.settings.members = [
      { id: "member-me", name: "Andrei" },
      { id: "maria", name: "Maria" },
      { id: "copil", name: "Iris", kind: "child" },
    ];
    data.settings.selfMemberId = "member-me";
    data.transactions = [tx({ memberId: "member-me", date: "2026-10-06" })];
    expect(partnersQuietToday(data, "2026-10-06")).toEqual(["Maria"]);
    data.transactions.push(tx({ id: "m", memberId: "maria", date: "2026-10-06" }));
    expect(partnersQuietToday(data, "2026-10-06")).toEqual([]);
  });

  it("ține minte cine a notat azi, ca amintirea să meargă la celălalt", () => {
    const data = createEmptyAppData();
    data.settings.members = [
      { id: "member-me", name: "Andrei" },
      { id: "maria", name: "Maria" },
    ];
    data.settings.selfMemberId = "member-me";
    data.transactions = [tx({ memberId: "maria", person: "Maria", date: "2026-10-06" })];
    expect(selfLoggedToday(data, "2026-10-06")).toBe(false);
    expect(partnersLoggedToday(data, "2026-10-06")).toEqual(["Maria"]);
    data.transactions.push(tx({ id: "eu", memberId: "member-me", date: "2026-10-06" }));
    expect(selfLoggedToday(data, "2026-10-06")).toBe(true);
  });

  it("pune telefonul doar pe mișcările noi", () => {
    const previous = createEmptyAppData();
    previous.transactions = [tx({ id: "vechi" })];
    const next = createEmptyAppData();
    next.transactions = [tx({ id: "vechi" }), tx({ id: "nou" }), tx({ id: "altul", deviceId: "device-b" })];
    const stamped = stampLocalTransactions(previous, next, "device-a");
    expect(stamped.transactions.map((item) => item.deviceId)).toEqual([undefined, "device-a", "device-b"]);
  });
});
