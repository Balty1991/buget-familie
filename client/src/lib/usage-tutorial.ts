/**
 * Pașii tutorialului de folosire — texte sursă românești, afișate prin t().
 * Nu e turul Calm / Prima săptămână: e manualul la care te întorci.
 */

export const USAGE_TUTORIAL_EVENT = "buget-familie:open-usage-tutorial";

export type UsageAction = "today" | "plan" | "journal" | "review" | "sync" | "ghid";

export type UsageLesson = {
  id: string;
  kicker: string;
  title: string;
  how: string;
  nav: string;
  paragraphs: string[];
  action?: { label: string; go: UsageAction };
};

export const USAGE_LESSONS: UsageLesson[] = [
  {
    id: "today",
    kicker: "01 · ASTĂZI",
    title: "Cifra mare nu e soldul cardului",
    how: "Pe Astăzi, cifra de sus e cât poți folosi azi. „Cum se citește?” deschide formula.",
    nav: "Astăzi",
    paragraphs: [
      "Pe Astăzi vezi cât poți folosi azi ca să ajungi la următorul venit fără să golești plicurile. Nu e ce scrie banca.",
      "„Cum se citește?” deschide formula: lichid, minus scadențe, minus ritmul plicurilor. Plusul de jos notează o mișcare reală, cu data de azi.",
    ],
    action: { label: "Mergi pe Astăzi", go: "today" },
  },
  {
    id: "capture",
    kicker: "02 · CAPTURĂ",
    title: "Notează când se întâmplă, nu seara",
    how: "Plusul de jos. Sumă, magazin, categorie. Salvează. Atât.",
    nav: "Captură",
    paragraphs: [
      "Sumă, magazin, categorie. Dacă ai un plic pe acea categorie, se alege singur. Dacă nu — taxi fără plic de Transport, de exemplu — cheltuiala rămâne în afara plicurilor. Nu mănâncă mâncarea.",
      "Poți alege alt plic sau altă săptămână (S1, S2). Dacă săptămâna aleasă nu are destui bani, aplicația refuză salvarea în loc să scrie pe altă tranșă.",
    ],
    action: { label: "Deschide Mișcări", go: "journal" },
  },
  {
    id: "envelopes",
    kicker: "03 · PLICURI",
    title: "Plicul e o limită, nu un cont",
    how: "În Plan așezi sumele. S1 și S2 sunt săptămânile până la salariu, nu lunile din calendar.",
    nav: "Plicuri",
    paragraphs: [
      "Banii stau în surse (card, cash, tichete). Plicul spune cât poți cheltui din ele pe un scop, până la salariu.",
      "În Plan așezi sumele și ritmul săptămânal. Tranșele S1, S2 sunt săptămânile ciclului, nu lunile calendaristice. Mutările între săptămâni se văd în Istoric plicuri.",
    ],
    action: { label: "Deschide Planul", go: "plan" },
  },
  {
    id: "review",
    kicker: "04 · DE VERIFICAT",
    title: "Nimic nu intră în registru fără tine",
    how: "Bon sau extras CSV (BCR, BT, ING, Revolut) ajung aici. Confirmi, abia apoi se scrie.",
    nav: "De verificat",
    paragraphs: [
      "Bon fotografiat sau extras CSV (BCR, BT, ING, Revolut) ajung aici ca propuneri. Confirmi denumirea, categoria și plicul — abia atunci se scrie mișcarea.",
      "Pozele rămân pe telefon. Partenerul vede un rezumat, nu fotografia, și nu poate confirma în locul tău.",
    ],
    action: { label: "Deschide De verificat", go: "review" },
  },
  {
    id: "family",
    kicker: "05 · FAMILIE",
    title: "Un telefon sau două, aceeași casă",
    how: "Sync e opțional. O parolă de familie, minimum 12 caractere, identică pe fiecare telefon.",
    nav: "Familie",
    paragraphs: [
      "Poți ține registrul doar pentru tine. Membrii în plus sunt opționali: cine a plătit, din ce sursă, personal sau comun.",
      "Sincronizarea e o parolă de familie de minimum 12 caractere, identică pe fiecare telefon — nu un cont Google. Cine știe parola poate intra în cameră. Pe Astăzi, „Cine a mișcat banii” arată ciclul, nu ultimele rânduri locale.",
    ],
    action: { label: "Deschide Sync", go: "sync" },
  },
  {
    id: "guide",
    kicker: "06 · GHID",
    title: "Scrie ca la masă: „taxi 20 lei”",
    how: "Deschide ghidul și scrie o frază scurtă. Alege plicul, apoi salvează.",
    nav: "Ghid",
    paragraphs: [
      "Ghidul (bula din bara de sus) înțelege fraze scurte. Alege plicul și săptămâna, apoi salvează. După salvare, mișcarea e în Istoric, nu rămâne pe ecran.",
      "La dubiu, ghidul întreabă. Registrul nu pleacă pe net; doar un rezumat, și doar dacă local n-a înțeles.",
    ],
    action: { label: "Deschide ghidul", go: "ghid" },
  },
];

export const USAGE_GLOSSARY: Array<{ term: string; meaning: string }> = [
  {
    term: "Plic",
    meaning: "Nu e un cont bancar. E o limită pe care ți-o pui pentru o categorie. Banii stau în surse; plicul spune cât poți cheltui din ele pe acel scop.",
  },
  {
    term: "Reper",
    meaning: "Nu e soldul din bancă. E ritmul zilei din plan — cât e prudent să folosești azi ca să ajungi la următorul venit.",
  },
  {
    term: "Sursă",
    meaning: "Unde stau banii reali: card, cash, bonuri de masă. Soldul se calculează aici.",
  },
  {
    term: "Ciclu",
    meaning: "De la începutul planului până la următorul salariu, nu neapărat luna calendaristică.",
  },
  {
    term: "În afara plicurilor",
    meaning: "Scade doar soldul sursei. Nu atinge nicio limită de categorie. Folosește-o pentru cheltuieli fără plic potrivit.",
  },
];

export const openUsageTutorial = () => {
  window.dispatchEvent(new Event(USAGE_TUTORIAL_EVENT));
};
