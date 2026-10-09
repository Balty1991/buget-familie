/**
 * Ce de pe un bon ține o lună: tot ce nu e mâncare sau băutură (hârtie igienică, gel de duș,
 * detergent, hăinuțe, jucării, hrana animalelor). La „Cumpărătură pentru toată luna”, suma lor se
 * completează singură; mâncarea, băuturile, SGR-ul și sacoșa rămân pe săptămâna cumpărăturilor.
 */
import { foldRomanian } from "./finance-data";

/** Categoriile care se consumă în săptămâna cumpărăturilor. */
const WEEKLY = new Set(["Alimente", "Dulciuri", "Apă", "Băuturi", "SGR", "Sacoșe"]);
/** Cititorul de bonuri trece des hrana animalelor la Alimente: după nume, merge pe toată luna. */
const PET_FOOD = /\b(pisic|caine|caini|catel|whiskas|friskies|pedigree|purina|felix|sheba|gourmet|perfect fit|royal canin|one (jun|adult|kitten|pisica|caine))/;
/** Nume de articole care nu sunt mâncare, oricum le-ar fi pus categoria. */
const NON_FOOD = /\b(detergent|ariel|persil|lenor|perwoll|balsam de rufe|hartie igienica|h\.? ?ig\b|igienic|celuloza|\d+ ?role\b|servetel|prosop de hartie|sapun|sap\.? ?lichid|rez\.? ?sap|gel\b|gel de dus|sampon|pasta de dinti|periuta|deodorant|odorizant|scutec|pampers|huggies|servetele umede|burete|fairy|domestos|clor|saci menaj|folie alimentara|jucari|hainut|ciorap|tricou)/;
/* Bonurile prescurtează: „CODY H.IG.CELULOZA … 10ROLE” e hârtie igienică, „TEO REZ.SAP.LICHID” e săpun lichid. */

export const isMonthLong = (line: { label?: string; category?: string }) => {
  const text = foldRomanian(line.label || "");
  if (PET_FOOD.test(text) || NON_FOOD.test(text)) return true;
  return !WEEKLY.has(line.category || "Alimente");
};

/** Suma articolelor care țin o lună și numele lor, ca omul să vadă ce s-a pus. */
export const monthLongPart = (lines: Array<{ label?: string; category?: string; amount: number }>) => {
  const picked = lines.filter((line) => line.amount > 0 && isMonthLong(line));
  return { amount: Math.round(picked.reduce((sum, line) => sum + line.amount, 0) * 100) / 100, labels: picked.map((line) => line.label || line.category || "").filter(Boolean) };
};
