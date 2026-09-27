/** Scenariile motorului de sync, fără Firebase (dev D16): ce se întâmplă când partenerul scrie între timp. */
import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData, type Transaction } from "./finance-data";
import { mergeFamilyData } from "./family-crypto";
import { pushWithRetry, retryDelay } from "./sync-engine";

type Env = { iv: string; ciphertext: string; data: AppData };
const tx = (id: string, amount: number): Transaction => ({ id, title: id, amount, kind: "expense", category: "Alimente", source: "Card", sourceId: "source-debit", person: "Eu", memberId: "member-me", date: "2026-09-20" });
const withTx = (items: Transaction[]) => { const data = createEmptyAppData(); data.transactions = items; return data; };

/** O „cameră” în memorie: scrierea cere IV-ul citit, ca Firestore cu precondiție. */
function room(initial: AppData | null) {
  let seq = 0;
  let doc: Env | null = initial ? { iv: `iv-${seq++}`, ciphertext: "x", data: initial } : null;
  return {
    get doc() { return doc; },
    partnerWrites(data: AppData) { doc = { iv: `iv-${seq++}`, ciphertext: "x", data }; },
    deps(current: () => AppData, beforeWrite?: () => void) {
      return {
        current,
        fetch: async () => doc,
        decrypt: async (envelope: Env) => envelope.data,
        merge: (local: AppData, remote: AppData) => mergeFamilyData(local, remote),
        encrypt: async (data: AppData) => ({ iv: `iv-${seq++}`, ciphertext: JSON.stringify(data.transactions.map((item) => item.id)), data }),
        write: async (envelope: Env, expectedIv: string | null) => {
          beforeWrite?.();
          if ((doc?.iv ?? null) !== expectedIv) throw Object.assign(new Error("conflict"), { conflict: true });
          doc = envelope;
        },
        isConflict: (error: unknown) => Boolean((error as { conflict?: boolean }).conflict),
      };
    },
  };
}

describe("motorul de sync", () => {
  it("într-o cameră goală scrie direct", async () => {
    const r = room(null);
    const result = await pushWithRetry(r.deps(() => withTx([tx("mine", 10)])));
    expect(result.status).toBe("pushed");
    expect(r.doc?.data.transactions.map((item) => item.id)).toEqual(["mine"]);
  });

  it("dacă partenerul scrie între citire și scriere, reia și păstrează ambele cheltuieli (D1)", async () => {
    const r = room(withTx([tx("old", 5)]));
    let once = false;
    const result = await pushWithRetry(r.deps(() => withTx([tx("old", 5), tx("mine", 10)]), () => {
      if (once) return;
      once = true;
      r.partnerWrites(withTx([tx("old", 5), tx("partner", 20)]));
    }));
    expect(result.status).toBe("pushed");
    expect(r.doc?.data.transactions.map((item) => item.id).sort()).toEqual(["mine", "old", "partner"]);
  });

  it("camera mutată oprește trimiterea, fără să scrie nimic", async () => {
    const moved = createEmptyAppData();
    moved.settings.syncRoomMovedAt = "2026-09-20T10:00:00.000Z";
    const r = room(moved);
    const before = r.doc;
    expect((await pushWithRetry(r.deps(() => withTx([tx("mine", 10)])))).status).toBe("moved");
    expect(r.doc).toBe(before);
  });

  it("renunță după 3 conflicte la rând, iar alte erori ies imediat", async () => {
    const r = room(withTx([]));
    await expect(pushWithRetry(r.deps(() => withTx([tx("mine", 10)]), () => r.partnerWrites(withTx([tx("p", 1)]))))).rejects.toThrow("conflict");
    const failing = { ...room(null).deps(() => withTx([])), write: async () => { throw new Error("rețea"); } };
    await expect(pushWithRetry(failing)).rejects.toThrow("rețea");
  });

  it("reîncercarea: 5 s, 30 s, apoi 2 minute", () => {
    expect([0, 1, 2, 7].map(retryDelay)).toEqual([5_000, 30_000, 120_000, 120_000]);
  });
});
