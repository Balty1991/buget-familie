/**
 * Alerte locale pentru plicuri, scadențe și ritm.
 * Pe Android: permisiunea sistemului + WorkManager (și Capacitor, dacă plugin-ul răspunde).
 * Pe web/PWA: Notification API + service worker. Nu trimite date pe server.
 */

import {
  allocationStatus,
  formatDate,
  isoToday,
  isWeeklyPaced,
  pendingDebtsInPlan,
  pendingRecurringInPlan,
  planEndDate,
  planForecast,
  type AppData,
} from "@/lib/finance-data";
import { calendarBudget } from "@/lib/calendar-budget";
import { daysLabel, getLocale, t } from "./i18n";
import { weekTooFast } from "./household-insights";
import { lei } from "@/lib/money-format";
import { isAppLockEnabled } from "@/lib/app-lock";

/** Cu PIN pe aplicație, notificarea spune doar ce s-a întâmplat, fără sume sau nume. */
const lockSafeBody = (body: string) => isAppLockEnabled() ? t("Deschide aplicația ca să vezi detaliile.") : body;

const PREF_KEY = "buget-familie:notifications-enabled";
const ARMED_KEY = "buget-familie:notifications-armed";
const LAST_SCHEDULE_KEY = "buget-familie:notifications-last-schedule";

export type NotificationPref = "unknown" | "granted" | "denied" | "unsupported";

type NativeReminderBridge = {
  schedule?: (payload: string) => void;
  cancelAll?: () => void;
  hasPermission?: () => boolean;
  requestPermission?: () => void;
  notifyNow?: (title: string, body: string) => void;
};

function nativeReminders(): NativeReminderBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { BugetFamilieReminders?: NativeReminderBridge }).BugetFamilieReminders;
}

const sleep = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

/** addJavascriptInterface poate întârzia un tick față de first paint. */
async function waitForNativeBridge(): Promise<NativeReminderBridge | undefined> {
  for (let i = 0; i < 12; i += 1) {
    const bridge = nativeReminders();
    if (bridge && (typeof bridge.requestPermission === "function" || typeof bridge.hasPermission === "function")) return bridge;
    await sleep(80);
  }
  return nativeReminders();
}

/**
 * WebView-ul Android nu expune Notification API. Semnalul adevărat pe telefon:
 * puntea Java (`BugetFamilieReminders`), clasa `capacitor-android`, sau Capacitor.
 */
export function isNativeNotifications(): boolean {
  if (typeof window === "undefined") return false;
  if (nativeReminders()) return true;
  try {
    if (document.documentElement?.classList?.contains("capacitor-android")) return true;
  } catch {
    /* ignore */
  }
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.() || cap?.getPlatform?.() === "android");
}

const isNative = isNativeNotifications;

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
    if (!enabled) window.localStorage.removeItem(ARMED_KEY);
  } catch {
    /* ignore */
  }
}

export function isNotificationsArmed(): boolean {
  try {
    return window.localStorage.getItem(ARMED_KEY) === "true";
  } catch {
    return false;
  }
}

function setNotificationsArmed(armed: boolean) {
  try {
    if (armed) window.localStorage.setItem(ARMED_KEY, "true");
    else window.localStorage.removeItem(ARMED_KEY);
  } catch {
    /* ignore */
  }
}

const loadNativeNotifications = () => import("@capacitor/local-notifications").then((module) => module.LocalNotifications);

const nativePermissionFromBridge = (): NotificationPref | undefined => {
  const bridge = nativeReminders();
  if (!bridge) return undefined;
  if (typeof bridge.hasPermission === "function") return bridge.hasPermission() ? "granted" : "unknown";
  return "unknown";
};

function readWebPermission(): NotificationPref {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "unknown";
}

async function readPermissionsApi(): Promise<NotificationPref | undefined> {
  try {
    const permissions = navigator.permissions;
    if (!permissions?.query) return undefined;
    const status = await permissions.query({ name: "notifications" as PermissionName });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "unknown";
  } catch {
    return undefined;
  }
}

