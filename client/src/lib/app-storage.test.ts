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
    expect(backup).toMatchObject({ kind: "buget-familie-backup", version: 1, data: { version: 9 } });
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

  it("folosește foaia de partajare a sistemului când există — singura cale care merge în WebView-ul Android", async () => {
    const share = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true });
    vi.stubGlobal("File", class { constructor(public parts: unknown[], public name: string) {} });
    vi.stubGlobal("Blob", class { constructor(public parts: unknown[]) {} });

    await expect(downloadBackup(data())).resolves.toBe("shared");
    expect(share).toHaveBeenCalledOnce();
    expect(share.mock.calls[0][0].title).toMatch(/^buget-familie-backup-20\d\d-\d\d-\d\d\.json$/);
  });

  it("cade pe descărcarea clasică atunci când partajarea nu este disponibilă", async () => {
    const click = vi.fn();
    const anchor = { href: "", download: "", rel: "", click, remove: vi.fn() };
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("Blob", class { constructor(public parts: unknown[]) {} });
    vi.stubGlobal("document", { createElement: vi.fn(() => anchor), body: { appendChild: vi.fn() } });
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("window", { setTimeout: vi.fn() });

    await expect(downloadBackup(data())).resolves.toBe("downloaded");
    expect(anchor.download).toMatch(/^buget-familie-backup-20\d\d-\d\d-\d\d\.json$/);
    expect(anchor.href).toBe("blob:test");
    expect(click).toHaveBeenCalledOnce();
  });

  it("nu raportează succes când utilizatorul închide foaia de partajare", async () => {
    const abort = Object.assign(new Error("abort"), { name: "AbortError" });
    vi.stubGlobal("navigator", { share: vi.fn(async () => { throw abort; }), canShare: () => true });
    vi.stubGlobal("File", class { constructor(public parts: unknown[], public name: string) {} });
    vi.stubGlobal("Blob", class { constructor(public parts: unknown[]) {} });

    await expect(downloadBackup(data())).resolves.toBe("failed");
  });
});
