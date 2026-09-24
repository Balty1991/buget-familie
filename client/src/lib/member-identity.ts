/**
 * Cine folosește acest telefon. Fiecare telefon pornește cu același membru implicit
 * („member-me”), așa că la intrarea în camera familiei al doilea telefon își ia un
 * membru propriu; altfel tot ce nota Ioana ca „Eu” ajungea pe numele lui Radu.
 */
import { foldRomanian, newId, type AppData, type FamilyMember } from "@/lib/finance-data";

const DEFAULT_MEMBER_ID = "member-me";

/** Nume care nu spun cine e omul: nu le folosim ca să recunoaștem un membru. */
export const isGenericMemberName = (name: string | undefined) => {
  const folded = foldRomanian(String(name || "").trim());
  return !folded || folded === "eu" || /^membru( \d+)?$/.test(folded);
};

export const selfMemberIdOf = (data: AppData) => {
  const { members, selfMemberId } = data.settings;
  if (selfMemberId && members.some((member) => member.id === selfMemberId)) return selfMemberId;
  return members.find((member) => member.id === DEFAULT_MEMBER_ID)?.id || members[0]?.id || "";
};

export const selfMemberOf = (data: AppData): FamilyMember | undefined => {
  const id = selfMemberIdOf(data);
  return data.settings.members.find((member) => member.id === id);
};

type Skip = (collection: string, id: string) => boolean;

/** Mută tot ce aparține unui membru pe alt membru. `skip` lasă neatinse elementele comune cu alt telefon. */
export function remapMember(data: AppData, from: string, to: FamilyMember, skip: Skip = () => false): AppData {
  if (from === to.id) return data;
  const swap = <T extends { id: string; memberId?: string }>(items: T[], collection: string): T[] =>
    items.map((item) => item.memberId === from && !skip(collection, item.id) ? { ...item, memberId: to.id } : item);
  const plan = data.settings.salaryPlan;
  const members = data.settings.members.some((member) => member.id === to.id)
    ? data.settings.members.filter((member) => member.id !== from)
    : data.settings.members.map((member) => member.id === from ? { ...member, ...to } : member);
  return {
    ...data,
    transactions: data.transactions.map((item) => item.memberId === from && !skip("transactions", item.id) ? { ...item, memberId: to.id, person: to.name } : item),
    debts: swap(data.debts, "debts"),
    savings: swap(data.savings, "savings"),
    receipts: swap(data.receipts, "receipts"),
    recurring: swap(data.recurring, "recurring"),
    settings: {
      ...data.settings,
      members,
      paymentSources: swap(data.settings.paymentSources, "paymentSources"),
      plannedEvents: swap(data.settings.plannedEvents || [], "plannedEvents"),
      quickTemplates: swap(data.settings.quickTemplates, "quickTemplates"),
      savedJournalFilters: swap(data.settings.savedJournalFilters, "savedJournalFilters"),
      salaryPlan: {
        ...plan,
        allocations: swap(plan.allocations, "allocations"),
        salaryAllocationApplications: plan.salaryAllocationApplications ? swap(plan.salaryAllocationApplications, "salaryAllocationApplications") : plan.salaryAllocationApplications,
      },
    },
  };
}

const idsOf = (remote: AppData): Record<string, Set<string>> => {
  const ids = (items: Array<{ id: string }> | undefined) => new Set((items || []).map((item) => item.id));
  return {
    transactions: ids(remote.transactions),
    debts: ids(remote.debts),
    savings: ids(remote.savings),
    receipts: ids(remote.receipts),
    recurring: ids(remote.recurring),
    paymentSources: ids(remote.settings.paymentSources),
    plannedEvents: ids(remote.settings.plannedEvents),
    allocations: ids(remote.settings.salaryPlan.allocations),
    salaryAllocationApplications: ids(remote.settings.salaryPlan.salaryAllocationApplications),
  };
};


/**
 * La prima intrare a acestui telefon într-o cameră care are deja membrul lui implicit:
 * - același nume ca în cameră → e același om (telefon nou), rămâne pe membrul lui;
 * - numele lui există în cameră sub alt ID (partenerul l-a adăugat deja) → se mută pe acela;
 * - altfel primește un membru nou, cu ID unic.
 * Doar ce există numai pe acest telefon se mută; elementele deja comune rămân ale camerei.
 */
