/**
 * „Telefonul lui X”: pe telefonul unui copil sau al unui bunic, aplicația arată un singur
 * ecran — cât are azi persoana aceea și „Notează”. E o alegere a telefonului, nu a familiei:
 * stă în stocarea locală și nu se sincronizează.
 */
import { useEffect, useState } from "react";
import { safeSetItem } from "./safe-storage";
import { allocationStatus, type AppData } from "./finance-data";
import { envelopeUntilPayday, todayBrief, weekDayCap } from "./household-insights";

export const MEMBER_MODE_KEY = "buget-familie:member-mode-v1";

export const readMemberMode = () => {
  try { return window.localStorage.getItem(MEMBER_MODE_KEY) || ""; } catch { return ""; }
};

export const writeMemberMode = (memberId: string) => {
  try {
    if (memberId) safeSetItem(window.localStorage, MEMBER_MODE_KEY, memberId);
    else window.localStorage.removeItem(MEMBER_MODE_KEY);
  } catch { /* fără stocare, modul ține doar până la închidere */ }
  window.dispatchEvent(new CustomEvent("buget-familie:member-mode", { detail: memberId }));
};

export function useMemberMode() {
  const [memberId, setMemberId] = useState(readMemberMode);
  useEffect(() => {
    const onChange = (event: Event) => setMemberId(String((event as CustomEvent<string>).detail || ""));
    window.addEventListener("buget-familie:member-mode", onChange);
    return () => window.removeEventListener("buget-familie:member-mode", onChange);
  }, []);
  return memberId;
}

/**
 * Cât are persoana azi: din plicurile ei (bani de buzunar, pensie pentru piață), dacă are;
 * altfel, cifra familiei de pe Astăzi. Pe plicurile pe săptămâni, cifra săptămânii.
 */
export function memberToday(data: AppData, memberId: string) {
  const own = data.settings.salaryPlan.allocations.filter((item) => item.memberId === memberId);
  if (!own.length) {
    const brief = todayBrief(data);
    return { own: false as const, today: Math.max(0, brief.spendable), left: undefined, labels: [] as string[], days: brief.hasPayday ? brief.remainingDays : undefined };
  }
  let today = 0;
  let left = 0;
  let days: number | undefined;
  for (const item of own) {
    const remaining = Math.max(0, allocationStatus(data, item).remaining);
    left += remaining;
    const cap = weekDayCap(data, item);
    const until = envelopeUntilPayday(data, item);
    if (until) days = until.days;
    today += cap ? cap.perDay : until ? remaining / Math.max(1, until.latestDays) : remaining;
  }
  return { own: true as const, today: Math.floor(today * 100) / 100, left: Math.round(left * 100) / 100, labels: own.map((item) => item.label), days };
}