export async function getNotificationPermission(): Promise<NotificationPref> {
  if (isNative()) {
    try {
      const plugin = await loadNativeNotifications();
      const status = await plugin.checkPermissions();
      if (status.display === "granted") return "granted";
      if (status.display === "denied") {
        const viaBridge = nativePermissionFromBridge();
        return viaBridge === "granted" ? "granted" : "denied";
      }
    } catch {
      /* pluginul Capacitor lipsește sau nu e înregistrat — puntea nativă */
    }
    const viaBridge = nativePermissionFromBridge();
    if (viaBridge === "granted") return "granted";
    return viaBridge ?? "unknown";
  }
  const fromApi = readWebPermission();
  if (fromApi === "granted" || fromApi === "denied" || fromApi === "unsupported") return fromApi;
  const queried = await readPermissionsApi();
  return queried ?? fromApi;
}

function waitForNativePermission(bridge: NativeReminderBridge): Promise<"granted" | "denied" | "unknown"> {
  return new Promise((resolve) => {
    if (bridge.hasPermission?.()) {
      resolve("granted");
      return;
    }
    let settled = false;
    let poll = 0;
    let sawExplicitDeny = false;
    const finish = (status: "granted" | "denied" | "unknown") => {
      if (settled) return;
      settled = true;
      try { window.clearInterval(poll); } catch { /* ignore */ }
      window.removeEventListener("buget-familie:notify-permission", onEvent);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
      resolve(status);
    };
    const read = (): "granted" | "denied" | "unknown" => {
      if (bridge.hasPermission?.()) return "granted";
      if (sawExplicitDeny) return "denied";
      return "unknown";
    };
    const onEvent = (event: Event) => {
      const granted = (event as CustomEvent<{ granted?: boolean }>).detail?.granted;
      if (granted === true || bridge.hasPermission?.()) {
        finish("granted");
        return;
      }
      if (granted === false) {
        sawExplicitDeny = true;
        window.setTimeout(() => finish(read()), 300);
      }
    };
    const onResume = () => {
      window.setTimeout(() => {
        const status = read();
        if (status !== "unknown") finish(status);
      }, 200);
    };
    window.addEventListener("buget-familie:notify-permission", onEvent);
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    try {
      bridge.requestPermission?.();
    } catch {
      finish("unknown");
      return;
    }
    try {
      poll = window.setInterval(() => {
        if (bridge.hasPermission?.()) finish("granted");
      }, 400);
    } catch {
      /* ignore */
    }
    window.setTimeout(() => finish(read()), 8_000);
  });
}

/**
 * Chrome/Huawei: dialogul e un overlay (fără visibilitychange), promise-ul poate
 * să nu se rezolve niciodată, iar `Notification.permission` rămâne `"default"`
 * după Permite. Nu combinăm callback + promise (blochează unii fork-uri) și
 * nu așteptăm 25s pe un buton înghețat.
 */
async function requestWebNotificationPermission(): Promise<NotificationPref> {
  const current = readWebPermission();
  if (current === "granted" || current === "denied" || current === "unsupported") return current;

  const fromDialog = await new Promise<string>((resolve) => {
    let settled = false;
    const finish = (value?: string) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
      resolve(value || Notification.permission || "default");
    };
    const onResume = () => {
      window.setTimeout(() => {
        if (Notification.permission === "granted" || Notification.permission === "denied") {
          finish(Notification.permission);
        }
      }, 200);
    };
    try {
      const returned: unknown = Notification.requestPermission();
      if (returned && typeof (returned as Promise<string>).then === "function") {
        void (returned as Promise<string>).then(
          (permission) => finish(permission),
          () => finish(Notification.permission),
        );
      } else {
        Notification.requestPermission((permission) => finish(permission));
      }
    } catch {
      try {
        Notification.requestPermission((permission) => finish(permission));
      } catch {
        finish(Notification.permission);
      }
    }
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    const started = Date.now();
    const poll = () => {
      if (settled) return;
      if (Notification.permission === "granted" || Notification.permission === "denied") {
        finish(Notification.permission);
        return;
      }
      if (Date.now() - started > 4_000) {
        finish(Notification.permission);
        return;
      }
      window.setTimeout(poll, 200);
    };
    window.setTimeout(poll, 150);
  });

  if (fromDialog === "granted" || Notification.permission === "granted") return "granted";
  if (fromDialog === "denied" || Notification.permission === "denied") return "denied";
  const queried = await readPermissionsApi();
  if (queried === "granted" || queried === "denied") return queried;
  return "unknown";
}

