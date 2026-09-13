import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { mergeFamilyData } from "./family-crypto";
import {
  deriveRecoveryLookupId,
  formatRecoveryCode,
  generateRecoveryCode,
  normalizeRecoveryCode,
  unwrapFamilyPassword,
  wrapFamilyPassword,
} from "./family-recovery";

describe("cod de recuperare", () => {
  it("are patru grupuri de câte patru semne, fără 0/O/1/I", () => {
    for (let i = 0; i < 8; i += 1) {
      const code = generateRecoveryCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(code).not.toMatch(/[01IO]/);
    }
  });

  it("ignoră cratime și minuscule la identificare", async () => {
    const code = "AB2C-DE3F-GH4K-LM5N";
    expect(normalizeRecoveryCode("ab2c de3f gh4k lm5n")).toBe("AB2CDE3FGH4KLM5N");
    expect(formatRecoveryCode("ab2cde3fgh4klm5n")).toBe("AB2C-DE3F-GH4K-LM5N");
    expect(await deriveRecoveryLookupId(code)).toBe(await deriveRecoveryLookupId("ab2cde3fgh4klm5n"));
    expect(await deriveRecoveryLookupId(code)).toHaveLength(64);
  });

  it("încuietoarea parolei se deschide doar cu același cod", async () => {
    const password = "pisicaVerdeSareGardul7";
    const code = generateRecoveryCode();
    const wrap = await wrapFamilyPassword(password, code);
    expect(await unwrapFamilyPassword(wrap, code.toLowerCase())).toBe(password);
    await expect(unwrapFamilyPassword(wrap, "ZZZZ-ZZZZ-ZZZZ-ZZZZ")).rejects.toBeTruthy();
  });

  it("marcajul că s-a emis un cod se păstrează la unirea a două telefoane", () => {
    const local = createEmptyAppData();
    const remote = createEmptyAppData();
    remote.settings.syncRecoveryIssuedAt = "2026-09-13T20:00:00.000Z";
    const merged = mergeFamilyData(local, remote);
    expect(merged.settings.syncRecoveryIssuedAt).toBe("2026-09-13T20:00:00.000Z");
  });
});
