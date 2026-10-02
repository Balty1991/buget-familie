/**
 * Notarea din voce: fraza recunoscută de telefon („cincizeci de lei la Lidl”, „am dat 45,50
 * pe benzină”) se desface în sumă și denumire. Nimic nu se salvează singur: formularul se
 * completează, iar omul vede totul și apasă „Gata”. Fraza nu pleacă de pe telefon.
 */
import { spokenAmountsToDigits } from "@/lib/ro-numbers";
import { parseRomanianAmount } from "@/lib/finance-data";

export type SpokenEntry = { amount?: number; text: string; income: boolean };

/** Suma: „45,50”, „1.250”, „45 de lei și 50 de bani”; prima din frază. */
const AMOUNT = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*(?:de\s+)?(?:lei|ron|leu))?(?:\s*(?:și|si)\s*(\d{1,2})\s*(?:de\s+)?bani)?/i;
const INCOME = /^\s*(?:am\s+)?(?:primit|încasat|incasat)\b/i;
/** Cuvinte de legătură care nu fac parte din denumire, la început sau la sfârșit. */
const LEAD = /^(?:(?:am|a|au)\s+(?:dat|plătit|platit|cheltuit|luat|cumpărat|cumparat|primit|încasat|incasat)|plătit|platit|dat|cheltuit|pe|la|de|din|pentru|pt|în|in|cu|și|si|lei|ron)\b\s*/i;
const TAIL = /\s*\b(?:pe|la|de|din|pentru|pt|în|in|cu|și|si|lei|ron|azi|astăzi|astazi)$/i;

export function parseSpokenEntry(raw: string): SpokenEntry {
  const income = INCOME.test(raw);
  const text = spokenAmountsToDigits(raw.trim()).replace(/\s+/g, " ");
  const match = AMOUNT.exec(text);
  let amount: number | undefined;
  let rest = text;
  if (match) {
    const whole = parseRomanianAmount(match[1]);
    const cents = match[2] ? Number(match[2]) / 100 : 0;
    if (whole > 0) amount = Math.round((whole + cents) * 100) / 100;
    rest = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`;
  }
  rest = rest.replace(/\s+/g, " ").trim();
  for (let guard = 0; guard < 6; guard += 1) {
    const next = rest.replace(LEAD, "").replace(TAIL, "").trim();
    if (next === rest) break;
    rest = next;
  }
  rest = rest.replace(/[.,;:!?]+$/, "").trim();
  return { amount, text: rest ? rest.charAt(0).toLocaleUpperCase("ro-RO") + rest.slice(1) : "", income };
}
