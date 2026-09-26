import { categoryColors } from "./finance-data";

/**
 * Aceeași culoare pentru o categorie peste tot. Categoriile proprii („Grădiniță Maria”) primesc
 * o culoare stabilă din numele lor, nu gri, și nu își schimbă culoarea de la o lună la alta.
 */
/** Culori pentru categoriile proprii, altele decât cele de bază (înainte „Copii” primea culoarea Transportului). */
const EXTRA = ["#9C4F9E", "#2F7F9E", "#B8653A", "#4F9A6E", "#7E6BC4", "#B3486A", "#8A7A2E", "#3F6E8C"];

export function categoryColor(name: string): string {
  if (categoryColors[name]) return categoryColors[name];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return EXTRA[hash % EXTRA.length];
}
