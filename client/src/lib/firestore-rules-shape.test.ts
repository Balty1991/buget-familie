import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FIRESTORE_ALLOWED_DOC_KEYS,
  FIRESTORE_ALLOWED_ENVELOPE_KEYS,
  FIRESTORE_CIPHERTEXT_MAX,
  FIRESTORE_ENVELOPE_VERSION,
  FIRESTORE_IV_B64_LEN,
  FIRESTORE_ROOM_ID_HEX_LEN,
  FIRESTORE_SALT_B64_LEN,
} from "./firestore-rules-shape";
import { encryptFamilyData } from "./family-crypto";
import { createEmptyAppData } from "./finance-data";

describe("firestore.rules ↔ family-crypto shape", () => {
  it("rules file encodes the same lengths and keys as constants", () => {
    const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");
    expect(rules).toContain(`roomId.size() == ${FIRESTORE_ROOM_ID_HEX_LEN}`);
    expect(rules).toContain(`envelope.version == ${FIRESTORE_ENVELOPE_VERSION}`);
    expect(rules).toContain(`envelope.salt.size() == ${FIRESTORE_SALT_B64_LEN}`);
    expect(rules).toContain(`envelope.iv.size() == ${FIRESTORE_IV_B64_LEN}`);
    expect(rules).toContain(`ciphertext.size() < ${FIRESTORE_CIPHERTEXT_MAX}`);
    for (const key of FIRESTORE_ALLOWED_DOC_KEYS) expect(rules).toContain(`'${key}'`);
    for (const key of FIRESTORE_ALLOWED_ENVELOPE_KEYS) expect(rules).toContain(`'${key}'`);
    expect(rules).toMatch(/allow get:/);
    expect(rules).toMatch(/allow create, update:/);
    expect(rules).not.toMatch(/allow list:/);
    expect(rules).not.toMatch(/allow delete:/);
  });

  it("encryptFamilyData produces salt/iv lengths that match rules", async () => {
    const envelope = await encryptFamilyData(createEmptyAppData(), "parola-familie-test-12");
    expect(envelope.version).toBe(FIRESTORE_ENVELOPE_VERSION);
    expect(envelope.salt.length).toBe(FIRESTORE_SALT_B64_LEN);
    expect(envelope.iv.length).toBe(FIRESTORE_IV_B64_LEN);
    expect(envelope.ciphertext.length).toBeLessThan(FIRESTORE_CIPHERTEXT_MAX);
    expect(Object.keys(envelope).sort()).toEqual([...FIRESTORE_ALLOWED_ENVELOPE_KEYS].sort());
  });
});
