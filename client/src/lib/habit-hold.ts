/**
 * După trei zile cu cheltuieli, Astăzi rămâne cifra și notatul.
 * Abonamentul se cere abia când un alt telefon a scris o mișcare.
 */
import type { AppData } from "@/lib/finance-data";
import { selfMemberIdOf } from "@/lib/member-identity";

export const HABIT_DAYS = 3;

export function otherPhoneHasLogged(data: AppData, thisDeviceId: string): boolean {
  if (!thisDeviceId) return false;
  return data.transactions.some((item) => Boolean(item.deviceId) && item.deviceId !== thisDeviceId && !item.adjustment);
}

/** Parteneri (nu copilul, nu tu) care n-au nicio mișcare în ziua asta. */
export function partnersQuietToday(data: AppData, today: string): string[] {
  const self = selfMemberIdOf(data);
  return data.settings.members
    .filter((member) => member.id !== self && member.kind !== "child")
    .filter((member) => !loggedByMember(data, member.id, member.name, today))
    .map((member) => member.name);
}

/** Tu ai scris azi ceva care nu e transfer și nu e corecție. */
export function selfLoggedToday(data: AppData, today: string): boolean {
  const self = selfMemberIdOf(data);
  if (!self) return false;
  const name = data.settings.members.find((member) => member.id === self)?.name;
  return loggedByMember(data, self, name, today);
}

/** Parteneri (nu copilul) care au notat azi. Reamintirea de seară îi numește, pe telefonul celui care a uitat. */
export function partnersLoggedToday(data: AppData, today: string): string[] {
  const self = selfMemberIdOf(data);
  return data.settings.members
    .filter((member) => member.id !== self && member.kind !== "child")
    .filter((member) => loggedByMember(data, member.id, member.name, today))
    .map((member) => member.name);
}

function loggedByMember(data: AppData, memberId: string, name: string | undefined, today: string): boolean {
  return data.transactions.some((item) => {
    if (item.date !== today || item.adjustment || item.transferId) return false;
    if (item.memberId) return item.memberId === memberId;
    return Boolean(name) && item.person === name;
  });
}

/** Mișcările noi, scrise pe telefonul ăsta, primesc id-ul lui. Cele venite din sync își păstrează id-ul. */
export function stampLocalTransactions(previous: AppData, next: AppData, deviceId: string): AppData {
  if (!deviceId) return next;
  const known = new Set(previous.transactions.map((item) => item.id));
  let changed = false;
  const transactions = next.transactions.map((item) => {
    if (item.deviceId || known.has(item.id)) return item;
    changed = true;
    return { ...item, deviceId };
  });
  return changed ? { ...next, transactions } : next;
}
