/**
 * Numele comerciantului dintr-o descriere de extras („LIDL 0123 BUCURESTI RO” → „Lidl”).
 * Stă separat de importul de extrase ca ecranul Astăzi (abonamentele găsite) să nu încarce
 * tot cititorul de fișiere la pornire.
 */
import { foldRomanian } from "./finance-data";
import { t } from "./i18n";

/** Orașele care apar la coada descrierilor POS („LIDL 0123 BUCURESTI RO”). */
const CITY_TAIL = /\s+(bucuresti|bucharest|cluj[- ]?napoca|cluj|iasi|timisoara|constanta|brasov|craiova|galati|ploiesti|oradea|sibiu|arad|pitesti|bacau|suceava|baia mare|buzau|botosani|satu mare|ramnicu valcea|drobeta[- ]turnu severin|piatra neamt|targu mures|targu jiu|focsani|bistrita|tulcea|resita|slatina|calarasi|alba iulia|giurgiu|deva|hunedoara|zalau|sfantu gheorghe|slobozia|alexandria|voluntari|otopeni|popesti[- ]leordeni|chiajna|bragadiru|pantelimon|dublin|london|vilnius|amsterdam|luxembourg|sector\s*\d)$/i;

/** Bucăți care descriu felul plății sau banca, nu comerciantul. */
const MERCHANT_NOISE: RegExp[] = [
  /\b(plata|plată|cumparare|cumpărare|tranzactie|tranzacție|achizitie|achiziție|retragere(\s+numerar)?|incasare|încasare)\b(\s+(la|cu|prin|de))?(\s+(pos|comerciant|online|e-?commerce|internet|card|atm))*/gi,
  /\bnon[- ]?bt\b/gi,
  /\b(cu\s+)?card(ul)?\b(\s+(visa|mastercard|maestro|debit|credit|virtual|business))*/gi,
  /\b(visa|mastercard|maestro|contactless|e-?pos|pos|apple pay|google pay|gpay)\b/gi,
  /\b(tid|mid|rrn|autorizare|auth(orization)?|ref(erinta|erință|erence)?|nr\.?\s*card|id tranzactie|cod)\s*[:.#]\s*\S+/gi,
  /\bdata\s*[:.]\s*\S+(\s+\d{1,2}:\d{2}(:\d{2})?)?/gi,
  /\bvaloare\s+tranzac\w*\s*:?\s*[\d.,]+\s*[a-z]{0,3}/gi,
  /\b(suma|sold|comision)\b.*$/gi,
  /[\d.,]+\s*(ron|lei|eur|usd|gbp)\b/gi,
  /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g,
  /\b\d{1,2}:\d{2}(:\d{2})?\b/g,
  /\b[\dx*]{4,}\d{2,}\b|\*{2,}\d+|\b[x*]{4,}\d*/gi,
  /\b(s\.?r\.?l\.?|s\.?a\.?|s\.?c\.?s\.?|romania|românia|discount|ifn)(?=\s|$|[;,.])/gi,
  /\b(op|ordin de plat[aă])(\s+(inter|intra)(bancar)?)?\b|\bcanal electronic\b/gi,
  /(^|\s)(ro|rou|rom|lu|ie|gb|nl|us|de|fr|it|es|mt|cy|ee|lt|se|irl|gbr|nld|usa)$/i,
];

const LOWER = /[a-zăâîșțşţáéíóúäöüß]/;
const titleCase = (value: string) => value.replace(/[A-Za-zĂÂÎȘȚŞŢăâîșțşţÁÉÍÓÚÄÖÜáéíóúäöüß\d'’&.-]+/g, (word) => {
  if (LOWER.test(word)) return word;
  if (word.length <= 3 && /^[A-ZĂÂÎȘȚŞŢ]+$/.test(word) && !/^(LA|DE|SI|ȘI|CU|IN|ÎN|THE|AND|TO)$/.test(word)) return word;
  return word.charAt(0) + word.slice(1).toLocaleLowerCase("ro-RO");
});

function cleanMerchantSegment(segment: string): string {
  let text = segment.replace(/^(paypal|pp|sumup|sum up|zettle|stripe|izettle)\s*\*\s*/i, "");
  for (const pattern of MERCHANT_NOISE) text = text.replace(pattern, " ");
  // Numărul magazinului („LIDL 0123”, „KAUFLAND 5920”) nu face parte din nume.
  text = text.replace(/(^|\s)[a-z]?\d{2,}[a-z]?(?=\s|$)/gi, " ").replace(/[*#_]+/g, " ").replace(/\s+/g, " ").trim();
  for (let guard = 0; guard < 2 && CITY_TAIL.test(text); guard += 1) text = text.replace(CITY_TAIL, "").trim();
  return text.replace(/^[\s,.;:/|-]+|[\s,.;:/|-]+$/g, "").trim();
}

/**
 * Numele comerciantului dintr-o descriere de extras. Băncile pun înaintea lui felul plății, cardul,
 * terminalul, orașul și coduri („Plata la POS non-BT cu card VISA; LIDL DISCOUNT 0123 BUCURESTI RO;
 * RRN: …” → „Lidl”). Dacă nu rămâne nimic sigur, întoarce descrierea așa cum era.
 */
export function statementMerchant(description: string): string {
  const raw = description.replace(/\s+/g, " ").trim();
  if (!raw) return raw;
  if (/retragere\s+numerar|\batm\b/i.test(raw)) return t("Retragere numerar");
  const terminal = raw.match(/\bterminal\s*:\s*([^;]+?)(?=\s+(data|autorizare|nr\.?\s*card)\b|;|$)/i)?.[1];
  const segments = [terminal, ...raw.split(/[;|]|,\s+|\s+-\s+|\s{2,}/)].filter((item): item is string => Boolean(item));
  for (const segment of segments) {
    const cleaned = cleanMerchantSegment(segment);
    if (/[A-Za-zĂÂÎȘȚŞŢăâîșțşţ]{2,}/.test(cleaned) && !/^(op|transfer|ordin de plata|canal electronic|instant|intrabancar|interbancar)$/i.test(foldRomanian(cleaned))) {
      const title = titleCase(cleaned).slice(0, 60);
      return title.charAt(0).toLocaleUpperCase("ro-RO") + title.slice(1);
    }
  }
  return raw.slice(0, 80);
}
