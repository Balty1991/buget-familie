import { categoryColors } from "./finance-data";

/**
 * Aceeași culoare pentru o categorie peste tot. Categoriile proprii („Grădiniță Maria”) primesc
 * o culoare stabilă din numele lor, nu gri, și nu își schimbă culoarea de la o lună la alta.
 */
const EXTRA = ["#5B7FA6", "#9A6FB0", "#C0784A", "#4F8F9A", "#8C6A3D", "#6E8B3D", "#B05A6E", "#3D7A8C"];

export function categoryColor(name: string): string {
  if (categoryColors[name]) return categoryColors[name];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return EXTRA[hash % EXTRA.length];
}
