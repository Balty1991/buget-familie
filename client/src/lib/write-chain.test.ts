import { describe, expect, it } from "vitest";
import { importFamilyKeyMaterial, sha256Hex, writeChainToken } from "./family-crypto";

describe("lanțul de scriere al camerei", () => {
  it("dă același token pe orice telefon cu aceeași cheie, altul pentru altă cameră sau alt pas", async () => {
    const room = "a".repeat(64);
    const one = await writeChainToken("cheia-familiei-noastre", room, 3);
    const material = await importFamilyKeyMaterial("cheia-familiei-noastre");
    expect(await writeChainToken(material, room, 3)).toBe(one);
    expect(one).toMatch(/^[0-9a-f]{64}$/);
    expect(await writeChainToken("cheia-familiei-noastre", room, 4)).not.toBe(one);
    expect(await writeChainToken("cheia-familiei-noastre", "b".repeat(64), 3)).not.toBe(one);
    expect(await writeChainToken("alta-cheie-straina", room, 3)).not.toBe(one);
  });
  it("angajamentul e SHA-256 hex, cum îl verifică regulile", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
