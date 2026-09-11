/**
 * Ziua unei propuneri a asistentului, scrisă pe înțelesul cuiva care se uită la
 * ecran, nu la un ISO. Stă separat de componentă pentru că are reguli proprii
 * („azi”, „alaltăieri”, punctul abrevierii) care merită verificate singure.
 */
import { getLocale, t } from "./i18n";

export const shiftDay = (offset: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const today = () => shiftDay(0);

export function dateCopy(iso: string, asOf = today()) {
  const diff = Math.round((Date.parse(`${iso}T12:00:00`) - Date.parse(`${asOf}T12:00:00`)) / 86400000);
  if (diff === 0) return "azi";
  if (diff === -1) return "ieri";
  if (diff === -2) return t("alaltăieri");
  if (diff === 1) return t("mâine");
  return new Date(`${iso}T12:00:00`).toLocaleDateString(getLocale(), { day: "numeric", month: "short" });
}

/**
 * „3 sept.” își aduce punctul cu el, deci propoziția care îl urmează nu mai are
 * nevoie de al doilea. Prima înlocuire prinde cazul în care data e îngroșată și
 * cele două puncte sunt despărțite de asteriscuri: `**3 sept.**.`
 */
export const noDoubleStop = (text: string) =>
  text.replace(/\.\*\*\.(?!\.)/g, ".**").replace(/([^.])\.\.(?!\.)/g, "$1.");

/**
 * Mută ziua scrisă într-o propunere deja afișată. Textul poartă data într-un
 * singur loc, îngroșat, așa că schimbăm exact acel cuvânt; dacă nu îl găsim,
 * lăsăm textul neatins — mai bine nemodificat decât stricat.
 */
export const retimeText = (text: string, before: string, after: string, asOf = today()) =>
  before === after ? text : noDoubleStop(text.replace(`**${dateCopy(before, asOf)}**`, `**${dateCopy(after, asOf)}**`));
