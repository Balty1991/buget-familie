/**
 * Alerte locale pentru plicuri, scadențe și ritm.
 * Folosește Notification API pe web/PWA; pe Android nativ încearcă Capacitor LocalNotifications dacă e instalat.
 * Nu trimite date pe server.
 */

import {
  allocationStatus,
  formatDate,
  isoToday,
  pendingRecurringInPlan,
  planEndDate,
  planForecast,
  type AppData,
} from "@/lib/finance-data";
import { calendarBudget } from "@/lib/calendar-budget";
import { getLocale, t } from "./i18n";

const PREF_KEY = "buget-familie:notifications-enabled";
const LAST_SCHEDULE_KEY = "buget-familie:notifications-last-schedule";

export type NotificationPref = "unknown" | "granted" | "denied" | "unsupported";

export function isNotificationsEnabled(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setNotificationsEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(PREF_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

/**
 * WebView-ul Android nu expune Notification API, așa că pe telefon verificarea
 * „există Notification în window?” răspundea mereu „nu se poate” și butonul de
 * activare nu avea ce face. Pe nativ întrebăm plugin-ul Capacitor, care cere
 * permisiunea reală a sistemului.
 */
const isNative = () => {
  if (typeof window === "undefined") return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
};

const loadNativeNotifications = () => import("@capacitor/local-notifications").then((module) => module.LocalNotifications);

export async function getNotificationPermission(): Promise<NotificationPref> {
  if (isNative()) {
    try {
      const plugin = await loadNativeNotifications();
      const status = await plugin.checkPermissions();
      if (status.display === "granted") return "granted";
      if (status.display === "denied") return "denied";
      return "unknown";
    } catch {
      return "unsupported";
    }
  }
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "unknown";
}

export async function requestNotificationPermission(): Promise<NotificationPref> {
  if (isNative()) {
    try {
      const plugin = await loadNativeNotifications();
      const current = await plugin.checkPermissions();
      const status = current.display === "granted" ? current : await plugin.requestPermissions();
      if (status.display === "granted") {
        setNotificationsEnabled(true);
        return "granted";
      }
      // „prompt-with-rationale” înseamnă că sistemul mai poate întreba o dată; nu e refuz definitiv.
      return status.display === "denied" ? "denied" : "unknown";
    } catch {
      return "unsupported";
    }
  }
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") {
    setNotificationsEnabled(true);
    return "granted";
  }
  if (Notification.permission === "denied") return "denied";
  try {
    const result = await Notification.requestPermission();
    if (result === "granted") {
      setNotificationsEnabled(true);
      return "granted";
    }
    return result === "denied" ? "denied" : "unknown";
  } catch {
    return "unsupported";
  }
}

type PlannedAlert = {
  id: number;
  title: string;
  body: string;
  at: Date;
  tag: string;
};

const money = (value: number) =>
  new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0,
  );