export async function requestNotificationPermission(): Promise<NotificationPref> {
  if (isNative()) {
    const bridge = await waitForNativeBridge();
    if (bridge?.hasPermission?.()) return "granted";
    if (bridge?.requestPermission) {
      const status = await waitForNativePermission(bridge);
      if (status === "granted") return "granted";
      if (status === "denied") return "denied";
      return bridge.hasPermission?.() ? "granted" : "unknown";
    }
    try {
      const plugin = await loadNativeNotifications();
      const current = await plugin.checkPermissions();
      const status = current.display === "granted" ? current : await plugin.requestPermissions();
      if (status.display === "granted") return "granted";
      if (status.display === "denied") return "denied";
    } catch {
      /* pluginul Capacitor e opțional */
    }
    return "unknown";
  }
  return requestWebNotificationPermission();
}

type PlannedAlert = {
  id: number;
  title: string;
  body: string;
  at: Date;
  tag: string;
};

const money = lei;

const addIsoDaysLocal = (iso: string, days: number) => { const date = new Date(`${iso}T12:00:00`); date.setDate(date.getDate() + days); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };

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

  // Rate la datorii: aviz cu 3 zile înainte și în ziua ratei, ca banii să fie pe card (testare, M4).
  for (const debt of pendingDebtsInPlan(data).filter((item) => item.dueDate >= today).slice(0, 5)) {
    const due = new Date(`${debt.dueDate}T12:00:00`);
    const todayNoon = new Date(`${today}T12:00:00`);
    const days = Math.round((due.valueOf() - todayNoon.valueOf()) / 86_400_000);
    if (days < 0 || days > 3) continue;
    const when = days === 0 ? atLocalHour(0, 9, 0) : atLocalHour(0, 18, 30);
    if (when.getTime() <= Date.now() - 60_000) continue;
    alerts.push({
      id: id++,
      title: days === 0 ? t("Rată azi") : t("Rată în {days} zile", { days }),
      body: `${debt.name} · ${money(debt.amount)} · ${formatDate(debt.dueDate)}`,
      at: when,
      tag: `debt-${debt.id}-${debt.dueDate}`,
    });
  }

  // Plicuri aproape de prag sau depășite
  const plan = data.settings.salaryPlan;
  for (const alloc of plan.allocations || []) {
    const status = allocationStatus(data, alloc);
    if (!status) continue;
    const usage = status.usage;
    const threshold = (alloc.alertThreshold ?? 80) / 100;
    // Factura plătită exact nu e „plic epuizat”; doar plata peste sumă merită o notificare.
    if (status.fixed && status.remaining >= 0) continue;
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

  // Tranșa săptămânii se duce prea repede: o dată pe zi, seara, pentru plicul cel mai apăsat.
  const fast = weekTooFast(data, today)[0];
  const evening = atLocalHour(0, 19, 0);
  if (fast && evening.getTime() > Date.now()) {
    alerts.push({
      id: id++,
      title: fast.over ? t("Săptămâna e depășită") : t("Săptămâna merge repede"),
      body: fast.over
        ? t("{label}: {spent} din {budget} în S{index}, peste cu {amount}.", { label: fast.label, spent: money(fast.spent), budget: money(fast.budget), index: fast.weekIndex, amount: money(-fast.remaining) })
        : t("{label}: {spent} din {budget}, mai sunt {days}. Ca să ajungă: cel mult {perDay} pe zi.", { label: fast.label, spent: money(fast.spent), budget: money(fast.budget), days: daysLabel(fast.daysLeft), perDay: money(fast.perDay) }),
      at: evening,
      tag: `week-fast-${fast.allocationId}-${fast.weekIndex}`,
    });
  }

  // Duminică seara: bilanțul săptămânii, de trimis familiei.
  const sunday = (7 - new Date(`${today}T12:00:00`).getDay()) % 7;
  const summaryAt = atLocalHour(sunday, 19, 30);
  if (summaryAt.getTime() > Date.now() && data.transactions.some((item) => item.kind === "expense" && item.date >= addIsoDaysLocal(today, -7))) {
    alerts.push({ id: id++, title: t("Bilanțul săptămânii e gata"), body: t("Vezi cât ați cheltuit și trimite-l familiei."), at: summaryAt, tag: `weekly-summary-${addIsoDaysLocal(today, sunday)}` });
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
  const weeklyPacedTotal = (plan.allocations || []).filter((item) => isWeeklyPaced(item, plan)).reduce((sum, item) => sum + item.amount, 0);
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

  // Obiective de economisire cu termen (dueDate ISO sau text due când e datat)
  for (const goal of data.savings || []) {
    const dueIso = goal.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(goal.dueDate) ? goal.dueDate : undefined;
    if (!dueIso || dueIso < today) continue;
    const due = new Date(`${dueIso}T12:00:00`);
    const todayNoon = new Date(`${today}T12:00:00`);
    const days = Math.round((due.valueOf() - todayNoon.valueOf()) / 86_400_000);
    if (days < 0 || days > 7) continue;
    const remaining = Math.max(0, goal.target - goal.current);
    if (remaining <= 0) continue;
    const when = days === 0 ? atLocalHour(0, 9, 45) : atLocalHour(Math.max(0, days - 1), 18, 15);
    if (when.getTime() <= Date.now() - 60_000) continue;
    alerts.push({
      id: id++,
      title: days === 0 ? t("Termen obiectiv azi") : t("Obiectiv aproape de termen"),
      body: t("{name}: mai ai {remaining} până la {date}.", { name: goal.name, remaining: money(remaining), date: formatDate(dueIso) }),
      at: when,
      tag: `goal-due-${goal.id}-${dueIso}`,
    });
  }

  // Check-in calm de seară, doar dacă azi nu e nicio cheltuială.
  const spentToday = (data.transactions || []).some((item) => item.kind === "expense" && item.date === today);
  if (!spentToday) {
    const when = atLocalHour(0, 20, 0);
    if (when.getTime() > Date.now() - 60_000) {
      alerts.push({
        id: id++,
        title: t("Check-in de seară"),
        body: t("Nicio cheltuială înregistrată azi. Un minut de ordine e de ajuns."),
        at: when,
        tag: `checkin-${today}`,
      });
    } else {
      const tomorrow = atLocalHour(1, 20, 0);
      alerts.push({
        id: id++,
        title: t("Check-in de seară"),
        body: t("Dacă ziua trece fără nicio mișcare, îți amintesc seara — fără grabă."),
        at: tomorrow,
        tag: `checkin-next`,
      });
    }
  }

  return alerts.slice(0, 10);
}

/** Expus pentru teste: aceleași alerte ca programarea locală. */
export function buildLocalAlerts(data: AppData) {
  return buildAlerts(data).map((item) => ({ id: item.id, title: item.title, body: item.body, tag: item.tag, at: item.at.toISOString() }));
}

async function tryCapacitorSchedule(alerts: PlannedAlert[]): Promise<boolean> {
  if (!alerts.length) return false;
  try {
    if (!isNative()) return false;
    const LocalNotifications = await loadNativeNotifications();
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return false;
    await LocalNotifications.cancel({ notifications: alerts.map((a) => ({ id: a.id })) }).catch(() => undefined);
    await LocalNotifications.schedule({
      notifications: alerts.map((alert) => ({
        id: alert.id,
        title: alert.title,
        body: alert.body,
        schedule: { at: alert.at, allowWhileIdle: true },
        // Inexact: fără el, pe Android 14 fiecare programare deschidea setarea „Alarme și mementouri”.
        isExactNotification: false,
        extra: { tag: alert.tag },
      })),
    });
    return true;
  } catch {
    return false;
  }
}

async function scheduleWeb(alerts: PlannedAlert[]) {
  const permission = await getNotificationPermission();
  if (permission !== "granted" && readWebPermission() !== "granted") return;
  const now = Date.now();
  for (const alert of alerts) {
    const delta = alert.at.getTime() - now;
    if (delta < -5 * 60_000 || delta > 14 * 60 * 60_000) continue;
    try {
      window.setTimeout(() => {
        void showNow(alert.title, alert.body, alert.tag);
      }, Math.max(0, delta));
    } catch {
      /* ignore */
    }
  }
}

const FAMILY_ALERT_KEY = "buget-familie:family-envelope-alerts";
const FAMILY_TX_ALERT_KEY = "buget-familie:family-tx-alerts";

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

const readFamilyTxLog = (): Record<string, string> => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAMILY_TX_ALERT_KEY) || "{}") as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const writeFamilyTxLog = (log: Record<string, string>) => {
  try {
    const entries = Object.entries(log).slice(-80);
    window.localStorage.setItem(FAMILY_TX_ALERT_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* ignore */
  }
};

function notificationAssetUrl(file: string): string {
  const base = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/";
  const path = `${base}icons/${file}`.replace(/\/{2,}/g, "/");
  try {
    const origin = typeof window !== "undefined" ? window.location?.origin : "";
    if (origin) return new URL(path, origin).href;
  } catch {
    /* ignore */
  }
  return path;
}

async function showViaServiceWorker(title: string, body: string, tag: string): Promise<boolean> {
  try {
    const serviceWorker = navigator.serviceWorker;
    if (!serviceWorker) return false;
    const registration = (await serviceWorker.getRegistration()) || (await serviceWorker.ready.catch(() => undefined));
    if (!registration?.showNotification) return false;
    await registration.showNotification(title, {
      body,
      tag,
      icon: notificationAssetUrl("icon-192.png"),
      badge: notificationAssetUrl("notify-badge.png"),
      lang: getLocale(),
    });
    return true;
  } catch {
    return false;
  }
}

async function showNow(title: string, rawBody: string, tag: string) {
  const body = lockSafeBody(rawBody);
  const bridge = nativeReminders();
  if (bridge?.notifyNow) {
    try {
      bridge.notifyNow(title, body);
      return;
    } catch {
      /* cădem pe Capacitor / Notification API */
    }
  }
  if (isNative()) {
    try {
      const LocalNotifications = await loadNativeNotifications();
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== "granted") return;
      await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 100000) + 5000, title, body, isExactNotification: false, extra: { tag } }] });
      return;
    } catch {
      /* cădem pe Notification API */
    }
  }
  if (await showViaServiceWorker(title, body, tag)) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      tag,
      icon: notificationAssetUrl("icon-192.png"),
    });
  } catch {
    /* ignore */
  }
}

