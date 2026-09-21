/**
 * Ce a învățat aplicația de la om, adunat într-un singur loc.
 *
 * Învățarea nevăzută nu se simte ca inteligență, ci ca ghicit. Asistentul reține de mult
 * unde pui de obicei cumpărăturile de la un magazin, iar regulile de magazin scriu același
 * lucru pe față — dar niciuna dintre ele nu se putea citi sau șterge. Aici sunt amândouă,
 * în aceeași listă, cu butonul de uitare lângă fiecare.
 */
import { type AppData, type MerchantRule } from "./finance-data";
import { type GuideMemory, type PhraseHabit } from "./understand";

const MEMORY_KEY = "buget-familie:ai-memory-v1";

export type LearnedRule = {
  id: string;
  /** „regulă” e scrisă de om și se sincronizează; „obicei” e învățat din alegeri, pe telefon. */
  kind: "rule" | "habit";
  match: string;
  category?: string;
  allocationId?: string;
  allocationLabel?: string;
  sourceId?: string;
  sourceLabel?: string;
  /** De câte ori a ales omul la fel. Doar la obiceiuri. */
  count?: number;
  lastAt?: string;
};

const nume = (data: AppData, allocationId?: string) =>
  data.settings.salaryPlan.allocations.find((item) => item.id === allocationId)?.label;
const sursa = (data: AppData, sourceId?: string) =>
  data.settings.paymentSources.find((item) => item.id === sourceId)?.name;

/** Obiceiurile se arată doar după ce s-au repetat: o singură alegere nu e o regulă. */
export const HABIT_MIN = 2;

export function learnedRules(data: AppData, memory: GuideMemory): LearnedRule[] {
  const rules: LearnedRule[] = (data.settings.merchantRules || []).map((item: MerchantRule) => ({
    id: item.id,
    kind: "rule" as const,
    match: item.match,
    category: item.category,
    allocationId: item.allocationId,
    allocationLabel: nume(data, item.allocationId),
  }));
  const habits: LearnedRule[] = (memory.phrases || [])
    .filter((item: PhraseHabit) => item.count >= HABIT_MIN)
    .sort((left, right) => right.count - left.count || right.lastAt.localeCompare(left.lastAt))
    .map((item) => ({
      id: item.key,
      kind: "habit" as const,
      match: item.title || item.key,
      category: item.category,
      allocationId: item.allocationId,
      allocationLabel: nume(data, item.allocationId),
      sourceId: item.sourceId,
      sourceLabel: sursa(data, item.sourceId),
      count: item.count,
      lastAt: item.lastAt,
    }));
  return [...rules, ...habits];
}

/** Uitarea unei reguli scrise: pleacă din registru, deci și de pe celălalt telefon. */
export function forgetRule(data: AppData, id: string): AppData {
  const rules = data.settings.merchantRules || [];
  if (!rules.some((item) => item.id === id)) return data;
  return { ...data, settings: { ...data.settings, merchantRules: rules.filter((item) => item.id !== id) } };
}

/** Uitarea unui obicei: e ținut minte pe telefonul ăsta, deci tot de aici pleacă. */
export function forgetHabit(memory: GuideMemory, key: string): GuideMemory {
  return { ...memory, phrases: (memory.phrases || []).filter((item) => item.key !== key) };
}

export function readGuideMemory(): GuideMemory {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MEMORY_KEY) || "null") as Partial<GuideMemory> | null;
    return { phrases: Array.isArray(parsed?.phrases) ? parsed!.phrases! : [], skippedOnline: Number(parsed?.skippedOnline) || 0 };
  } catch {
    return { phrases: [], skippedOnline: 0 };
  }
}

export function writeGuideMemory(memory: GuideMemory): void {
  try {
    window.localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // Fără localStorage, obiceiurile se uită oricum la închiderea aplicației.
  }
}