export function claimOwnMember(local: AppData, remote: AppData, deviceId: string): AppData {
  const selfId = selfMemberIdOf(local);
  const settle = (data: AppData, id: string): AppData => {
    const member = data.settings.members.find((item) => item.id === id);
    return { ...data, settings: { ...data.settings, selfMemberId: id || undefined, memberName: member?.name || data.settings.memberName } };
  };
  const knownDevice = (remote.settings.syncDevices || []).some((device) => device.id === deviceId);
  const remoteSame = remote.settings.members.find((member) => member.id === selfId);
  if (knownDevice || !selfId || !remoteSame) return settle(local, selfId);

  const localSelf = local.settings.members.find((member) => member.id === selfId);
  const name = (localSelf?.name || local.settings.memberName || "").trim();
  const generic = isGenericMemberName(name);
  const sameName = (member: FamilyMember) => !generic && foldRomanian(member.name.trim()) === foldRomanian(name);
  if (sameName(remoteSame)) return settle(local, selfId);

  const remoteIds = idsOf(remote);
  const skip: Skip = (collection, id) => Boolean(remoteIds[collection]?.has(id));
  const byName = remote.settings.members.find(sameName);
  const target: FamilyMember = byName || { id: newId("member"), name: name || "Eu", color: localSelf?.color, kind: localSelf?.kind };
  // Membrul găsit în cameră intră în lista locală, ca mutarea să nu-l dubleze.
  const withTarget = byName && !local.settings.members.some((member) => member.id === byName.id)
    ? { ...local, settings: { ...local.settings, members: [...local.settings.members, byName] } }
    : local;
  return settle(remapMember(withTarget, selfId, target, skip), target.id);
}

/**
 * Telefonul are încă un membru provizoriu: intrat în cameră fără un nume care să spună
 * cine e („Eu”). Îl întrebăm „Cine ești pe acest telefon?”.
 */
export const needsSelfChoice = (data: AppData) => {
  const self = selfMemberOf(data);
  return Boolean(self && self.id !== DEFAULT_MEMBER_ID && isGenericMemberName(self.name) && data.settings.members.length > 1);
};

/**
 * Alegerea din „Cine ești pe acest telefon?”. Membrul provizoriu (creat la intrare, cu nume
 * generic) se contopește în cel ales, cu tot ce a notat până atunci. Membrul implicit comun
 * („member-me”) nu se contopește niciodată: în camerele vechi îl folosesc ambele telefoane.
 */
export function chooseSelfMember(data: AppData, memberId: string): AppData {
  const chosen = data.settings.members.find((member) => member.id === memberId);
  if (!chosen) return data;
  const previous = selfMemberOf(data);
  const absorb = previous && previous.id !== memberId && needsSelfChoice(data);
  const base = absorb ? remapMember(data, previous.id, chosen) : data;
  return { ...base, settings: { ...base.settings, selfMemberId: memberId, memberName: chosen.name } };
}

/** „Sunt altcineva”: membru nou, cu ID unic, folosit de acum pe acest telefon. */
export function addSelfMember(data: AppData, name: string): AppData {
  const clean = name.trim().slice(0, 40);
  if (!clean || isGenericMemberName(clean)) return data;
  const existing = data.settings.members.find((member) => foldRomanian(member.name.trim()) === foldRomanian(clean));
  if (existing) return chooseSelfMember(data, existing.id);
  const previous = selfMemberOf(data);
  // Membrul provizoriu primește doar numele: ID-ul lui e deja unic.
  if (previous && needsSelfChoice(data)) {
    const members = data.settings.members.map((member) => member.id === previous.id ? { ...member, name: clean, updatedAt: new Date().toISOString() } : member);
    const transactions = data.transactions.map((item) => item.memberId === previous.id ? { ...item, person: clean } : item);
    return { ...data, transactions, settings: { ...data.settings, members, selfMemberId: previous.id, memberName: clean } };
  }
  const member: FamilyMember = { id: newId("member"), name: clean, updatedAt: new Date().toISOString() };
  return { ...data, settings: { ...data.settings, members: [...data.settings.members, member], selfMemberId: member.id, memberName: clean } };
}