/**
 * Anunță imediat când o actualizare primită de la un alt telefon împinge un plic
 * peste pragul lui sau când altcineva din familie a adăugat o cheltuială.
 * Nu anunță propriile tale înregistrări — le vezi deja pe ecran.
 */
export async function notifyFamilyEnvelopeChanges(previous: AppData, next: AppData): Promise<void> {
  if (!isNotificationsEnabled()) return;
  const permission = await getNotificationPermission();
  if (permission === "denied" || permission === "unsupported") return;

  const me = next.settings.members.find((member) => member.name === next.settings.memberName);
  const knownIds = new Set(previous.transactions.map((item) => item.id));
  const incoming = next.transactions.filter((item) => !knownIds.has(item.id) && item.kind === "expense" && (!me || item.memberId !== me.id));
  if (!incoming.length) return;

  const day = isoToday();
  const log = readFamilyAlertLog();
  let changed = false;
  let envelopeAlerted = false;

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
    envelopeAlerted = true;

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

  const txLog = readFamilyTxLog();
  const fresh = incoming.filter((item) => !txLog[item.id]);
  if (!fresh.length) return;
  for (const item of fresh) txLog[item.id] = day;
  writeFamilyTxLog(txLog);

  /* Dacă plicul a fost deja anunțat, rezumatul de cheltuială e redundant. */
  if (envelopeAlerted) return;

  const names = Array.from(new Set(fresh.map((item) => item.person).filter(Boolean)));
  const who = names.length === 1 ? names[0] : names.length ? t("{first} și {last}", { first: names.slice(0, -1).join(", "), last: names[names.length - 1] }) : t("Un membru");
  const spent = fresh.reduce((sum, item) => sum + item.amount, 0);
  const firstTitle = fresh[0]?.title?.trim();
  if (fresh.length === 1) {
    await showNow(
      t("Cheltuială nouă în familie"),
      firstTitle
        ? t("{who} a înregistrat {spent} · {title}.", { who, spent: money(spent), title: firstTitle })
        : t("{who} a înregistrat {spent}.", { who, spent: money(spent) }),
      `family-tx-${fresh[0].id}`,
    );
    return;
  }
  await showNow(
    t("Cheltuieli noi în familie"),
    t("{who} a înregistrat {count} cheltuieli · {spent}.", { who, count: fresh.length, spent: money(spent) }),
    `family-tx-batch-${day}-${fresh[0].id}`,
  );
}

