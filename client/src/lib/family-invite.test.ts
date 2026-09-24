/**
 * Testarea cu utilizatori, C4: camera familiei nu mai depinde de o parolă aleasă de om.
 */
import { describe, expect, it } from "vitest";
import { createEmptyAppData, normalizeAppData } from "./finance-data";
import { decryptFamilyData, encryptFamilyData, mergeFamilyData } from "./family-crypto";
import { createFamilyInvite, formatInvite, inviteLink, inviteMessage, parseInvite } from "./family-invite";
import { generateRecoveryCode, normalizeRecoveryCode } from "./family-recovery";

describe("invitația în camera familiei (C4)", () => {
  it("fiecare cameră are ID și cheie aleatoare, fără legătură cu vreo parolă", () => {
    const invites = Array.from({ length: 200 }, createFamilyInvite);
    expect(new Set(invites.map((item) => item.roomId)).size).toBe(200);
    expect(new Set(invites.map((item) => item.key)).size).toBe(200);
    invites.forEach((item) => {
      // Regulile Firestore cer exact 64 de caractere pentru ID-ul camerei.
      expect(item.roomId).toMatch(/^[0-9a-f]{64}$/);
      expect(item.key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });
  });

  it("se citește din cod, din link și din mesajul lipit întreg", () => {
    const invite = createFamilyInvite();
    expect(parseInvite(formatInvite(invite))).toEqual(invite);
    expect(parseInvite(inviteLink(invite))).toEqual(invite);
    expect(parseInvite(inviteMessage(invite))).toEqual(invite);
    expect(parseInvite(`  ${inviteMessage(invite)}  \nTrimis de pe WhatsApp`)).toEqual(invite);
  });

  it("se citește și din linkul aplicației Android deschis din browser (codul QR)", () => {
    const invite = createFamilyInvite();
    expect(parseInvite(`bugetfamilie://alatura?cod=${formatInvite(invite)}`)).toEqual(invite);
    expect(parseInvite(decodeURIComponent(encodeURIComponent(`bugetfamilie://alatura?cod=${formatInvite(invite)}`)))).toEqual(invite);
  });

  it("refuză codurile tăiate sau stricate", () => {
    const code = formatInvite(createFamilyInvite());
    expect(parseInvite(code.slice(0, -1))).toBeUndefined();
    expect(parseInvite(code.replace("bf1.", "bf2."))).toBeUndefined();
    expect(parseInvite("pisicaVerdeSareGardul7")).toBeUndefined();
    expect(parseInvite("")).toBeUndefined();
  });

  it("cheia invitației deschide pachetul, o altă invitație nu", async () => {
    const invite = createFamilyInvite();
    const envelope = await encryptFamilyData(createEmptyAppData(), invite.key);
    expect((await decryptFamilyData(envelope, invite.key)).version).toBe(9);
    await expect(decryptFamilyData(envelope, createFamilyInvite().key)).rejects.toThrow();
  });
});

describe("mutarea familiei de pe parolă pe invitație", () => {
  it("camera veche golită spune doar că familia s-a mutat, fără cheia nouă", async () => {
    const movedAt = "2026-09-24T10:00:00.000Z";
    const stub = { ...createEmptyAppData(), settings: { ...createEmptyAppData().settings, members: [], paymentSources: [], syncRoomMovedAt: movedAt } };
    const envelope = await encryptFamilyData(stub, "pisicaVerdeSareGardul7");
    const opened = normalizeAppData(await decryptFamilyData(envelope, "pisicaVerdeSareGardul7"));
    expect(opened.settings.syncRoomMovedAt).toBe(movedAt);
    expect(opened.transactions).toEqual([]);
    expect(JSON.stringify(opened)).not.toMatch(/bf1\./);
  });

  it("semnul de mutare nu trece în registrul unit", () => {
    const local = createEmptyAppData();
    const remote = { ...createEmptyAppData(), settings: { ...createEmptyAppData().settings, syncRoomMovedAt: "2026-09-24T10:00:00.000Z" } };
    expect(mergeFamilyData(local, remote).settings.syncRoomMovedAt).toBeUndefined();
  });
});

describe("codul de recuperare", () => {
  it("e aleator criptografic și are formatul așteptat", () => {
    const codes = Array.from({ length: 500 }, generateRecoveryCode);
    expect(new Set(codes).size).toBe(500);
    codes.forEach((code) => {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
      expect(normalizeRecoveryCode(code)).toHaveLength(16);
    });
  });
});
