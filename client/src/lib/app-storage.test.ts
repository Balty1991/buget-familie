import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { downloadBackup, makeBackup, parseBackup } from "./app-storage";

/** Plugin-urile Capacitor nu există în Node; le înlocuim o singură dată, controlabil. */
const native = vi.hoisted(() => ({ writeFile: vi.fn(), stat: vi.fn(), share: vi.fn() }));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { writeFile: native.writeFile, stat: native.stat },
  Directory: { Documents: "DOCUMENTS", Cache: "CACHE", Data: "DATA" },
  Encoding: { UTF8: "utf8" },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: native.share } }));

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

  describe("pe telefon (Capacitor)", () => {
    // Cazul real raportat: în WebView-ul Android nu există nici `navigator.share`,
    // nici descărcare prin ancoră. Fișierul trebuie scris de un plugin nativ.
    beforeEach(() => {
      vi.stubGlobal("window", { Capacitor: { isNativePlatform: () => true } });
      native.writeFile.mockReset().mockResolvedValue({ uri: "file:///Documents/backup.json" });
      native.stat.mockReset().mockResolvedValue({ size: 120, uri: "file:///Documents/backup.json" });
      native.share.mockReset().mockResolvedValue({ activityType: "com.google.android.apps.docs" });
    });

    it("scrie fișierul în Documente și deschide foaia de partajare", async () => {
      await expect(downloadBackup(data())).resolves.toEqual({ how: "shared" });

      expect(native.writeFile).toHaveBeenCalledOnce();
      const call = native.writeFile.mock.calls[0][0];
      expect(call.path).toMatch(/^buget-familie-backup-20\d\d-\d\d-\d\d-\d{4}\.json$/);
      expect(call.directory).toBe("DOCUMENTS");
      expect(JSON.parse(call.data).data.settings.familyName).toBe("Familia Test");
      expect(native.share).toHaveBeenCalledOnce();
      expect(native.share.mock.calls[0][0].url).toBe("file:///Documents/backup.json");
    });

    it("nu crede o scriere care lasă fișierul gol — trece pe cache", async () => {
      native.stat.mockResolvedValueOnce({ size: 0, uri: "file:///Documents/backup.json" });

      await expect(downloadBackup(data())).resolves.toEqual({ how: "shared" });
      expect(native.writeFile).toHaveBeenCalledTimes(2);
      expect(native.writeFile.mock.calls[1][0].directory).toBe("CACHE");
    });

    it("dacă Documente este refuzat, scrie în cache în loc să eșueze", async () => {
      native.writeFile.mockRejectedValueOnce(new Error("Directory does not exist"));

      await expect(downloadBackup(data())).resolves.toEqual({ how: "shared" });
      expect(native.writeFile).toHaveBeenCalledTimes(2);
      expect(native.writeFile.mock.calls[1][0].directory).toBe("CACHE");
    });

    it("dacă utilizatorul închide foaia de partajare, fișierul rămâne în Documente și îi spunem unde", async () => {
      native.share.mockRejectedValue(Object.assign(new Error("Share canceled"), { name: "AbortError" }));

      const result = await downloadBackup(data());
      expect(result.how).toBe("saved");
      expect(result.how === "saved" && result.path).toMatch(/^Documente\/buget-familie-backup/);
    });

    it("nu pretinde că a salvat ceva când fișierul e doar în cache și partajarea a fost anulată", async () => {
      native.writeFile.mockRejectedValueOnce(new Error("Directory does not exist"));
      native.share.mockRejectedValue(Object.assign(new Error("Share canceled"), { name: "AbortError" }));

      await expect(downloadBackup(data())).resolves.toEqual({ how: "cancelled" });
    });

    it("raportează eroarea reală când nici scrierea nativă nu reușește", async () => {
      native.writeFile.mockRejectedValue(new Error("Nu există spațiu"));

      await expect(downloadBackup(data())).resolves.toEqual({ how: "failed", reason: "Nu există spațiu" });
    });
  });

  describe("pe web", () => {
    const webWindow = () => vi.stubGlobal("window", { setTimeout: vi.fn() });

    it("folosește foaia de partajare a browserului când există", async () => {
      webWindow();
      const share = vi.fn(async () => undefined);
      vi.stubGlobal("navigator", { share, canShare: () => true });
      vi.stubGlobal("File", class { constructor(public parts: unknown[], public name: string, public options: unknown) {} });
      vi.stubGlobal("Blob", class { constructor(public parts: unknown[]) {} });

      await expect(downloadBackup(data())).resolves.toEqual({ how: "shared" });
      expect(share).toHaveBeenCalledOnce();
    });

    it("cade pe descărcarea clasică atunci când partajarea nu este disponibilă", async () => {
      const click = vi.fn();
      const anchor = { href: "", download: "", rel: "", click, remove: vi.fn() } as unknown as HTMLAnchorElement;
      webWindow();
      vi.stubGlobal("navigator", {});
      vi.stubGlobal("Blob", class { constructor(public parts: unknown[]) {} });
      vi.stubGlobal("URL", { createObjectURL: () => "blob:test", revokeObjectURL: vi.fn() });
      vi.stubGlobal("document", { createElement: () => anchor, body: { appendChild: vi.fn() } });

      await expect(downloadBackup(data())).resolves.toEqual({ how: "downloaded" });
      expect(anchor.download).toMatch(/^buget-familie-backup-20\d\d-\d\d-\d\d-\d{4}\.json$/);
      expect(click).toHaveBeenCalledOnce();
    });

    it("nu raportează nici succes, nici eroare când utilizatorul închide foaia de partajare", async () => {
      webWindow();
      const abort = Object.assign(new Error("abort"), { name: "AbortError" });
      vi.stubGlobal("navigator", { share: vi.fn(async () => { throw abort; }), canShare: () => true });
      vi.stubGlobal("File", class { constructor(public parts: unknown[], public name: string) {} });
      vi.stubGlobal("Blob", class { constructor(public parts: unknown[]) {} });

      await expect(downloadBackup(data())).resolves.toEqual({ how: "cancelled" });
    });
  });
});

