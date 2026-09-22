import { Baby, Bus, Candy, Droplets, Ellipsis, HeartPulse, House, Landmark, Repeat, ShoppingCart, Ticket, Wine, type LucideIcon } from "lucide-react";

const glyphs: Record<string, LucideIcon> = {
  "Alimente": ShoppingCart,
  "Casă & facturi": House,
  "Transport": Bus,
  "Consumabile copil": Baby,
  "Sănătate": HeartPulse,
  "Timp liber": Ticket,
  "Abonamente": Repeat,
  "Băuturi": Wine,
  "Apă": Droplets,
  "Dulciuri": Candy,
  "Rate produse": Landmark,
  "Altele": Ellipsis,
};

export function CategoryGlyph({ category, size = 16 }: { category: string; size?: number }) {
  const Icon = glyphs[category] || Ellipsis;
  return <Icon size={size} aria-hidden="true" />;
}
