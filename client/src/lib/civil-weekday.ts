/**
 * Numele zilelor pentru grila luni–duminică.
 *
 * `new Date(Date.UTC(2024, 0, 1))` este luni la miezul nopții UTC, dar în
 * Los Angeles este încă duminică. Formatarea acelei clipe, fără fus, muta
 * toată banda cu o zi pentru diaspora. 1 ianuarie 2024 la amiază UTC este luni
 * în orice fus între −12 și +12, iar `timeZone: "UTC"` îngheață ziua.
 */
const labelsByLocale = new Map<string, string[]>();
export function weekdayShortLabels(locale: string): string[] {
  // Șapte formattere Intl la fiecare apel costau ~170 ms pe randarea benzii de zile.
  const known = labelsByLocale.get(locale);
  if (known) return known;
  const labels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(2024, 0, 1 + index, 12)))
      .replace(".", ""),
  );
  labelsByLocale.set(locale, labels);
  return labels;
}
