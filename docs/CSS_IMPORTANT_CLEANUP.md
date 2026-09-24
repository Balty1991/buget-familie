# Curățenia `!important` (septembrie 2026)

**8.344 → 5.410** `!important` în `client/src/*.css` (−2.934, în 57 de foi), fără nicio schimbare
de stil calculat pe ecranele verificate. `tokens.test.ts` ține plafonul la 5.410.

## Cum s-a verificat

Aplicația reală (Vite dev, date de test) pe **154 de stări**: 22 de ecrane (Astăzi, Mișcări, Plan,
Obligații, Analiză, Scadențe, toate filele din „Mai mult”, formularul de mișcare, ghidul, acțiunile
rapide, modul simplu) × temele Alb, Întunecat, Navy, Aurora, Cyber la 390 px, plus Alb și Întunecat la
1280 px.

1. Fiecare declarație `!important` din sursă e legată de regula ei din CSSOM (aceeași foaie, același
   selector normalizat de browser). Foile încărcate de două ori (`visual-polish.css`) se schimbă
   împreună, ca în sursă.
2. Pe fiecare stare, pe rând: scoate `!important` și compară valorile calculate ale proprietăților
   declarației pe toate elementele pe care se potrivește regula. Dacă nu se schimbă nimic acolo, nu se
   schimbă nimic nicăieri; altfel regula rămâne `!important`.
3. După fiecare stare: comparație globală, toate proprietățile tuturor elementelor (și `::before`,
   `::after`), față de starea inițială. O diferență oprește tot.
4. Pași repetați doar pe setul exact care se aplică în sursă, până când niciun ecran nu mai respinge
   nimic.
5. La final: instantanee complete ale stilului calculat pe cele 154 de stări, cod vechi (de două ori, ca
   să se vadă zgomotul de încărcare) și cod nou, comparate element cu element.

Rămân `!important` (neatinse):

- declarațiile care chiar decid ceva pe ecran (774);
- cele din selectori cu stări dinamice (`:hover`, `:focus`, `:active` etc.) sau pseudo-elemente altele
  decât `::before` / `::after` — nu se pot verifica fără interacțiune;
- cele ale căror selectori au părți care nu apar pe niciun ecran testat (765 „parțiale”) și cele care nu
  s-au potrivit deloc.

Capcane găsite pe drum, bune de știut la o curățenie viitoare:

- Chrome nu recalculează stilul în subarbori săriți (`content-visibility: auto`, `<details>` închis)
  după o schimbare de regulă: `getComputedStyle` întoarce valori vechi. Verificarea le face vizibile.
- O tranziție pornită de schimbare arată încă valoarea veche; animațiile trebuie duse la capăt înainte
  de citire.
- Setul verificat trebuie să fie exact setul aplicat: două `!important` se pot „acoperi” reciproc, iar
  scoaterea doar a unuia dintre ele schimbă câștigătorul.

## Reguli moarte (septembrie 2026, pasul 2)

**5.410 → 3.819** `!important`, **1.153 KB → 927 KB** de CSS: 1.685 de reguli și 2.578 de selectori
scoși. Țintesc 263 de clase care nu mai apar nicăieri în cod (`client/src/**/*.ts(x)`,
`client/index.html`) — resturi din redesign-urile vechi (`bf-today-situation`, `bf-mobile-nav`,
`bf-decision-row`…).

- O clasă e „vie” dacă apare în cod sau dacă e compusă în cod (`s${scor}`, `theme-${id}`, `is-${stare}`).
- Clasele din interiorul `:not(…)`, `:is(…)`, `:where(…)`, `:has(…)` nu fac un selector mort:
  `:not(.clasă-inexistentă)` se potrivește peste tot (prima variantă a scriptului le-a tratat greșit și
  a schimbat Plan și Obligații — prins de comparația de mai jos, apoi reparat).
- Verificare: instantanee complete ale stilului calculat pe 154 de stări, cod vechi (de două ori) și cod
  nou; singurele 4 diferențe rămase au fost zero la verificarea directă, proprietate cu proprietate.
