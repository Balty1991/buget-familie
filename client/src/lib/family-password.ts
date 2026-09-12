/**
 * Cât de solidă este parola de familie.
 *
 * Parola nu protejează doar conținutul — din ea se derivă și identificatorul
 * camerei de sincronizare. Cine îl află poate suprascrie pachetul familiei, chiar
 * fără să-l poată citi. O lungime de 12 caractere nu spune nimic despre asta:
 * „123456789012” are 12 caractere și se ghicește instantaneu.
 *
 * Nu cerem simboluri și majuscule — regulile de felul acesta produc „Parola1!”,
 * care e slabă. Măsurăm cât de greu e de ghicit: câte feluri de caractere,
 * câte caractere distincte, și dacă nu e cumva un tipar cunoscut.
 */

export type PasswordVerdict = {
  ok: boolean;
  /** 0–4: prea slabă, slabă, acceptabilă, bună, foarte bună. */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  /** Ce ar face-o mai bună; gol când e deja bună. */
  advice: string[];
};

const MIN_LENGTH = 12;

/** Tipare pe care un atacator le încearcă primele. */
const WEAK_PATTERNS: Array<[RegExp, string]> = [
  [/^(.)\1+$/, "Un singur caracter repetat se ghicește imediat."],
  [/^(..?.?.?)\1+$/, "Un grup scurt repetat se ghicește imediat."],
  [/^\d+$/, "Numai cifre — încearcă și cuvinte."],
  [/(012|123|234|345|456|567|678|789|890)/, "Conține cifre în șir."],
  [/(abc|bcd|cde|def|qwe|wer|ert|asd|sdf|zxc)/i, "Conține litere alăturate pe tastatură."],
];

/** Cuvinte pe care oricine le încearcă primele, în română și în engleză. */
const COMMON = [
  "parola", "password", "parolamea", "bugetfamilie", "familia", "familie", "acasa",
  "qwerty", "asdfgh", "iloveyou", "letmein", "admin", "welcome", "123456", "secret",
  "bucuresti", "romania", "dragoste", "copilul", "familiamea", "banii", "buget",
];

/** Zile de naștere și ani scriși la rând: 01011990, 1990, 2024… */
const looksLikeDate = (value: string) => /(19|20)\d{2}/.test(value) && value.replace(/\D/g, "").length >= 6;

export function checkFamilyPassword(raw: string): PasswordVerdict {
  const value = raw.trim();
  const advice: string[] = [];

  if (value.length < MIN_LENGTH) {
    return {
      ok: false,
      score: 0,
      label: "Prea scurtă",
      advice: [`Mai adaugă ${MIN_LENGTH - value.length} caractere: minimul este ${MIN_LENGTH}.`],
    };
  }

  const folded = value.toLocaleLowerCase("ro-RO");
  const distinct = new Set(value).size;
  const families = [/[a-zăâîșț]/i.test(value), /[A-ZĂÂÎȘȚ]/.test(value), /\d/.test(value), /[^0-9A-Za-zĂÂÎȘȚăâîșț]/.test(value)]
    .filter(Boolean).length;

  for (const [pattern, message] of WEAK_PATTERNS) {
    if (pattern.test(value)) advice.push(message);
  }
  const common = COMMON.find((word) => folded.includes(word));
  if (common) advice.push(`Conține „${common}”, un cuvânt pe care oricine îl încearcă printre primele.`);
  /**
   * „Cuvânt evident + câteva cifre” este chiar prima formă pe care o încearcă un
   * atacator. „bugetfamilie2024” are 16 caractere și patru feluri de semne, deci
   * trecea de punctaj — dar tot ce rămâne după cuvânt sunt patru cifre.
   */
  const rest = common ? folded.replace(common, "") : "";
  const commonDominates = Boolean(common) && (rest.length < 8 || /^\d*$/.test(rest));
  if (looksLikeDate(value)) advice.push("Pare să conțină o dată; datele familiei se ghicesc ușor.");
  if (distinct < 6) advice.push("Folosește mai multe caractere diferite.");
  if (families < 2) advice.push("Amestecă litere cu cifre sau cu un semn.");

  /**
   * Punctajul pleacă de la lungime și de la varietate, iar fiecare slăbiciune
   * găsită îl coboară. O parolă lungă și variată trece chiar dacă e formată din
   * cuvinte obișnuite: „pisicaVerdeSareGardul7” e mai bună decât „P@rola1234”.
   */
  let score = 0;
  if (value.length >= MIN_LENGTH) score += 1;
  if (value.length >= 16) score += 1;
  if (families >= 2) score += 1;
  if (distinct >= 10) score += 1;
  score = Math.max(0, Math.min(commonDominates ? 1 : 4, score - advice.length)) as 0 | 1 | 2 | 3 | 4;

  const labels = ["Prea slabă", "Slabă", "Acceptabilă", "Bună", "Foarte bună"];
  return {
    ok: score >= 2,
    score: score as PasswordVerdict["score"],
    label: labels[score],
    advice: score >= 3 ? [] : advice.length ? advice : ["Fă-o mai lungă sau amestecă mai multe feluri de caractere."],
  };
}


/** Generează o parolă de propoziție (afișată o singură dată pe ecranul Sync). */
export function generateFamilyPassword(): string {
  const words = [
    "pisica", "gardul", "verde", "sare", "cafea", "ploaia", "muntele", "carte",
    "fereastra", "soarele", "norul", "copacul", "strada", "lacul", "vântul", "podul",
  ];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const a = pick();
    let b = pick();
    let c = pick();
    while (b === a) b = pick();
    while (c === a || c === b) c = pick();
    const n = Math.floor(10 + Math.random() * 89);
    const phrase = `${a}${b[0].toUpperCase()}${b.slice(1)}${c[0].toUpperCase()}${c.slice(1)}${n}`;
    const candidate = phrase.length >= 12 ? phrase : `${phrase}Podul${n}`;
    if (checkFamilyPassword(candidate).ok) return candidate;
  }
  return "pisicaVerdeSareGardul7";
}