function atLocalHour(daysFromToday: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function buildAlerts(data: AppData): PlannedAlert[] {
  const alerts: PlannedAlert[] = [];
  const today = isoToday();
  let id = 4100;

  // Scadențe în următoarele 3 zile
  const pending = pendingRecurringInPlan(data)
    .filter((item) => item.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  for (const item of pending) {
    const due = new Date(`${item.dueDate}T12:00:00`);
    const todayNoon = new Date(`${today}T12:00:00`);
    const days = Math.round((due.valueOf() - todayNoon.valueOf()) / 86_400_000);
    if (days < 0 || days > 3) continue;
    const when = days === 0 ? atLocalHour(0, 9, 30) : atLocalHour(Math.max(0, days - 1), 18, 0);
    if (when.getTime() <= Date.now() - 60_000) continue;
    alerts.push({
      id: id++,
      title: days === 0 ? t("Scadență azi") : t("Scadență aproape"),
      body: `${item.name || t("Obligație")} · ${money(item.amount)} · ${formatDate(item.dueDate)}`,
      at: when,
      tag: `due-${item.id || item.dueDate}`,
    });
  }

  // Plicuri aproape de prag sau depășite
  const plan = data.settings.salaryPlan;
  for (const alloc of plan.allocations || []) {
    const status = allocationStatus(data, alloc);
    if (!status) continue;
    const usage = status.usage;
    const threshold = (alloc.alertThreshold ?? 80) / 100;
    if (usage >= 1) {
      alerts.push({
        id: id++,
        title: t("Plic epuizat"),
        body: t("{label}: {spent} din {budget}. Ajustează sau mută bani.", { label: alloc.label, spent: money(status.spent), budget: money(status.budget) }),
        at: atLocalHour(0, 10, 0),
        tag: `env-over-${alloc.id}`,
      });
    } else if (usage >= threshold) {
      alerts.push({
        id: id++,
        title: t("Plic aproape de limită"),
        body: t("{label}: {percent}% folosit · mai ai {remaining}.", { label: alloc.label, percent: Math.round(usage * 100), remaining: money(status.remaining) }),
        at: atLocalHour(0, 10, 15),
        tag: `env-warn-${alloc.id}`,
      });
    }
  }

  // Ritmul zilnic: dacă proiecția arată că plicurile rămase nu ajung până la salariu
  const forecast = planForecast(data);
  if (forecast.remainingDays > 0 && forecast.spentToDate > 0 && forecast.projectedRemaining < 0) {
    alerts.push({
      id: id++,
      title: t("Ritm peste plan"),
      body: t("Cu ritmul actual, planul ar ieși în minus cu {amount} până la salariu. Sigur pe zi: {safe}.", { amount: money(Math.abs(forecast.projectedRemaining)), safe: money(forecast.safeDaily) }),
      at: atLocalHour(0, 10, 30),
      tag: "pace-over-plan",
    });
  }

  // Tranșă săptămânală: reamintire în dimineața zilei de start (WorkManager pe Android).
  const planEnd = planEndDate(plan);
  const weeklyPacedTotal = (plan.allocations || []).filter((item) => item.weeklyPace !== false).reduce((sum, item) => sum + item.amount, 0);
  if (plan.periodStart && planEnd && weeklyPacedTotal > 0) {
    const weeks = calendarBudget(weeklyPacedTotal, plan.periodStart, planEnd)?.weeks || [];
    for (const week of weeks) {
      if (week.start < today) continue;
      const start = new Date(`${week.start}T12:00:00`);
      const todayNoon = new Date(`${today}T12:00:00`);
      const days = Math.round((start.valueOf() - todayNoon.valueOf()) / 86_400_000);
      if (days < 0 || days > 7) continue;
      const when = atLocalHour(days, 9, 0);
      if (when.getTime() <= Date.now() - 60_000) continue;
      alerts.push({
        id: id++,
        title: days === 0 ? t("Tranșă nouă azi") : t("Tranșă săptămânală aproape"),
        body: t("S{index}: {amount} pentru {days} zile ({start} – {end}).", {
          index: week.index,
          amount: money(week.amount),
          days: week.days,
          start: formatDate(week.start),
          end: formatDate(week.end),
        }),
        at: when,
        tag: `tranche-${week.start}-${week.index}`,
      });
      break; // o singură tranșă viitoare — nu spamăm tot ciclul
    }
  }

  // Salariu / următorul venit: cu o zi înainte seara și în dimineața zilei tipice.
  const payday = plan.nextPayday || plan.earliestPayday;
  if (payday && payday >= today) {
    const due = new Date(`${payday}T12:00:00`);
    const todayNoon = new Date(`${today}T12:00:00`);
    const days = Math.round((due.valueOf() - todayNoon.valueOf()) / 86_400_000);
    if (days === 1) {
      const when = atLocalHour(0, 18, 30);
      if (when.getTime() > Date.now() - 60_000) {
        alerts.push({
          id: id++,
          title: t("Venit mâine"),
          body: t("Următorul venit este planificat pe {date}. Pregătește repartizarea în Plan.", { date: formatDate(payday) }),
          at: when,
          tag: `payday-eve-${payday}`,
        });
      }
    } else if (days === 0) {
      const when = atLocalHour(0, 9, 15);
      if (when.getTime() > Date.now() - 60_000) {
        alerts.push({
          id: id++,
          title: t("Ziua venitului"),
          body: t("Astăzi e data tipică a venitului ({date}). Confirmă încasarea când ajung banii.", { date: formatDate(payday) }),
          at: when,
          tag: `payday-day-${payday}`,
        });
      }
    }
  }

  return alerts.slice(0, 8);
}

async function tryCapacitorSchedule(alerts: PlannedAlert[]): Promise<boolean> {
  try {
    if (!isNative()) return false;
    // Încărcat doar pe nativ, ca să nu intre în bundle-ul web/PWA.
    const LocalNotifications = await loadNativeNotifications();
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return false;
    await LocalNotifications.cancel({ notifications: alerts.map((a) => ({ id: a.id })) }).catch(() => undefined);
    await LocalNotifications.schedule({
      notifications: alerts.map((alert) => ({
        id: alert.id,
        title: alert.title,
        body: alert.body,
        schedule: { at: alert.at },
        extra: { tag: alert.tag },
      })),
    });
    return true;
  } catch {
    return false;
  }
}

async function scheduleWeb(alerts: PlannedAlert[]) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  // Web Notification API nu programează nativ; arătăm doar alertele „azi” imediat dacă e dimineața relevantă
  // și păstrăm tag-uri ca să nu spamăm.
  const now = Date.now();
  for (const alert of alerts) {
    const delta = alert.at.getTime() - now;
    if (delta < -5 * 60_000 || delta > 14 * 60 * 60_000) continue;
    try {
      // Programare soft prin setTimeout cât timp tab-ul trăiește (PWA)
      window.setTimeout(() => {
        try {
          new Notification(alert.title, { body: alert.body, tag: alert.tag });
        } catch {
          /* ignore */
        }
      }, Math.max(0, delta));
    } catch {
      /* ignore */
    }
  }
}


const FAMILY_ALERT_KEY = "buget-familie:family-envelope-alerts";

const readFamilyAlertLog = (): Record<string, string> => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAMILY_ALERT_KEY) || "{}") as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const writeFamilyAlertLog = (log: Record<string, string>) => {
  try {
    const entries = Object.entries(log).slice(-60);
    window.localStorage.setItem(FAMILY_ALERT_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* jurnalul de alerte nu trebuie să blocheze datele financiare */
  }
};

async function showNow(title: string, body: string, tag: string) {
  if (isNative()) {
    try {
      const LocalNotifications = await loadNativeNotifications();
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== "granted") return;
      await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 100000) + 5000, title, body, extra: { tag } }] });
      return;
    } catch {
      /* cădem pe Notification API */
    }
  }
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag });
  } catch {
    /* ignore */
  }
}