function scheduleWorkManager(alerts: PlannedAlert[]): boolean {
  if (!isNative()) return false;
  try {
    const bridge = nativeReminders();
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
  if (permission === "denied") return;

  const alerts = buildAlerts(data).map((alert) => ({ ...alert, body: lockSafeBody(alert.body) }));

  if (isNative()) {
    if (alerts.length) scheduleWorkManager(alerts);
    if (permission === "granted") await tryCapacitorSchedule(alerts);
  } else if (alerts.length) {
    await scheduleWeb(alerts);
  }

  try {
    window.localStorage.setItem(LAST_SCHEDULE_KEY, isoToday());
  } catch {
    /* ignore */
  }
}

async function pingAlertsOn() {
  await showNow(
    t("Reamintiri active"),
    t("Îți spun pe telefon când e o scadență, un plic aproape de limită sau o cheltuială adăugată de familie."),
    "alerts-on",
  );
}

/** Activează: cere permisiunea sistemului, programează, trimite o notificare de confirmare. */
export async function enableLocalAlerts(data: AppData): Promise<NotificationPref> {
  const status = await requestNotificationPermission();
  if (status === "denied") {
    setNotificationsEnabled(false);
    setNotificationsArmed(false);
    return status;
  }
  if (status === "unsupported") {
    return status;
  }

  setNotificationsEnabled(true);
  setNotificationsArmed(true);
  await scheduleFinancialReminders(data);
  await pingAlertsOn();
  if (status === "granted") return "granted";
  const again = await getNotificationPermission();
  if (again === "granted") return "granted";
  if (again === "denied") {
    setNotificationsEnabled(false);
    setNotificationsArmed(false);
    return "denied";
  }
  return "unknown";
}

export async function sendTestAlert(): Promise<boolean> {
  if (!isNotificationsEnabled()) return false;
  await showNow(
    t("Notificare de test"),
    t("Dacă vezi asta, alertele ajung pe telefon."),
    "alerts-test",
  );
  return true;
}

/** Oprește preferința locală și anulează job-urile WorkManager / Capacitor. */
export function disableLocalAlerts(): void {
  setNotificationsEnabled(false);
  setNotificationsArmed(false);
  try {
    nativeReminders()?.cancelAll?.();
  } catch {
    /* ignore */
  }
  if (!isNative()) return;
  void loadNativeNotifications()
    .then((plugin) => plugin.cancel({ notifications: [{ id: 4090 }] }))
    .catch(() => undefined);
}
