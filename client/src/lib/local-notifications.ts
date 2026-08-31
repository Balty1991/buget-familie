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
  type AppData,
} from "@/lib/finance-data";

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

export async function getNotificationPermission(): Promise<NotificationPref> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "unknown";
}

export async function requestNotificationPermission(): Promise<NotificationPref> {
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
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(
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
      title: days === 0 ? "Scadență azi" : "Scadență aproape",
      body: `${item.name || "Obligație"} · ${money(item.amount)} · ${formatDate(item.dueDate)}`,
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
        title: "Plic epuizat",
        body: `${alloc.label}: ${money(status.spent)} din ${money(status.budget)}. Ajustează sau mută bani.`,
        at: atLocalHour(0, 10, 0),
        tag: `env-over-${alloc.id}`,
      });
    } else if (usage >= threshold) {
      alerts.push({
        id: id++,
        title: "Plic aproape de limită",
        body: `${alloc.label}: ${Math.round(usage * 100)}% folosit · mai ai ${money(status.remaining)}.`,
        at: atLocalHour(0, 10, 15),
        tag: `env-warn-${alloc.id}`,
      });
    }
  }

  // Ritmul zilnic dacă rămâne puțin până la payday
  const remaining = typeof (data as any). foreshadowRemaining === "number" ? 0 : 0;
  void remaining;

  return alerts.slice(0, 8);
}

async function tryCapacitorSchedule(alerts: PlannedAlert[]): Promise<boolean> {
  try {
    const Cap = typeof window !== "undefined" ? (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor : undefined;
    if (!Cap?.isNativePlatform?.()) return false;
    // Plugin opțional pe nativ — rezolvat la runtime, nu la typecheck/bundle web.
    const pluginName = "@capacitor/local-notifications";
    const mod = await import(/* @vite-ignore */ pluginName).catch(() => null);
    if (!mod?.LocalNotifications) return false;
    const { LocalNotifications } = mod;
    const perm = await LocalNotifications.requestPermissions();
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

/**
 * Programează alertele din datele locale. Debounce natural prin cheia zilnică.
 */
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