/**
 * Anunță imediat când o actualizare primită de la un alt telefon împinge un plic
 * peste pragul lui. Alertele zilnice programate acoperă propriile cheltuieli; aceasta
 * acoperă cazul în care altcineva din familie a cheltuit, iar tu afli abia la final de lună.
 *
 * Se declanșează doar la trecerea pragului, doar pentru mișcări ale altui membru și cel
 * mult o dată pe zi pentru fiecare plic și stare, ca sincronizarea să nu devină o sursă
 * de notificări repetate.
 */
export async function notifyFamilyEnvelopeChanges(previous: AppData, next: AppData): Promise<void> {
  if (!isNotificationsEnabled()) return;
  const permission = await getNotificationPermission();
  if (permission !== "granted") return;

  const me = next.settings.members.find((member) => member.name === next.settings.memberName);
  const knownIds = new Set(previous.transactions.map((item) => item.id));
  const incoming = next.transactions.filter((item) => !knownIds.has(item.id) && item.kind === "expense" && (!me || item.memberId !== me.id));
  if (!incoming.length) return;

  const day = isoToday();
  const log = readFamilyAlertLog();
  let changed = false;

  for (const allocation of next.settings.salaryPlan.allocations || []) {
    const before = previous.settings.salaryPlan.allocations.find((item) => item.id === allocation.id);
    const beforeState = before ? allocationStatus(previous, before).state : "healthy";
    const after = allocationStatus(next, allocation);
    // Doar trecerea în sus contează: „încă sănătos” sau o revenire nu merită o notificare.
    if (after.state === "healthy" || after.state === beforeState) continue;
    if (beforeState === "over") continue;

    const responsible = incoming.filter((item) => item.allocationId
      ? item.allocationId === allocation.id
      : (!allocation.memberId || item.memberId === allocation.memberId) && (!allocation.category || item.category === allocation.category) && (!allocation.sourceId || item.sourceId === allocation.sourceId));
    if (!responsible.length) continue;

    const key = `${allocation.id}:${after.state}`;
    if (log[key] === day) continue;
    log[key] = day;
    changed = true;

    const names = Array.from(new Set(responsible.map((item) => item.person).filter(Boolean)));
    const who = names.length === 1 ? names[0] : names.length ? t("{first} și {last}", { first: names.slice(0, -1).join(", "), last: names[names.length - 1] }) : t("Un membru");
    const spent = responsible.reduce((sum, item) => sum + item.amount, 0);
    await showNow(
      after.state === "over" ? t("Plic depășit: {label}", { label: allocation.label }) : t("Plic aproape de limită: {label}", { label: allocation.label }),
      after.state === "over"
        ? t("{who} a înregistrat {spent}. Plicul este la {used} din {budget}.", { who, spent: money(spent), used: money(after.spent), budget: money(after.budget) })
        : t("{who} a înregistrat {spent}. Mai rămân {remaining} din {budget}.", { who, spent: money(spent), remaining: money(after.remaining), budget: money(after.budget) }),
      `family-env-${key}`,
    );
  }

  if (changed) writeFamilyAlertLog(log);
}


