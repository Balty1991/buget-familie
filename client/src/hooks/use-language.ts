/**
 * Limba activă, ca stare React. Sursa de adevăr rămâne modulul `i18n`, pentru că
 * texte sunt generate și în afara componentelor; hook-ul doar re-randează arborele
 * atunci când limba se schimbă.
 */
import { useCallback, useSyncExternalStore } from "react";
import { getLanguage, setLanguage, subscribeLanguage, type Lang } from "@/lib/i18n";

export function useLanguage(): [Lang, (lang: Lang) => void] {
  const lang = useSyncExternalStore(
    (notify) => subscribeLanguage(() => notify()),
    getLanguage,
    () => "ro" as Lang,
  );
  const change = useCallback((next: Lang) => setLanguage(next), []);
  return [lang, change];
}
