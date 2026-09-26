# Buget Familie: audit de design UI/UX (26.09.2026, v1.1.96, commit 1935b14)

**Perspectivă:** designer senior de produs pentru aplicații fintech (Monzo, Revolut, YNAB, Copilot Money).

**Metodă:**
- Am rulat aplicația locală (http://127.0.0.1:5174) cu o familie realistă: Andrei și Maria, 2 salarii (5.200 + 3.400), 7 plicuri (Mâncare săptămânal), 4 scadențe (una anuală, RCA), 2 datorii, 2 obiective și 3 luni de istoric.
- Am făcut capturi pentru 16 ecrane și foi, în temele Alb, Întunecat și Navy, la 390×844 (cu derulare pe tot ecranul) și la 1280×900. Am adăugat stările goale, first-run, detaliul unui plic și formularul „+ Plic”.
- Am măsurat contrastul WCAG, textul sub 12 px, țintele sub 44 px și cifrele randate cu serif. Am citit CSS-ul și TSX-ul relevant.

**Capturi:** `/tmp/claude-0/-home-user-buget-familie/6251941a-2f52-5fdd-bb21-2d9641b66e0b/scratchpad/agenti/design/`. În raport, prescurtarea `S/` înseamnă acest director.
- `S/shots/<ecran>-<temă>-<m|d>[-sN].png`: `m` = mobil, `d` = desktop, `sN` = pagina N a derulării.
- `S/mont/*.png`: planșe cu 3 capturi alăturate.
- Scripturile se pot rula din nou: `cap2.mjs` / `cap3.mjs` (capturi), `measure.mjs` (contrast, text mic, ținte), `probe3.mjs` (culori exacte), `empty.mjs` (stări goale și first-run), `env.mjs` (detaliu plic).

---

## 1. Pe scurt

**Nota de design: B− (7/10).** Față de auditul anterior (C+, 6/10) s-a câștigat un punct.

**Ce s-a schimbat de la auditul anterior:**
- Structura s-a reparat vizibil. Dock-ul are acum „Astăzi · Plicuri · ＋ Notează · Mișcări · Mai mult”, iar Notează pune suma întâi.
- Lista de plicuri apare prima și e grupată pe Fixe / Variabile / Economii. Plicul are burn-down și banda de tranșe S1–S5, iar „Cum se citește?” are o cascadă.
- Fonturile sunt reparate (fiecare nume de font acoperă un singur font, cu `swap`), iar stările goale sunt bune.
- Pagina Plicuri a scăzut de la 12.300 la 5.200 px.

**Ce o ține departe de „cea mai frumoasă aplicație de buget”:**
1. **Cifra zilei încă se contrazice.** Pe același ecran și în plic apar trei cifre diferite pentru „cât pot azi”: 48,05, 80,15 și „cam 48,05 pe zi”. În plus, Chirie apare simultan „Plătit” (plic), „Întârziată” (Astăzi, Obligații) și „azi” (Ghid).
2. **Temele scapă culori.** În tema Alb apare un bloc închis la culoare, cu text negru (contrast 2,5:1). Roșul pentru „întârziat” are 2,6–2,9:1 pe Întunecat și Navy. Pe Navy, titlul are accentul mint al temei Întunecat.
3. **Sistemul vizual e încă stratificat.** Sunt 80 de fișiere CSS și 2.296 de `!important`, față de țintele de sub 25 de fișiere și sub 50 de `!important`. Pe același card, sumele sunt când serif, când sans. Apar în continuare kickere uppercase pe aproape fiecare card, carduri în carduri și bare laterale colorate.
4. **Desktopul e tot „mobil întins”.** O singură coloană de ~1.050 px, un buton „Notează” de 500 px, taburile sus în altă ordine decât pe mobil și o fâșie de 24 px care acoperă conținutul jos.
5. **Mai multe buguri vechi (P0/P1 din auditul trecut) sunt încă acolo:**
   - checkbox-ul nativ „venituri neregulate”, cu textul lipit;
   - acordeoanele fără chevron;
   - pill-ul „7 plicuri” cu jumătatea goală;
   - data eroului pe 3 rânduri;
   - donutul cu 3 verzi identici;
   - „Ritm lună cu lună” îngust, cu etichetele „I I A S”;
   - tabelul de abonamente cu suma la stânga;
   - „Înapoi la instrumente” în conținut.

---

## 2. Verificarea auditului anterior (docs/raport-agenti-2026-09/design-report.md)

| Propunere anterioară | Stare acum | Dovadă |
|---|---|---|
| Stiva de fonturi reparată, `font-display: swap` | ✅ Făcut. Fiecare nume acoperă un singur font. | `client/src/fonts-local.css` |
| Serif scos din cifre | ❌ Nu. Serif-ul e acum pus *intenționat* pe sume: Plex Serif pe plicuri și Analiză, Fraunces pe chip-urile zilelor. Pe același ecran, sumele Mișcări, eroul și Intrat/Ieșit sunt sans. | `measure.mjs`: 11 sume serif pe Plicuri, 8 pe Analiză, 5 pe Astăzi. `household-os-today.css:98`, `deferred-atelier.css:309,317` |
| Dock nou cu ＋ central, Obligații/Analiză în „Mai mult” | ✅ Făcut pe mobil | `S/shots/today-white-m.png` |
| „Mai mult” ca foaie, listă grupată fără bare laterale | ❌ Tot pagină, cu hero „Mai mult”, card în card și bare laterale de 3 px | `S/shots/mai-white-m.png`, `S/mont/navy-3.png` |
| Sidebar desktop, layout pe 2 coloane, fără dock | ⚠️ Parțial. Dock-ul e ascuns și taburile sunt sus, dar conținutul e o coloană de 1.050 px. | `S/shots/today-white-d.png` |
| Plicuri: lista pe primul ecran, „+ Plic” în foaie | ⚠️ Lista e prima ✅. „+ Plic” deschide un formular *inline* lung, nu o foaie. Configurarea (ritm, perioadă, repartizare, transfer) e tot sub listă. | `S/mont/plicuri-w-4-6.png`, `S/mont/env.png` |
| Un singur chip de stare, Fixe vs Variabile | ✅ Făcut (PLĂTIT / DE PLĂTIT / ÎN RITM / ATENȚIE) | `S/shots/plicuri-white-m-s1.png` |
| Checkbox-ul „venituri neregulate” devine Switch | ❌ Tot nativ, de 22 px, cu textul lipit: „(PFA, freelancer)Fără dată de salariu” | `S/mont/plicuri-w-4-6.png` (mijloc); `PlanStudio.tsx:717` |
| `Disclosure` cu chevron pe toate acordeoanele | ❌ „Alege ritmul casei.”, „Unelte: propunere…”, „Plic nou”, „Simulează o plată în plus” și „Ce plătim lunar…” sunt carduri albe fără chevron | `S/mont/plicuri-w-4-6.png`, `S/mont/obl-w-a.png` |
| Pill-ul „7 plicuri · 6.850 RON” cu jumătate goală | ❌ Încă gol în stânga | `S/mont/plicuri-w-4-6.png` (mijloc, sus) |
| Mișcări: listă plată, swipe cu Undo, 8 rânduri pe ecran | ⚠️ Swipe-ul există (`lib/swipe-delete.ts`), dar coșul e tot pe fiecare rând. Fiecare zi e tot un card separat. Pe primul ecran se văd 3 rânduri, iar ~400 px sunt filtre. | `S/shots/miscari-white-m.png` |
| Totalul zilei și rândul în același format | ❌ „−145 RON” (antet) vs „−145,00 RON” (rând) | `S/mont/misc-w.png` |
| Notează: sumă întâi, un ecran | ✅ Făcut. „Cheltuială” nu mai e roșu. | `S/shots/noteaza-white-m.png` |
| Roșu doar pentru depășit | ⚠️ Mișcări e neutru ✅. „Ultimele mișcări” pe Astăzi e tot roșu, la fel „Ieșit” și toate Δ-urile din Analiză (+9,07 RON e roșu). | `S/shots/today-white-m-s3.png`, `S/shots/analiza-white-m.png` |
| Date erou pe o linie | ❌ Tot „26 / SEPTEMBRIE / 2026” pe 3 rânduri | `S/shots/today-white-m.png` |
| Alerta integrată în erou | ❌ Banner separat deasupra, plus un link „Încă o alertă…” | idem |
| Cascada „cifra zilei” | ✅ Există, dar cu o etichetă greșită (vezi D2) | `S/shots/citeste-white-m.png` |
| Burn-down plic, bandă de tranșe, marcaj „azi” | ✅ Făcut | `S/mont/env.png` (stânga) |
| Paletă categorială stabilă | ⚠️ Există `categoryColor()`, dar paleta are 3 verzi aproape identici și coliziuni (vezi D8) | `lib/finance-data.ts:214`, `lib/category-color.ts` |
| Ritm lună cu lună pe toată lățimea, etichete „iun iul” | ❌ Tot ~25 % din lățime, cu etichetele „I I A S” | `S/mont/an-w-b.png` |
| Un singur rând de filtre în Analiză | ❌ Tot 4 straturi: tab-uri, select de lună, Lună/Ciclu, Familie/Andrei/Maria, Toate/Comun/Personal | `S/mont/an-w-a.png` |
| Abonamente: numele la stânga, suma la dreapta | ❌ Neschimbat | `S/shots/obligatii-white-m.png` |
| „Confirmă plata”: icon inline | ❌ Iconul e tot deasupra textului | `S/mont/obl-w-a.png` |
| Ținte de 44 px la rate | ✅ Zona de atingere e extinsă cu `::after` (`display-fixes-pass.css:149`) | — |
| Setări: app-bar „‹ Setări”, fără „Înapoi la instrumente” | ❌ Tot hero-ul „Mai mult” plus butonul „Înapoi la instrumente” pe fiecare sub-pagină | `S/mont/misc-b.png` |
| Logo „on-dark” pe temele închise | ❌ Tot dala crem, care strălucește pe Navy și Întunecat | `S/shots/today-navy-m.png` |
| Căutare: iconițe de categorie la mișcări | ❌ Tot iconița „document” pe toate | `S/shots/cauta-white-m.png` |
| Ghid: bara „100/100 azi”, chip-uri tăiate | ❌ Neschimbate | `S/shots/ghid-white-m.png` |
| Aurora, Cyber, 3 texturi scoase; „Urmează telefonul” | ✅ Făcut (commit bebc2b9, 3a25273) | — |
| Micro-animații: count-up, umplere plic, bifă desenată, View Transitions | ✅ Făcut (`motion.css`, `useCountUp.ts`, `useThemeChrome.ts`). Haptice: ❌ nu există. | — |
| CSS consolidat: sub 25 de fișiere, sub 50 de `!important` | ❌ 80 de fișiere, 2.296 de `!important` (erau 117 și 2.403) | `grep -c important client/src/*.css` |
| Stări goale | ✅ Bune (Astăzi „Trei pași”, plicul ilustrat, Mișcări) | `S/mont/empty-a.png` |

**Concluzie:** cam jumătate din propuneri sunt făcute, și anume cele care cereau funcții noi. Cele de *finisaj*, care costă puțin (chevron, switch, pill gol, format de sumă, date pe o linie), au rămas aproape toate. Tocmai ele dau senzația de „neterminat”.

---

## 3. Constatări noi

Legendă: **P0** blocant · **P1** important · **P2** mediu · **P3** minor. Efort: S = sub o zi, M = 1–3 zile, L = peste 3 zile.

### D1 · P1 · Trei cifre diferite pentru „cât pot cheltui azi”

**Ce am văzut:**
- Eroul de pe Astăzi spune „Poți folosi azi **48,05 RON**”.
- Nota de sub banda de zile spune „Mai rămân 160,30 în plicul săptămânii, cam **48,05 pe zi** până duminică”. Duminică are însă 112 (chip-ul DUM), deci 48,05 *nu* e „pe zi”.
- Detaliul plicului Mâncare spune „Săptămâna asta mai ai 160,30 RON: cel mult **80,15 RON pe zi**, 2 zile cu tot cu azi.”
- Utilizatorul vede așadar 48,05, 80,15 și 112 pentru același lucru. E exact tipul de contradicție care distruge încrederea într-o aplicație de bani.

**Capturi:** `S/shots/today-white-m-s1.png`, `S/mont/env.png` (stânga).

**Cauza:**
- `lib/today-summary.ts:108`: `noteDaily = heroTracksWeek ? brief.spendable : …` pune suma de azi în șablonul „cam {daily} pe zi până {until}” (`:119`).
- Detaliul plicului calculează `remaining / zile` (80,15) și ignoră că azi s-au cheltuit deja 64,20.

**Propunere:**
- Nota devine: „Până duminică mai ai 160,30: **48,05 azi**, 112,25 mâine.” Textul se generează din `rhythm.days`, nu dintr-o medie.
- În plic: „Săptămâna asta: 160,30 rămași · azi 48,05 (ai cheltuit deja 64,20) · mâine 112,25.”
- Regulă de produs: un singur helper `dailyAllowance(asOf)` folosit de erou, de notă, de plic și de ghid, cu un test care verifică egalitatea celor trei texte.

**Efort:** M.

### D2 · P1 · Cascada „Cum se calculează cifra zilei” are o etichetă care minte

**Ce am văzut:** rândul „Cheltuit azi din plicuri” arată **48,05 RON**. Cheltuiala de azi e însă 64,20. 48,05 e *rezultatul* după scădere, adică exact valoarea rândului următor, „Poți folosi azi 48,05”.

**Captură:** `S/mont/sheets.png` (stânga).

**Cauza:** `lib/household-insights.ts:956` scrie în `total` totalul curent, iar eticheta descrie operația.

**Propunere:**
- Fiecare pas afișează *delta* la dreapta, cu totalul curent mic dedesubt: „− Cheltuit azi · **−64,20** → rămân 48,05”.
- Pentru „Împărțit la 2 zile”: „÷ 2 zile · **112,25**”.
- În `SafeSpendSheet.tsx:62–80` se adaugă `step.delta`, randat cu `color: var(--cf-danger)` doar pentru minus.

**Efort:** S.

### D3 · P1 · Aceeași plată are trei stări pe trei ecrane (Chirie)

**Ce am văzut:** am notat manual „Chirie 1.800” în plicul Chirie. Apoi:
- Plicuri spune **PLĂTIT**.
- Astăzi, în „De rezolvat”, și Obligații spun **Întârziată · 1.800 RON**.
- Ghidul spune „scadența «Chirie» **azi**”, deși era pe 16, acum 10 zile.

**Capturi:** `S/shots/plicuri-white-m.png`, `S/shots/today-white-m-s2.png`, `S/shots/ghid-white-m.png`.

**Cauza:**
- Scadența se consideră plătită doar prin `transaction.recurringId` (`lib/finance-data.ts:1561`), deci o mișcare notată manual nu o închide.
- `lib/analyst.ts:637` transformă `days <= 0` în „azi”, inclusiv pentru plățile întârziate.

**Propunere:**
- (a) În Notează, când titlul, suma (±10 %) și plicul se potrivesc cu o scadență neconfirmată din ultimele 10 zile, apare un chip „Asta e plata pentru **Chirie**? ✓ Da”.
- (b) Pe rândul „Întârziată” apare linia „Pare plătită: Chirie 1.800 RON pe 16 sept. · **Leagă**”.
- (c) În ghid: `days < 0 ? "întârziată de N zile" : days === 0 ? "azi" : …`.

**Efort:** M.

### D4 · P1 · Tema Alb afișează un bloc de temă închisă, cu text negru (2,5:1)

**Ce am văzut:** „Scadențar complet” pe fiecare datorie, în tema Alb, e un bloc gri-ardezie. Textul „Dobândă de plătit până la final” e aproape negru pe gri închis: **2,48:1**. Titlurile ratelor sunt albe, iar sumele sunt aurii, ca pe Navy.

**Capturi:** `S/mont/obl-w-b.png`, `S/mont/obl-w-a.png` (dreapta, jos).

**Cauza:** `client/src/visibility-safety.css:334`, `.bf-debt-schedule { background: rgba(11,25,29,.72); border: 1px solid rgba(112,229,189,.22) }`. Culorile sunt fixe, fără token.

**Propunere:**

```css
.bf-debt-schedule {
  background: var(--cf-surface-2, color-mix(in srgb, var(--cf-ink) 4%, var(--cf-surface)));
  border: 1px solid var(--cf-line);
  color: var(--cf-ink);
}
.bf-debt-schedule small { color: var(--cf-muted); }
.bf-debt-schedule b.amount { color: var(--cf-ink); } /* auriu doar pe Navy, prin tokenul temei */
```

Chip-urile „Rata 01…” devin rânduri plate de listă (fără card pe rând): „Rata 01 · 5 oct. · 400 RON”, cu dobânda ca meta.

**Efort:** S.

### D5 · P1 · Roșul „întârziat” e ilizibil pe Întunecat și Navy (2,6–2,9:1)

**Ce am văzut:** pe rândurile întârziate din Obligații, titlul „Chirie”/„Netflix” și butonul „Mai târziu” folosesc `rgb(180,35,24)`, adică roșul temei Alb, și pe fundalurile închise:
- Întunecat: 2,85:1;
- Navy: 2,6:1.

Pragul AA e de 4,5:1.

**Capturi:** `S/mont/dark-2.png` (dreapta), `S/shots/obligatii-navy-d.png`. Culorile sunt măsurate în `probe3.mjs`.

**Propunere:**
- Token `--cf-danger-text`: `#B42318` pe Alb, `#FF8A7A` pe Întunecat (≈ 7:1 pe `#161A1E`), `#FF9C8C` pe Navy (≈ 7,5:1 pe `#0B1C35`).
- Titlul rândului rămâne `--cf-ink`. Starea se vede prin chip-ul „Întârziată” și prin bara laterală, nu prin colorarea numelui.
- „Mai târziu” devine un buton secundar neutru; o amânare nu e o acțiune de pericol.

**Fișiere:** CSS-ul pentru `.bf-obligation-*` (regulile de ton sunt în `household-os-themes.css` / `mobile-obligations-pass.css`).

**Efort:** S.

### D6 · P2 · Accentul temei Întunecat apare pe Navy; eticheta „NOAPTE · OLED” e falsă

**Ce am văzut:**
- Pe Navy, titlul de pe Obligații, „plătit, rezervat sau amânat.”, e mint neon `rgb(124,255,196)`, nu auriu, și nici măcar mint-ul temei Întunecat (`#7DCFAB`).
- Kickerul „Proiecția scenariului” e auriu pe Navy și verde închis pe verde închis în Alb, deci invizibil (`S/mont/misc-c.png`, stânga).
- Tema Navy e prezentată ca „NOAPTE · OLED”, deși nu e negru pur.

**Fișiere:** `pages/home-kit.tsx:30`; regula `em` din titlurile de pagină (`deferred-atelier.css`, blocul `--font-display`).

**Propunere:**
- Accentul din titluri vine din `var(--cf-accent-display)`: mint `#7DCFAB` pe Întunecat, auriu `#E6C27A` pe Navy, pin `#1F6B55` pe Alb.
- Pe cardul verde de proiecție: `.bf-kicker { color: color-mix(in srgb, #fff 72%, transparent) }`.
- „NOAPTE · OLED” devine „NOAPTE · BLEUMARIN”.

**Efort:** S.

### D7 · P1 · Sumele folosesc două familii de fonturi pe același ecran

**Ce am văzut:**
- Plicuri: suma mare e IBM Plex Serif 20 px, iar „439,70 RON / 600 RON” de sub ea e Plex Sans.
- Astăzi: eroul e sans, iar chip-urile zilelor („231”, „145”) sunt Fraunces cu cifre *old-style*. Cifrele coboară sub linie, iar „0” și „48” au înălțimi diferite.
- Analiză: donutul și lista sunt serif, iar cardurile de rezultat sunt sans.

**Capturi:** `S/shots/today-white-m-s1.png`, `S/shots/plicuri-white-m-s1.png`, `S/mont/an-w-a.png`.

**Cauza:** `household-os-today.css:98`, `.bf-os-day b { font-family: Fraunces }`; `deferred-atelier.css:317`, `.bf-allocation-list-total strong { font: 600 20px/1 "IBM Plex Serif" }`; `deferred-atelier.css:309` (Analiză, Obligații).

**Propunere:** o singură regulă pentru bani:

```css
.bf-app :is(.bf-money, .os-amount, .bf-allocation-list-total strong, .bf-os-day b, .bf-analysis-balance strong) {
  font-family: "IBM Plex Sans", system-ui, sans-serif !important;
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: "tnum" 1, "lnum" 1;
  letter-spacing: -0.01em;
}
```

Fraunces rămâne doar în H1-ul paginii („Fiecare leu *are un loc.*”), unde dă caracter. Asta e direcția Monzo și Copilot: display serif pe titluri, cifre mereu grotesk tabular.

**Efort:** S.

### D8 · P1 · Paleta de categorii: 3 verzi identici și o coliziune de culoare

**Ce am văzut:**
- În donut, „Casă & facturi” (`#2F6F5E`), „Alimente” (`#176B54`) și „Sănătate” (`#1F6B62`) se confundă. Diferențele de luminanță sunt sub 5 %.
- „Copii” (categorie proprie) primește prin hash `#8C6A3D`, *aceeași* culoare ca „Transport”.
- Lista cu bare de sub donut colorează „Copii” gri. Aceeași categorie are deci două culori pe același card.

**Capturi:** `S/mont/an-w-a.png` (dreapta), `S/mont/navy-3.png`.

**Cauza:** `lib/finance-data.ts:214` (`categoryColors`); `lib/category-color.ts:7` (`EXTRA` conține culorile de bază); lista din `ReportsPanel.tsx` nu folosește `categoryColor()` pentru toate barele.

**Propunere:**
- O paletă cu 10 nuanțe separate pe nuanță și luminanță, valabilă pe toate temele, cu varianta închisă prin `color-mix(in oklch, c 80%, white)`:
  - Alimente `#2E8B57`, Casă & facturi `#3B6FB6`, Transport `#D0782F`, Timp liber `#8A5CC2`, Sănătate `#C8506E`;
  - Abonamente `#B8932E`, Consumabile copil `#1E9AA8`, Educație `#5561C9`, Rate/Credite `#8C5A3C`, Altele `#7A8580`.
- `EXTRA` trebuie să excludă culorile deja folosite, iar hash-ul trebuie să ocolească coliziunile.
- Paleta se validează cu simulare pentru deuteranopie, cu ΔE ≥ 20 între orice pereche (skill-ul dataviz are un validator).
- Aceeași culoare se folosește în donut, în lista cu bare, în iconița rândului din Mișcări și în chip-ul din Notează.

**Efort:** M.

### D9 · P2 · Fâșia de 24 px de pe desktop acoperă conținutul

**Ce am văzut:** la 1280 px, dock-ul e ascuns, dar `.os-nav-fill` (fundalul barei de navigare Android) rămâne fix jos, cu 24 px. Ultimul rând din orice listă trece pe sub el, iar pe temele închise apare o bandă de altă nuanță.

**Capturi:** `S/shots/today-white-d.png`, `S/shots/plicuri-navy-d.png` (fâșia gri sau neagră de jos).

**Cauza:** `client/src/apk-safe-area.css:70–79` (`height: max(24px, …)`). Tot acolo, padding-ul de jos de 88 px e aplicat și pe desktop.

**Propunere:**

```css
@media (min-width: 900px) {
  .os-nav-fill { display: none !important; }
  .os-shell main, .os-shell .bf-page { padding-bottom: 32px; }
}
```

În plus, pe web mobil (fără APK), înălțimea ar trebui să fie `env(safe-area-inset-bottom, 0px)`, fără minimul de 24 px.

**Efort:** S.

### D10 · P1 · Desktopul nu are un layout propriu

**Ce am văzut:**
- Toate ecranele sunt o coloană de 1.050 px.
- Pe Astăzi: cifra zilei e pe stânga, iar 60 % din erou e gol. „Notează” e un pill de 500 px, iar banda de 7 zile se întinde pe toată lățimea.
- Pe Mișcări: rândurile au 1.040 px, cu suma lipită de coș la marginea din dreapta (Fitts și scanare slabe).
- Taburile de sus sunt în ordinea Astăzi · Mișcări · Plicuri · Obligații · Analiză, iar pe mobil ordinea e Astăzi · Plicuri · ＋ · Mișcări. Obligații și Analiză sunt taburi pe desktop, dar „Mai mult” pe mobil.

**Capturi:** `S/shots/today-white-d.png`, `S/shots/miscari-white-d.png`, `S/shots/plicuri-navy-d.png`, `S/shots/analiza-dark-d.png`.

**Propunere, la `@media (min-width: 1024px)`:**
- Shell-ul devine `grid-template-columns: 232px minmax(0, 1fr)` cu un sidebar stâng: marcă, apoi Astăzi / Plicuri / Mișcări, un separator, Obligații / Analiză / Obiective, iar jos Setări și Sync. „＋ Notează” e primul buton din sidebar, primar, cu 44 px.
- Astăzi: `grid-template-columns: 7fr 5fr; gap: 24px`. În stânga: eroul (cifra 64 px) și banda de zile. În dreapta: „De rezolvat” și „Ultimele mișcări”.
- Plicuri: master-detail. Lista are 420 px, iar detaliul plicului (burn-down, tranșe, editare) stă în panoul drept, în loc de „Detalii ▾” inline.
- Mișcări: tabel cu coloanele Dată · Titlu · Categorie (chip color) · Persoană · Sumă (dreapta, tabular) și `max-width: 960px`.
- Ordinea taburilor și a sidebar-ului e identică cu dock-ul.

**Fișiere:** `household-os-chrome.css` (shell), `pages/Home.tsx` (nav), `pages/TodayView.tsx`.

**Efort:** L.

### D11 · P2 · Plicuri: cardul are 240 px și citește în zig-zag

**Ce am văzut:**
- Fiecare plic închis are ~240 px, deci 7 plicuri ocupă ~1.900 px.
- Ordinea pe card: chip de stare sus, numele, „Familie / comun · Orice sursă” (identic pe toate 7 plicurile, deci zgomot), apoi suma mare *la dreapta, cu un rând mai jos*.
- Urmează „TOT PLICUL 212,30 / 450” (cheltuit), în timp ce cifra mare arată *rămasul*. Apoi un „Detalii ▾” albastru.
- „Grădiniță” (taxă fixă, 700/700 plătită) e sub **Variabile** cu **ATENȚIE**, deși e o plată fixă încheiată.

**Capturi:** `S/shots/plicuri-white-m-s1.png`, `-s2.png`.

**Propunere, cu țintă de 88 px pentru cardul închis:**

```
[icon cat.]  Mâncare                         1.489,60
             S2 · 439,70 din 600   ▓▓▓▓▓▓▓░|░   rămași
```

- Numele și suma stau pe *aceeași* linie de bază (`display:grid; grid-template-columns: 40px 1fr auto; align-items: baseline`).
- Bara arată **rămasul** (se golește), cu marcajul „azi”. Chip-ul de stare devine un punct colorat și un cuvânt în meta („· Atenție”), doar când nu e „În ritm”.
- „Familie / comun · Orice sursă” se afișează doar când diferă de valoarea implicită.
- Tap pe card deschide detaliul (foaie pe mobil), iar „Detalii ▾” dispare.
- Grădiniță: un plic fără `weeklyPace` și cu o singură mișcare egală cu suma trece în Fixe, cu starea „Plătit”.

**Fișiere:** `components/PlanStudio.tsx` (lista), `deferred-atelier.css:317`, `motion.css` (bara).

**Efort:** M.

### D12 · P2 · Plicuri: trei totaluri care nu se leagă între ele

**Ce am văzut:** pe aceeași pagină apar:
- „Nerepartizați 7.602,20 RON” (hero);
- „7 plicuri · 6.850 RON”;
- „Progres repartizare 42 % · 5.476,60 RON repartizați · 0 lei … 13.079 lei”.

6.850 + 7.602 ≠ 13.079. Utilizatorul nu are cum să înțeleagă de ce „repartizați” (5.476,60) diferă de suma plicurilor (6.850).

**Captură:** `S/mont/plicuri-w-4-6.png`.

**Propunere:**
- O singură bară segmentată în hero: „13.079 disponibili = 6.850 în plicuri + 7.602 liberi · (−1.373 deja cheltuiți din plicuri fixe)”.
- Cardul „Progres repartizare” dispare. Procentul trece în hero ca „52 % așezat”.

**Efort:** S (text) / M (bara).

### D13 · P2 · Obligații: ierarhie și copy

**Capturi:** `S/shots/obligatii-white-m.png`, `S/mont/obl-w-a.png`, `S/mont/obl-w-b.png`.

**Ce am văzut și ce propun:**
- „Confirmă plata” pe datorie e **roșu plin** (`S/mont/obl-w-b.png`), deși e acțiunea bună, dorită. Devine primar, verde sau auriu, ca la facturi.
- Abonamentele: suma în stânga, numele în dreapta (propunere veche). Se inversează: nume (`--t-body-lg`) în stânga, suma tabulară în dreapta, „lunar · ziua 16” ca meta.
- Pagina are 5.200 px și conține aceleași datorii de două ori: o dată ca rânduri „Rată · 5 oct. · 400 RON”, a doua oară cu scadențarul complet.
  - Structura propusă: rezumat („Luna asta: 2.475 RON de plătit · 2 întârziate”), apoi secțiunile *Întârziate / Săptămâna asta / Luna asta / Mai târziu*, apoi Datorii (câte un card per datorie, cu bara de sold și „Scadențar ▸” ca foaie).
- Butoanele „Obiective pe termen lung / Calendar de scadențe / Evenimente viitoare” sunt 3 pastile mari, pe toată lățimea, deasupra conținutului. Devin un segment sau chip-uri pe un rând, ori intră în „⋯”.

**Fișiere:** `pages/ObjectivesView.tsx`, `mobile-obligations-pass.css`.

**Efort:** M.

### D14 · P2 · Analiză: filtrele sunt după conținut, iar mesajele se dublează

**Capturi:** `S/shots/analiza-white-m.png`, `S/mont/an-w-a.png`, `S/mont/an-w-b.png`.

**Ce am văzut:**
- „Luna aceasta față de medie” apare *înaintea* selectorului „Citește ciclul / Lună calendar / Ciclu salariu”. Nu știi pe ce perioadă e calculată.
- „Luna rămâne pe plus.” apare de două ori (Situație lunară și Rezultatul lunii).
- „Rezultatul lunii 4.480,80” e verde, iar trei carduri mai jos „Poziție lichidă netă **−8.321,20**” e roșu, fără nicio explicație. Pentru un om obișnuit, „poziție lichidă netă” e jargon.
- Δ-urile față de medie sunt toate roșii, inclusiv +9,07 RON (0,9 %).
- „Plicuri care cer atenție” are un ⚠ singur pe rând sub titlu.
- Celula „4.119,20 RON” atinge separatorul.

**Propunere:**
- Un antet sticky „‹ Sept. 2026 ›” și un chip „Familie ▾”. Toate perspectivele intră într-o foaie, iar sub antet stă direct „Unde au mers banii”.
- Δ colorat doar peste ±10 % și peste 50 RON, restul neutru.
- „Poziție lichidă netă” devine „Bani în surse minus datorii”, cu un „ⓘ”.
- Un singur mesaj de sinteză.
- „Ritm lună cu lună” pe toată lățimea (`grid-column: 1 / -1`), cu etichetele „iun iul aug sep”.

**Fișiere:** `components/ReportsPanel.tsx`, `pages/InsightsView.tsx`, `mobile-analysis-pass.css`.

**Efort:** M.

### D15 · P2 · Setări: formular lung, cu termeni învechiți

**Capturi:** `S/shots/setari-white-m.png`, `S/mont/set-a.png`, `S/mont/set-b.png`.

**Ce am văzut:**
- Pagina are 5.700 px, cu câte un card per secțiune, câmpuri la 60 % din lățime și soldul („13.078,80 RON · Card · 29 mișcări”) plutind la dreapta, cu 11 px.
- „Mod simplu” descrie un dock inexistent: „dock-ul rămâne Astăzi / Mișcări / **Plan** / Obligații”.
- Alte texte spun încă „Plan” pentru ecranul „Plicuri”:
  - „Încă o alertă la plicuri — vezi în **Plan**” (`TodayView.tsx:307`);
  - „Le vezi în **Plan**” (`AICompanion.tsx:295`).
- „Numele tău: **Eu**”, deși membrii sunt Andrei și Maria.
- „Ziua familiei … se socotește după fusul **UTC**” e jargon tehnic.
- „Copil” e un checkbox nativ de 22 px cu eticheta de 10 px. „Șterge membrul” e un ✕ roșu de 32 px.
- „Resetează datele locale” are 10 px, deși e o acțiune distructivă importantă.

**Propunere:**
- „Setări” devine o listă grupată de rânduri de 56 px (Familie și membri › / Surse și solduri › / Categorii › / Securitate › / Backup › / Limbă ›). Fiecare deschide o sub-pagină cu app-bar „‹ Setări”.
- Membru: avatar, nume, rol („Adult / Copil”) ca segment, și un „⋯”.
- „Plan” devine „Plicuri” peste tot (grep `vezi în Plan`, `în Plan`).
- „Numele tău” devine un select „Acest telefon e al: [Andrei ▾]”.
- Textul despre UTC devine: „Ziua se schimbă la miezul nopții, la fel pe toate telefoanele.”

**Fișiere:** `pages/SettingsPanel.tsx:369`, `mobile-settings-pass.css`.

**Efort:** M.

### D16 · P2 · „+ Plic”: formularul e inline și are grila ruptă

**Captură:** `S/mont/env.png` (mijloc și dreapta).

**Ce am văzut:**
- „Membru” are 97 px înălțime, iar „Plătit din” 42 px.
- „Suma acestei categorii” și „Avertizează la” nu sunt aliniate.
- Segmentul „Total pe perioadă / Pe săptămână întreagă” e strivit pe 3 rânduri.
- „Împarte pe săptămâni” e un checkbox nativ.
- Formularul se deschide în pagină, nu în foaie, deși butonul „+ Plic” e sus.

**Propunere:**
- O foaie de 92 % cu doar 3 câmpuri vizibile: Nume (autocomplete din categorii), Sumă (48 px, tastatură numerică) și Ritm (segment „Lunar / Săptămânal”).
- Restul (membru, sursă, avertizare, notă) stă sub „Mai multe opțiuni ▾”.
- Toate câmpurile au `min-height: 48px`. Grila e `grid-template-columns: 1fr 1fr; gap: 12px; align-items: end`.
- Switch în loc de checkbox.

**Fișiere:** `components/PlanStudio.tsx`, `plan-studio.css`.

**Efort:** M.

### D17 · P2 · „Cum se citește?”: cronologia e tăiată și se repetă

**Ce am văzut:**
- „18 zile până la venit” apare de două ori (titlu și card interior).
- Pe cronologie, ultima etichetă „VEN…” e tăiată de marginea cardului.
- Punctele au etichete 1, 4, 6, 9… fără lună.

**Captură:** `S/mont/sheets.png` (stânga).

**Propunere:**
- Un singur bloc: „**18 zile** până la salariu · 14 oct.”, cu bara liniară sub el.
- La capătul drept, un icon ▸ „salariu” în loc de text.
- Etichete doar pe „azi” și pe „14 oct.”
- `overflow: visible; padding-inline: 12px` pe container.

**Fișier:** `components/SafeSpendSheet.tsx`, `safe-spend-sheet.css`.

**Efort:** S.

### D18 · P2 · Mișcări: meta dublată și ~400 px de filtre

**Capturi:** `S/shots/miscari-white-m.png`, `S/shots/miscari-white-d.png`.

**Ce am văzut:**
- Meta rândului „Andrei · Card BT · Transport · **Transport**”: categoria și plicul se repetă când au același nume (`MovementsJournal.tsx:109–113`, `envelopeCaption`).
- Primul rând apare la y ≈ 500 px pe mobil. Deasupra sunt: antet, banda de 7 zile (duplicat vizual cu banda de pe Astăzi), segmentul Toate/Ieșiri/Intrări, căutarea cu contorul „29”, „Filtre” și un al doilea segment Toate/Comune/Personale.

**Propunere:**
- Plicul se omite când `label === category`.
- Meta devine „Transport · Andrei” (sursa numai dacă nu e cea implicită).
- Căutarea și „Filtre (n)” stau pe un rând. Segmentele intră în foaia de filtre, iar chip-urile active apar sub căutare.
- Banda de zile devine un „jump” compact de 36 px.
- Coșul de pe rând se scoate (swipe există deja), iar ștergerea se mută și în foaia de editare.

**Efort:** S–M.

### D19 · P3 · Text sub 12 px (măsurat, 390 px, tema Alb)

**Ce am măsurat:**
- **Aspect:** 15 noduri între 8 și 11 px („SURSE UTILIZABILE” 8 px, „ZI · PLATINUM” 9 px, descrierile temelor 10 px).
- **Notează:** chip-urile de categorie și sumele recente au 11 px.
- **Obligații:** „Arată toate cele 9 rate” are 10 px, iar „Gestionează” 11 px.
- **Setări:** „Copil” are 10 px, „Resetează datele locale” 10 px, soldurile surselor 11 px.
- **Plicuri:** „Plătit” are 9 px, iar „RITM ORIENTATIV…” 10 px.

**Captură:** `S/shots/aspect-white-m.png`. Rezultatele complete sunt în `S/meas-white.log`.

**Propunere:** un plafon global în `a11y-floor.css`: `.bf-app :is(small, span, em, label, button) { font-size: max(12px, 1em) }` pe clasele mici listate. În preview-ul temei, mini-cardul se scalează cu `transform: scale(.85)` în loc să micșoreze fontul.

**Efort:** S.

### D20 · P3 · Contrast gri de 3,6:1 pe meta

**Ce am măsurat:** `rgb(124,135,127)` pe `#FAFBFA` dă **3,60:1**. Apare la etichetele S1–S5, „… cheltuiți din 600 RON” și lunile din „Pe luni” din detaliul plicului. Pe Navy, același gri dă 4,06:1.

**Propunere:**
- `--cf-muted` trece pe `#5F6B64` pe Alb (≈ 5,6:1).
- Pe Navy devine `#9FB0C8` (≈ 7:1 pe `#102646`).
- Culoarea se definește ca token de temă, nu fixă (`deferred-atelier.css:12` are culori fixe pentru `.bf-app`).

**Efort:** S.

### D21 · P3 · Ghid și căutare: finisaj

**Capturi:** `S/shots/ghid-white-m.png`, `S/mont/sheets.png`.

**Ce am văzut și ce propun:**
- Ghidul folosește ghilimele franceze «Chirie», iar restul aplicației folosește „Chirie”. Se unifică pe „…”, inclusiv în `analyst.ts` și în placeholder-ul „«Taxi soție»”.
- Chip-urile de sugestie sunt tăiate fără indiciu. Se adaugă `mask-image: linear-gradient(90deg, #000 85%, transparent)`.
- Bara „100/100 azi” arată ca un scor. Se ascunde până sub 20.
- La căutare, toate mișcările recente au iconița document. Se folosește `CategoryGlyph`, ca în Mișcări.

**Efort:** S.

### D22 · P3 · First-run: 6 intenții, copy nepotrivit

**Captură:** `S/mont/empty-b.png` (mijloc).

**Ce am văzut:**
- Sunt 6 carduri „Vreau…”; înainte erau 4. Kickerul e „PRIMUL REZULTAT”, deși nu există încă niciun rezultat.
- „Vreau doar să văd pe ce se duc banii” are descrierea „Deschide direct înregistrarea unei cheltuieli”, deci promisiunea și efectul nu se potrivesc.

**Propunere:**
- 3 intenții: „Împarte-mi salariul”, „Doar notez cheltuieli”, „Buget pentru familie”. Restul intră la „Alte moduri ▾”.
- Kickerul devine „PASUL 1 DIN 3”.
- Titlurile de card au maximum 4 cuvinte.

**Fișier:** `components/FirstRunSetup.tsx:263`.

**Efort:** S.

### D23 · P3 · Sincronizare: hero fals „FAMILIE CONECTATĂ”

**Ce am văzut:** kickerul „FAMILIE CONECTATĂ” apare chiar și pe un telefon neconectat. Sub el e un card de ~300 px, cu mult spațiu gol.

**Captură:** `S/mont/misc-b.png` (dreapta). Fișier: `pages/SyncPanel.tsx:185`.

**Propunere:**
- Kickerul se condiționează: `connected ? "FAMILIE CONECTATĂ" : "SINCRONIZARE"`.
- Pe starea neconectată, hero-ul are un CTA primar: „Conectează al doilea telefon”.

**Efort:** S.

### D24 · P2 · Datoria tehnică de CSS frânează orice finisaj

**Ce am măsurat:** 80 de fișiere și 2.296 de `!important`. `deferred-atelier.css` are 6.269 de linii, cu 760 de `!important`, iar `household-os-chrome.css` are 401.

Fiecare fix de mai sus trebuie să „câștige” împotriva a 3–5 reguli mai vechi. De aceea finisajele din auditul trecut nu s-au făcut.

**Propunere:**
- Un strat `@layer reset, tokens, base, components, themes, overrides;`.
- Pass-urile istorice intră în `overrides` și se golesc treptat: o componentă pe PR, cu captură Playwright înainte și după pe cele 3 teme.
- Un contor în CI care nu permite creșterea numărului de `!important`.

**Efort:** L (continuu).

---

## 4. Ce ar face-o „cea mai frumoasă și modernă”

Comparația e cu Monzo, Revolut, YNAB și Copilot Money.

1. **Un singur număr și o singură poveste.** Copilot arată „Safe to spend” *o dată*, cu o linie mică sub el. Monzo arată „Left to spend today”. Aici, eroul, nota, plicul și ghidul trebuie să spună aceeași cifră (D1), cu cascada ca explicație (D2).
2. **Cifre grotesk tabulare, titluri serif.** Fraunces în H1 e o semnătură frumoasă. Cifrele serif old-style din chip-uri și carduri par însă un bug (D7).
3. **Plicul ca obiect viu, compact.** Rânduri de 88 px ca în YNAB, cu bara care se *golește* și marcajul „azi”. Detaliul (burn-down și tranșe, deja existente) stă într-o foaie (D11).
4. **Culoare cu sens.** Un accent pe temă, roșu doar pentru depășit sau întârziat, și o paletă categorială validată care apare consecvent în donut, rânduri și chip-uri (D5, D6, D8). Revolut și Copilot au culoarea categoriei *peste tot*.
5. **Liniște vizuală.** Maximum un kicker uppercase pe ecran. Fără carduri în carduri, fără bare laterale decorative, fără explicații de 40 de cuvinte pe fiecare card („Pe scurt”, „Plicul e o limită…”, „Rate, facturi și obiective pe o singură listă…”). Copy-ul explicativ se mută în „ⓘ”.
6. **Desktop adevărat:** sidebar și master-detail (D10). YNAB pe web e referința.
7. **Mișcare cu intenție.** Există deja count-up, umplere și bifă. Lipsesc foile cu drag și snap, indicatorul dock-ului care alunecă și hapticele Capacitor (`@capacitor/haptics`: `light` la salvare, `success` la confirmarea unei plăți, `warning` la depășire).
8. **Marcă pe teme.** Logo-plicul „on-dark”, cu contur crem subțire pe `--surface-2`, în locul dalei crem pe Navy și Întunecat. Iconul aplicației urmează tema.

---

## 5. Idei de dezvoltare (design), prioritizate

1. **„Azi într-o privire” (widget + ecran de blocare Android):** cifra zilei, chip-urile L–D și „＋”. Există deja un widget; trebuie aliniat vizual cu eroul. Efort M.
2. **Foaie de detaliu plic, cu gest:** swipe-down pentru închidere, snap la 50 % și 92 %, burn-down cu tooltip la atingere („pe 20 sept. aveai 1.620”). Efort M.
3. **Calendar de cashflow** pe Obligații: grilă 7×5 cu puncte colorate pe categorie și curba soldului proiectat. Datele există deja în `lib/cashflow-projection.ts`. Efort M.
4. **Mod „Accesibilitate”** în Setări: text mare (1,2×), contrast ridicat real (linii de 2 px, fără texturi), activat automat de `prefers-contrast: more`. Efort M.
5. **Regresie vizuală în CI:** `cap2.mjs` din acest audit, pe 3 teme × 2 lățimi, plus `measure.mjs`, care pică la contrast sub 4,5, text sub 12 px sau serif pe cifre. Efort S.
6. **Temă „Hârtie / Sepia”** pentru seară, cu contrast moderat, ca alternativă la Întunecat. Efort S.

---

## 6. Ce e deja foarte bine

- Dock-ul cu ＋ central și Notează cu suma întâi, cu sume recente și autofocus, sunt la nivel Monzo.
- Stările goale: Astăzi cu „Trei pași și cifrele devin ale tale”, plicul ilustrat pe Plicuri, CTA clar pe Mișcări.
- Detaliul plicului are burn-down cu linia ideală și proiecția, plus banda S1–S5. Puține aplicații de buget au așa ceva.
- Cascada „Cum se calculează cifra zilei” e ideea corectă (are nevoie doar de D2).
- Micro-animațiile sunt discrete și respectă `prefers-reduced-motion`: umplerea plicului, bifa desenată, count-up-ul și View Transitions la schimbarea temei.
- Temele Întunecat și Navy au caracter. Navy cu auriu e cea mai „premium” dintre ele.
- Țintele mici au zonă de atingere extinsă prin `::after`. Skip-link-ul e corect pe toate temele când primește focus.
- Diacriticele sunt corecte peste tot, iar tonul e cald și românesc („Fiecare leu are un loc.”).
