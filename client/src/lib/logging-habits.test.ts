import { describe, expect, it } from "vitest";
import { loggingStreak, noSpendDays } from "./logging-habits";

const exp = (date: string) => ({ date, kind: "expense" });

describe("seria de notare", () => {
  it("numără zilele la rând până azi", () => {
    expect(loggingStreak([exp("2026-10-03"), exp("2026-10-04"), exp("2026-10-05"), exp("2026-10-05")], "2026-10-05")).toBe(3);
  });

  it("dacă azi încă nu e nimic, seria de ieri rămâne", () => {
    expect(loggingStreak([exp("2026-10-03"), exp("2026-10-04")], "2026-10-05")).toBe(2);
  });

  it("o zi lipsă rupe seria; corecturile de sold nu contează", () => {
    expect(loggingStreak([exp("2026-10-01"), exp("2026-10-03"), { date: "2026-10-02", kind: "expense", adjustment: true }], "2026-10-03")).toBe(1);
  });

  it("trece peste schimbarea lunii", () => {
    expect(loggingStreak([exp("2026-09-30"), exp("2026-10-01")], "2026-10-01")).toBe(2);
  });
});

describe("zile fără cheltuieli", () => {
  it("numără zilele de la 1 până ieri fără nicio cheltuială", () => {
    const items = [exp("2026-10-01"), exp("2026-10-03"), { date: "2026-10-02", kind: "income" }];
    expect(noSpendDays(items, "2026-10-06")).toBe(3); // 2, 4, 5
  });

  it("fără nimic notat luna asta, nu laudă o lună goală", () => {
    expect(noSpendDays([exp("2026-09-20")], "2026-10-06")).toBe(0);
  });
});