import { chooseFresherAppData, hashAppPayload, normalizeSavedAt, resolveHydrateMerge } from "./app-storage";

describe("stocare LS ↔ IndexedDB", () => {
  const sample = (familyName: string) => {
    const value = createEmptyAppData();
    value.settings.familyName = familyName;
    return value;
  };

  it("păstrează IDB când hash-urile coincid", () => {
    const local = sample("Local");
    const indexed = sample("Indexed");
    const hash = hashAppPayload("same");
    expect(chooseFresherAppData(
      { data: local, savedAt: "2026-09-12T10:00:00.000Z", hash },
      { data: indexed, savedAt: "2026-09-12T10:00:00.000Z", hash },
    )).toBe(indexed);
  });

  it("alege copia cu savedAt mai nou, nu „IDB dacă există”", () => {
    const local = sample("Local-nou");
    const indexed = sample("Indexed-vechi");
    expect(chooseFresherAppData(
      { data: local, savedAt: "2026-09-12T12:00:00.000Z", hash: "aaa" },
      { data: indexed, savedAt: "2026-09-12T11:00:00.000Z", hash: "bbb" },
    )).toBe(local);
    expect(chooseFresherAppData(
      { data: local, savedAt: "2026-09-12T10:00:00.000Z", hash: "aaa" },
      { data: indexed, savedAt: "2026-09-12T11:00:00.000Z", hash: "bbb" },
    )).toBe(indexed);
  });

  it("fără meta, preferă LS când hash-urile diferă (debounce IDB)", () => {
    const local = sample("Taste-recente");
    const indexed = sample("IDB-în-urmă");
    expect(chooseFresherAppData(
      { data: local, savedAt: null, hash: "1" },
      { data: indexed, savedAt: null, hash: "2" },
    )).toBe(local);
  });

  it("stampă invalidă e tratată ca lipsă", () => {
    expect(normalizeSavedAt("nu-e-dată")).toBeNull();
    expect(normalizeSavedAt("")).toBeNull();
    expect(normalizeSavedAt("2026-09-12T12:00:00.000Z")).toBe("2026-09-12T12:00:00.000Z");
  });

  it("la același savedAt cu hash diferit preferă LS (debounce IDB)", () => {
    const local = sample("Taste");
    const indexed = sample("IDB");
    const stamp = "2026-09-12T12:00:00.000Z";
    expect(chooseFresherAppData(
      { data: local, savedAt: stamp, hash: "aaa" },
      { data: indexed, savedAt: stamp, hash: "bbb" },
    )).toBe(local);
  });

  it("savedAt invalid pe IDB nu bate LS cu stampă validă", () => {
    const local = sample("Local");
    const indexed = sample("Indexed");
    expect(chooseFresherAppData(
      { data: local, savedAt: "2026-09-12T12:00:00.000Z", hash: "a" },
      { data: indexed, savedAt: "ieri", hash: "b" },
    )).toBe(local);
  });

  it("hydrate: editarea din memorie înainte de IDB nu e rescrisă de IDB mai vechi", () => {
    const memory = sample("Editat-acum");
    const indexed = sample("IDB-vechi");
    const picked = resolveHydrateMerge({
      local: { data: sample("LS-vechi"), savedAt: "2026-09-12T10:00:00.000Z", hash: "ls" },
      indexed: { data: indexed, savedAt: "2026-09-12T11:00:00.000Z", hash: "idb" },
      memory,
      editedBeforeHydrate: true,
    });
    expect(picked?.settings.familyName).toBe("Editat-acum");
  });

  it("hydrate: fără editări, IDB mai nou înlocuiește LS", () => {
    const memory = sample("LS-vechi");
    const picked = resolveHydrateMerge({
      local: { data: memory, savedAt: "2026-09-12T10:00:00.000Z", hash: "ls" },
      indexed: { data: sample("IDB-nou"), savedAt: "2026-09-12T12:00:00.000Z", hash: "idb" },
      memory,
      editedBeforeHydrate: false,
    });
    expect(picked?.settings.familyName).toBe("IDB-nou");
  });
});