/**
 * Programează alertele din datele locale. Debounce natural prin cheia zilnică.
 */

type NativeReminderBridge = { schedule?: (payload: string) => void; cancelAll?: () => void };

function scheduleWorkManager(alerts: PlannedAlert[]): boolean {
  if (!isNative()) return false;
  try {
    const bridge = (window as unknown as { BugetFamilieReminders?: NativeReminderBridge }).BugetFamilieReminders;
    if (!bridge?.schedule) return false;
    const payload = JSON.stringify(
      alerts.slice(0, 6).map((alert) => ({
        id: alert.id,
        title: alert.title,
        body: alert.body,
        tag: alert.tag,
        at: alert.at.getTime(),
      })),
    );
    bridge.schedule(payload);
    return true;
  } catch {
    return false;
  }
}

export async function scheduleFinancialReminders(data: AppData): Promise<void> {
  if (!isNotificationsEnabled()) return;
  const permission = await getNotificationPermission();
  if (permission === "denied" || permission === "unsupported") return;

  const dayKey = isoToday();
  try {
    if (window.localStorage.getItem(LAST_SCHEDULE_KEY) === dayKey && permission !== "granted") {
      // așteptăm permisiunea
    }
  } catch {
    /* ignore */
  }

  const alerts = buildAlerts(data);
  if (!alerts.length) return;

  // WorkManager acoperă fundalul Android (tranșă/salariu) chiar dacă tab-ul e închis.
  scheduleWorkManager(alerts);
  const usedNative = await tryCapacitorSchedule(alerts);
  if (!usedNative) {
    if (permission === "granted") await scheduleWeb(alerts);
  }

  try {
    window.localStorage.setItem(LAST_SCHEDULE_KEY, dayKey);
  } catch {
    /* ignore */
  }
}
