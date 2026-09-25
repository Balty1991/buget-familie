import { describe, expect, it } from "vitest";
import { autoBackupDue, autoBackupName, autoBackupWorthAsking } from "./auto-backup";

describe("copia de siguranță săptămânală", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  it("e timpul doar când e pornită și au trecut 7 zile", () => {
    expect(autoBackupDue({ enabled: false, asked: true }, now)).toBe(false);
    expect(autoBackupDue({ enabled: true, asked: true }, now)).toBe(true);
    expect(autoBackupDue({ enabled: true, asked: true, lastAt: "2026-10-05T12:00:00Z" }, now)).toBe(false);
    expect(autoBackupDue({ enabled: true, asked: true, lastAt: "2026-10-03T12:00:00Z" }, now)).toBe(true);
  });
  it("întreabă o singură dată și doar când sunt date de pierdut", () => {
    expect(autoBackupWorthAsking({ enabled: false, asked: false }, 3)).toBe(false);
    expect(autoBackupWorthAsking({ enabled: false, asked: false }, 12)).toBe(true);
    expect(autoBackupWorthAsking({ enabled: false, asked: true }, 12)).toBe(false);
  });
  it("fișierul are data în nume", () => {
    expect(autoBackupName(new Date(2026, 9, 10, 12))).toBe("buget-familie-copie-2026-10-10.json");
  });
});

describe("copia automată cu ceasul greșit (BF-17)", () => {
  it("o dată din viitor sau ilizibilă cere copie", () => {
    const now = Date.parse("2026-09-25T10:00:00Z");
    expect(autoBackupDue({ enabled: true, asked: true, lastAt: "2027-03-01T10:00:00Z" }, now)).toBe(true);
    expect(autoBackupDue({ enabled: true, asked: true, lastAt: "ieri" }, now)).toBe(true);
    expect(autoBackupDue({ enabled: true, asked: true, lastAt: "2026-09-24T10:00:00Z" }, now)).toBe(false);
  });
});
