/**
 * Traducerea interfeței, cu textul românesc drept cheie.
 *
 * Alegerea nu este întâmplătoare: aplicația este scrisă integral în română, iar o
 * migrare pe chei simbolice ar fi cerut atingerea fiecărui șir dintr-o dată, cu riscul
 * de a rupe ecrane întregi. Așa, `t("Adaugă mișcare")` întoarce textul original cât timp
 * nu există traducere, deci interfața nu se poate strica: în cel mai rău caz un text
 * rămâne în română până îl trec în dicționar.
 *
 * Limba curentă stă și în afara React-ului, pentru că sugestiile, alertele locale și
 * rapoartele sunt generate în `lib/`, unde nu există hook-uri.
 */
import { safeSetItem } from "@/lib/safe-storage";

export type Lang = "ro" | "en";

export const languages: Array<{ id: Lang; label: string; locale: string }> = [
  { id: "ro", label: "Română", locale: "ro-RO" },
  { id: "en", label: "English", locale: "en-GB" },
];

const STORAGE_KEY = "buget-familie:language";

const readStored = (): Lang => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ro";
  } catch {
    return "ro";
  }
};

let current: Lang = typeof window === "undefined" ? "ro" : readStored();
// `lang` trebuie pus și la pornire, nu doar la comutare: altfel cititoarele de ecran și
// despărțirea în silabe rămân pe română într-o interfață englezească.
if (typeof document !== "undefined") document.documentElement.lang = current;
const listeners = new Set<(lang: Lang) => void>();
let english: Record<string, string> | null = null;
let englishLoad: Promise<void> | undefined;

const notifyLanguage = () => listeners.forEach((listener) => listener(current));

/** Dicționarul englez e un pachet separat. Româna, limba implicită, nu îl descarcă. */
export function loadEnglishDictionary(): Promise<void> {
  if (english) return Promise.resolve();
  englishLoad ??= import("./i18n-en")
    .then((module) => {
      english = module.en;
      if (current === "en") notifyLanguage();
    })
    .catch(() => {
      englishLoad = undefined;
    });
  return englishLoad ?? Promise.resolve();
}

if (typeof window !== "undefined" && current === "en") void loadEnglishDictionary();

export const getLanguage = () => current;
export const getLocale = () => languages.find((item) => item.id === current)?.locale || "ro-RO";

export function setLanguage(lang: Lang) {
  if (lang === current && (lang !== "en" || english)) return;
  const changed = lang !== current;
  current = lang;
  if (changed) {
    safeSetItem(window.localStorage, STORAGE_KEY, lang);
    try {
      document.documentElement.lang = lang;
    } catch {
      /* ignore */
    }
    notifyLanguage();
  }
  if (lang === "en") void loadEnglishDictionary();
}

export function subscribeLanguage(listener: (lang: Lang) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Traduce un text. Acceptă înlocuiri simple, `{nume}`, ca frazele cu cifre să poată fi
 * reordonate în engleză fără a sparge propoziția în bucăți.
 */
export function t(source: string, vars?: Record<string, string | number>): string {
  const translated = current === "ro" || !english ? source : english[source] ?? source;
  if (!vars) return translated;
  return translated.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/**
 * Numărătoare la plural, cu regula românească: „1 mișcare”, „3 mișcări”, „21 de mișcări”.
 * Fără ea, ecranul scria „1 mișcări” chiar pe primul rând al registrului.
 */
export const countLabel = (count: number, forms: { one: string; few: string; many: string }) => {
  const whole = Math.abs(Math.round(count));
  const rest = whole % 100;
  const form = whole === 1 ? forms.one : whole !== 0 && (rest === 0 || rest >= 20) ? forms.many : forms.few;
  return t(form, { count });
};

/** Formele gata scrise pentru numărătorile care apar peste tot în interfață. */
export const daysLabel = (count: number) => countLabel(count, { one: "{count} zi", few: "{count} zile", many: "{count} de zile" });
export const monthsLabel = (count: number) => countLabel(count, { one: "{count} lună", few: "{count} luni", many: "{count} de luni" });
export const envelopesLabel = (count: number) => countLabel(count, { one: "{count} plic", few: "{count} plicuri", many: "{count} de plicuri" });
export const movesLabel = (count: number) => countLabel(count, { one: "{count} mișcare", few: "{count} mișcări", many: "{count} de mișcări" });

/** Formatare de sumă și dată în limba activă. Moneda registrului rămâne leul. */
export const moneyFormat = (value: number, options: Intl.NumberFormatOptions = { maximumFractionDigits: 0 }) =>
  new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", ...options }).format(Number.isFinite(value) ? value : 0);

export const dateFormat = (iso: string | undefined, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) => {
  if (!iso) return t("Nespecificat");
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? iso : new Intl.DateTimeFormat(getLocale(), options).format(date);
};

export default t;
