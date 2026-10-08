import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyAppData, type Transaction } from "./finance-data";
import { AUTO_BACKUP_KEY } from "./auto-backup";

const tx = (id: string, date: string): Transaction => ({ id, title: "Lidl", amount: 20, kind: "expense", category: "Alimente", source: "Card", person: "Eu", date });

describe("reamintirea copiei de siguranță", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key) };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", { localStorage: storage });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T09:00:00"));
    localStorage.removeItem(AUTO_BACKUP_KEY);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("vine duminică seara când nu există nicio copie după o lună de notat", async () => {
    const { buildLocalAlerts } = await import("./local-notifications");
    const data = createEmptyAppData();
    data.transactions = [tx("a", "2026-08-20"), tx("b", "2026-10-07")];
    const backup = buildLocalAlerts(data).find((item) => item.tag.startsWith("backup-"));
    expect(backup?.title).toBe("Fă o copie de siguranță");
    expect(new Date(backup!.at).getDay()).toBe(0);
  });

  it("tace când copia e recentă sau când familia notează de puțin timp", async () => {
    const { buildLocalAlerts } = await import("./local-notifications");
    const data = createEmptyAppData();
    data.transactions = [tx("a", "2026-08-20")];
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify({ enabled: false, asked: true, lastAt: "2026-10-01T10:00:00Z" }));
    expect(buildLocalAlerts(data).some((item) => item.tag.startsWith("backup-"))).toBe(false);
    localStorage.removeItem(AUTO_BACKUP_KEY);
    data.transactions = [tx("a", "2026-10-01")];
    expect(buildLocalAlerts(data).some((item) => item.tag.startsWith("backup-"))).toBe(false);
  });
});
