/**
 * Testarea cu utilizatori, C2 și C3: fiecare telefon din familie notează pe membrul lui,
 * iar sesiunea se poate relua din cheia păstrată, fără parolă.
 */
import { describe, expect, it } from "vitest";
import { createEmptyAppData, normalizeAppData, type AppData, type Transaction } from "./finance-data";
import { decryptFamilyData, encryptFamilyData, importFamilyKeyMaterial, mergeFamilyData } from "./family-crypto";
import { loadFamilySession, saveFamilySession } from "./family-session";
import { addSelfMember, chooseSelfMember, claimOwnMember, needsSelfChoice, selfMemberIdOf } from "./member-identity";

const PHONE_B = "device-b";

const expense = (id: string, memberId: string, person: string): Transaction => ({ id, title: id, amount: 10, kind: "expense", category: "Alimente", sourceId: "source-debit", source: "Card debit", memberId, person, date: "2026-09-24", createdAt: "2026-09-24T10:00:00.000Z" });

/** Telefonul lui Radu: a creat camera și a adăugat-o pe Ioana ca parteneră. */
const phoneA = (): AppData => {
  const data = createEmptyAppData();
  data.settings.memberName = "Radu";
  data.settings.members = [{ id: "member-me", name: "Radu" }, { id: "member-partner", name: "Ioana" }];
  data.settings.syncDevices = [{ id: "device-a", label: "Android", lastSeenAt: "2026-09-24T09:00:00.000Z" }];
  data.transactions = [expense("kaufland", "member-me", "Radu")];
  return data;
};

/** Telefonul Ioanei, pornit de la zero: aplicația i-a dat membrul implicit „member-me”. */
const phoneB = (name: string): AppData => {
  const data = createEmptyAppData();
  data.settings.memberName = name;
  data.settings.members = [{ id: "member-me", name }];
  data.transactions = [expense("farmacia", "member-me", name)];
  return data;
};

const join = (local: AppData, remote: AppData) => mergeFamilyData(claimOwnMember(local, remote, PHONE_B), remote);

