import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { downloadBackup, makeBackup, parseBackup } from "./app-storage";

const data = () => {
  const value = createEmptyAppData();
  value.settings.familyName = "Familia Test";
  value.transactions = [{ id: "tx-1", title: "Salariu", amount: 2500, kind: "income", category: "Venit", source: "Card", person: "Eu", date: "2026-09-01" }];
  return value;
};

afterEach(() => vi.unstubAllGlobals());

describe("backup Buget Familie", () => {
  it("creează un backup cu metadatele și datele aplicației", () => {
    const backup = makeBackup(data());
    expect(backup).toMatchObject({ kind: "buget-familie-backup", version: 1, data: { version: 8 } });
    expect(backup.exportedAt).toMatch(/^20\d\d-\d\d-\d\dT/);
    expect(backup.data.settings.familyName).toBe("Familia Test");
  });

  it("face round-trip export JSON → import fără pierderea datelor", () => {
    const original = data();
    const restored = parseBackup(JSON.stringify(makeBackup(original)));
    expect(restored.kind).toBe("buget-familie-backup");
    expect(restored.data).toEqual(original);
  });

  it("respinge JSON valid care nu este backup Buget Familie", () => {
    expect(() => parseBackup(JSON.stringify({ kind: "alt-format", version: 1, data: {} }))).toThrow("backup Buget Familie valid");
    expect(() => parseBackup(JSON.stringify({ kind: "buget-familie-backup", version: 99, data: {} }))).toThrow("backup Buget Familie valid");
    expect(() => parseBackup("nu este JSON")).toThrow();
  });

  it("descarcă backupul ca JSON cu nume de fișier datat", () => {
    const click = vi.fn();
    const anchor = { href: "", download: "", click };
    vi.stubGlobal("document", { createElement: vi.fn(() => anchor) });
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });

    downloadBackup(data());

    expect(anchor.download).toMatch(/^buget-familie-backup-20\d\d-\d\d-\d\d\.json$/);
    expect(anchor.href).toBe("blob:test");
    expect(click).toHaveBeenCalledOnce();
  });
});