describe("fiecare telefon are membrul lui (C3)", () => {
  it("Ioana intră pe membrul pe care i l-a făcut deja Radu", () => {
    const merged = join(phoneB("Ioana"), phoneA());
    expect(merged.settings.members.map((member) => member.name).sort()).toEqual(["Ioana", "Radu"]);
    expect(selfMemberIdOf(merged)).toBe("member-partner");
    expect(merged.transactions.find((item) => item.id === "farmacia")).toMatchObject({ memberId: "member-partner", person: "Ioana" });
    expect(merged.transactions.find((item) => item.id === "kaufland")).toMatchObject({ memberId: "member-me", person: "Radu" });
    expect(needsSelfChoice(merged)).toBe(false);
  });

  it("un nume necunoscut în cameră primește un membru nou, cu ID unic", () => {
    const merged = join(phoneB("Mihai"), phoneA());
    const mihai = merged.settings.members.find((member) => member.name === "Mihai")!;
    expect(mihai.id).not.toBe("member-me");
    expect(selfMemberIdOf(merged)).toBe(mihai.id);
    expect(merged.settings.members.find((member) => member.id === "member-me")?.name).toBe("Radu");
  });

  it("„Eu” nu spune cine e: telefonul întreabă, iar alegerea preia ce a notat până atunci", () => {
    const merged = join(phoneB("Eu"), phoneA());
    expect(needsSelfChoice(merged)).toBe(true);
    expect(merged.transactions.find((item) => item.id === "farmacia")?.memberId).not.toBe("member-me");
    const chosen = chooseSelfMember(merged, "member-partner");
    expect(selfMemberIdOf(chosen)).toBe("member-partner");
    expect(chosen.settings.members.map((member) => member.name).sort()).toEqual(["Ioana", "Radu"]);
    expect(chosen.transactions.find((item) => item.id === "farmacia")).toMatchObject({ memberId: "member-partner", person: "Ioana" });
    expect(chosen.transactions.find((item) => item.id === "kaufland")?.memberId).toBe("member-me");
    expect(needsSelfChoice(chosen)).toBe(false);
  });

  it("„Altcineva” redenumește membrul provizoriu, iar numele ajunge și pe celălalt telefon", () => {
    const joined = join(phoneB("Eu"), phoneA());
    // Telefonul lui Radu primește întâi membrul provizoriu „Eu”…
    const aSawEu = mergeFamilyData(phoneA(), joined);
    const named = addSelfMember(joined, "Maria");
    const self = named.settings.members.find((member) => member.id === selfMemberIdOf(named))!;
    expect(self.name).toBe("Maria");
    expect(named.transactions.find((item) => item.id === "farmacia")?.person).toBe("Maria");
    // …apoi numele nou, care trebuie să câștige peste copia lui locală.
    const onA = mergeFamilyData(aSawEu, named);
    expect(onA.settings.members.find((member) => member.id === self.id)?.name).toBe("Maria");
  });

  it("același om pe un telefon nou rămâne pe membrul lui", () => {
    const merged = join(phoneB("Radu"), phoneA());
    expect(selfMemberIdOf(merged)).toBe("member-me");
    expect(merged.settings.members).toHaveLength(2);
  });

  it("un telefon deja în cameră nu își mută membrul la reconectare", () => {
    const remote = phoneA();
    remote.settings.syncDevices = [...(remote.settings.syncDevices || []), { id: PHONE_B, label: "Android", lastSeenAt: "2026-09-24T09:00:00.000Z" }];
    const claimed = claimOwnMember(phoneB("Eu"), remote, PHONE_B);
    expect(claimed.transactions[0].memberId).toBe("member-me");
  });

  it("sursele comune ale camerei rămân ale camerei; se mută doar ce e numai pe acest telefon", () => {
    const local = phoneB("Ioana");
    local.settings.paymentSources = [...local.settings.paymentSources, { id: "source-ioana", name: "Cardul Ioanei", kind: "card", memberId: "member-me", openingBalance: 0 }];
    const claimed = claimOwnMember(local, phoneA(), PHONE_B);
    expect(claimed.settings.paymentSources.find((item) => item.id === "source-debit")?.memberId).toBe("member-me");
    expect(claimed.settings.paymentSources.find((item) => item.id === "source-ioana")?.memberId).toBe("member-partner");
  });

  it("alegerea telefonului nu pleacă în pachet și nu e suprascrisă de celălalt telefon", async () => {
    const mine = chooseSelfMember(phoneA(), "member-partner");
    const envelope = await encryptFamilyData(mine, "pisicaVerdeSareGardul7");
    expect(normalizeAppData(await decryptFamilyData(envelope, "pisicaVerdeSareGardul7")).settings.selfMemberId).toBeUndefined();
    const theirs = chooseSelfMember(phoneA(), "member-me");
    expect(mergeFamilyData(mine, theirs).settings.selfMemberId).toBe("member-partner");
  });

  it("în camerele vechi, unde ambele telefoane folosesc „member-me”, alegerea nu mută mișcările celuilalt", () => {
    const shared = phoneA();
    const chosen = chooseSelfMember(shared, "member-partner");
    expect(chosen.transactions.find((item) => item.id === "kaufland")?.memberId).toBe("member-me");
  });
});

describe("sesiunea se reia fără parolă (C2)", () => {
  it("cheia păstrată deschide și încuie pachetul la fel ca parola", async () => {
    const material = await importFamilyKeyMaterial("pisicaVerdeSareGardul7");
    const fromPassword = await encryptFamilyData(phoneA(), "pisicaVerdeSareGardul7");
    expect((await decryptFamilyData(fromPassword, material)).transactions).toHaveLength(1);
    const fromKey = await encryptFamilyData(phoneA(), material);
    expect((await decryptFamilyData(fromKey, "pisicaVerdeSareGardul7")).transactions).toHaveLength(1);
    await expect(decryptFamilyData(fromKey, await importFamilyKeyMaterial("altaParolaLungaDeFamilie"))).rejects.toThrow();
  });

  it("cheia nu poate fi citită înapoi ca parolă", async () => {
    const material = await importFamilyKeyMaterial("pisicaVerdeSareGardul7");
    expect(material.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", material)).rejects.toThrow();
  });

  it("fără IndexedDB sesiunea nu se păstrează și nu se reia, fără erori", async () => {
    const material = await importFamilyKeyMaterial("pisicaVerdeSareGardul7");
    expect(await saveFamilySession("a".repeat(64), material)).toBe(false);
    expect(await loadFamilySession()).toBeUndefined();
  });
});
