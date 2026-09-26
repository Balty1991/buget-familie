# Buget Familie: audit de performanță (web și mobil)

Commit `1935b14`, v1.1.96. Data: 26.09.2026. Rol: inginer de performanță. Nu am modificat nimic în repo în afară de acest fișier. Nu am trimis nicio cerere spre Firebase.

## 1. Pe scurt

- **Notă globală: 6/10.** Față de auditul din 25.09, pornirea cu 5.000 de mișcări e de aproximativ două ori mai rapidă: TBT a scăzut de la 7,1 s la 3,2 s, iar cel mai lung task de la 2,4 s la 1,16 s (CPU 6×). Cu 0–1.000 de mișcări aplicația e bună.
- **Cu registru mare, aplicația încă nu răspunde bine la acțiunile de zi cu zi.** Cu 5.000 de mișcări pe CPU 6×:
  - „Gata” la o cheltuială are INP ≈ **1,0 s**;
  - intrarea în Mișcări blochează firul principal ≈ **0,9 s**;
  - ștergerea căutării ≈ **1,1 s**, iar „Arată mișcările mai vechi” ≈ **1,5 s**;
  - revenirea pe Astăzi are blocaje de 0,5–1,05 s.
- Cauzele principale, măsurate:
  1. Astăzi se recalculează integral și de mai multe ori: `todayBrief` e chemat de 4 ori pe randare, `allocationWeeksStatus` de zeci de ori.
  2. Salvarea completă (stringify, hash, localStorage 1,24 MB) rulează sincron în cadrul clicului.
  3. Hidratarea de la pornire produce două randări și două scrieri complete inutile.
  4. Jurnalul randează 30 de zile deodată (~280 de rânduri la 5.000 de mișcări), fără virtualizare.
  5. CSS-ul de 635 KB (~7.950 de selectori) dublează costul de recalculare a stilurilor.
- Bundle-ul de pornire e rezonabil: 190 KB JS gzip și 44 KB CSS blocant gzip. Nimic greu (Firebase, jsPDF, OCR, AI) nu se încarcă la pornire.
- Cu remedierile de mai jos, estimez pentru 5.000 de mișcări pe CPU 6×:
  - „Gata” de la ~1 s la ~0,35–0,45 s;
  - Mișcări de la ~0,9 s la ~0,25 s;
  - pornire: TBT de la 3,2 s la ~1,3 s, TTI de la 6,3 s la ~4 s.

## 2. Cum am măsurat

- **Build:** build de producție `GITHUB_PAGES=true vite build --outDir <scratchpad>/agenti/perf/dist`. L-am servit cu un server static cu gzip, ca GitHub Pages, pe portul 5193. Pentru profilare am folosit un al doilea build cu sourcemap (portul 5194), iar cadrele minificate au fost mapate înapoi la `fișier:linie`.
- **Browser:** Chromium headless, 390×844, DPR 2, touch, fus Europe/Bucharest, service worker blocat, gazdele externe blocate.
- **Condiții:**
  - CDP: CPU 4× și 6×; la pornire, rețea „Slow 4G” (150 ms RTT, 1,6 Mbps down, 750 kbps up) și cache dezactivat;
  - la interacțiuni, fără limitare de rețea, adică active locale ca în APK.
- **Date:** 0, 1.000 și 5.000 de mișcări pe 18 luni, 8 plicuri săptămânale, 2 plăți recurente și o datorie (255 KB și 1,24 MB JSON). Le-am pus direct în localStorage și IndexedDB.
- **Metrici:**
  - INP = durata maximă Event Timing pe interacțiune;
  - „blocaj” = cel mai lung long task în cele 2,5 s de după acțiune;
  - „h1 vizibil” = primul `#root h1`, adică cifra zilei (primul ecran utilizabil real);
  - TTI = sfârșitul ultimului long task urmat de 5 s de liniște.
- **Repetări:** pentru 5.000@6× și 1.000@4× am rulat de 3 ori și raportez mediana. Variația între rulări e de ±15–25%.
- **Artefact evitat:** clicurile prin `getByRole`/`getByLabel` ale Playwright rulează interogări ARIA în firul paginii (200–240 ms „getTextAlternativeInternal”/„getElementLabels” la 4×) și umflau long tasks. Scripturile finale apasă prin coordonate. La fel, `CSS.startRuleUsageTracking` triplează costul de stil, așa că am măsurat stilul separat, fără el.
- **Rezervă:** e un desktop încetinit, nu un Android real.

### 2.1 Pornire (rețea Slow 4G, cache rece)

| Mișcări / CPU | FCP* | h1 vizibil | TTI | TBT | Long task max | Heap după pornire → după tur |
|---|---|---|---|---|---|---|
| 0 / 4× | 1,28 s | 2,00 s | 3,32 s | 195 ms | 209 ms | 3,1 → 5,7 MB |
| 0 / 6× | 1,29 s | 2,25 s | 3,62 s | 457 ms | 410 ms | 3,1 → 5,7 MB |
| 1.000 / 4× (med. 3) | 1,25 s | 2,30 s | 3,71 s | 716 ms | 492 ms | 4,5 → 7,3 MB |
| 1.000 / 6× | 1,30 s | 2,71 s | 4,43 s | 1.319 ms | 853 ms | 4,5 → 7,3 MB |
| 5.000 / 4× | 1,25 s | 2,61 s | 5,12 s | 2.198 ms | 825 ms | 7,6 → 10,5 MB |
| **5.000 / 6× (med. 3)** | 1,28 s | **2,99 s** | **6,32 s** | **3.192 ms** | **1.161 ms** | 7,6 → 10,5 MB |

\* FCP și LCP sunt imaginea de splash (`#bf-boot img`), deci LCP nu spune nimic util. Metrica relevantă e „h1 vizibil”.

**Ce se încarcă la pornire:**
- JS: `index` 377 KB + `react-runtime` 193 KB + `local-notifications` 16 KB (decodat), adică 190 KB transfer;
- CSS: `index` 246 KB blocant (44 KB gzip), apoi `deferred-styles` 389 KB (60 KB gzip), sosit la 3,2–3,9 s;
- fonturi: Plex latin (preîncărcat), Fraunces 560 latin + latin-ext (124 KB) și Plex latin-ext, între 1,9 și 4,1 s. CLS măsurat 0,002–0,004, deci bun.
- **Leneș:** `family-sync` 520 KB (din care `re2js` 141 KB, tras de Firestore), `jspdf` 386 KB, `html2canvas` 201 KB, `i18n-en` 282 KB, `AICompanion` 100 KB, `PlanStudio` 96 KB.

**Compoziția `index` (sourcemap):**

| Modul | KB |
|---|---|
| `finance-data.ts` | 64 |
| `Home.tsx` | 36 |
| `household-insights.ts` | 32 |
| `tailwind-merge` | 24 |
| `TodayView.tsx` | 24 |
| `family-crypto.ts` | 15 |
| `useFamilySync.ts` | 12 |
| `monthly-needs.ts` | 11 |

### 2.2 Interacțiuni (active locale, CPU limitat)

INP / blocaj maxim, în ms. Mediana a 3 rulări pentru 1.000@4× și 5.000@6×.

| Acțiune | 0 @6× | 1.000 @4× | 1.000 @6× | 5.000 @4× | **5.000 @6×** |
|---|---|---|---|---|---|
| Tab Plicuri (prima dată, chunk leneș) | 128 / 57 | 112 / 164 | 112 / 203 | 184 / 267 | 120 / 288 |
| Tab Plicuri (a doua oară) | 216 / 70 | 456 / 139 | 704 / 214 | 448 / 200 | **848 / 311** |
| Tab Mișcări | 88 / 68 | 56 / 143 | 72 / 262 | 56 / 641 | 64 / **908** |
| Caută în jurnal „lidl” (per tastă) | 48 / 0 | 184 / 125 | 296 / 196 | 384 / 271 | **584 / 403** |
| Șterge căutarea | 56 / 0 | 296 / 240 | 440 / 358 | 792 / 623 | **1.104 / 885** |
| Arată mișcările mai vechi | n/a | 352 / 278 | 576 / 442 | 976 / 797 | **1.472 / 1.223** |
| Tab Astăzi (din Mișcări) | 56 / 0 | 32 / 186 | 64 / 484 | 64 / 563 | 80 / **863** |
| Tab Astăzi (din Calendar) | 128 / 0 | 224 / 90 | 464 / 304 | 488 / 302 | **704 / 433** |
| Deschide Notează | 96 / 140 | 120 / 95 | 144 / 118 | 184 / 160 | 264 / 233 |
| Tastează suma (per tastă) | 64 / 0 | 64 / 0 | 96 / 0 | 88 / 59 | 152 / 115 |
| **Salvează cheltuiala („Gata”)** | 176 / 131 | 232 / 193 | 320 / 290 | 664 / 638 | **992 / 961** |
| Deschide căutarea (paleta) | 48 / 73 | 80 / 80 | 104 / 90 | 136 / 132 | 216 / 210 |
| Paletă: 8 taste „kaufland” (Σ long) | 0 | 0 | 58 | 886 | **1.037** |
| Paletă: Esc | 56 / 0 | 144 / 109 | 208 / 187 | 176 / 160 | 272 / 244 |
| Mai mult → Obligații → Calendar | ≤ 64 / ≤ 143 | ≤ 56 / ≤ 71 | ≤ 64 / ≤ 115 | ≤ 64 / ≤ 77 | ≤ 88 / ≤ 110 |

**Cum se citește tabelul:**
- La tab-uri, INP e mic pentru că `go()` folosește `startTransition` (`Home.tsx:213`). Lucrul se mută însă imediat după clic: blocajul de 0,5–0,9 s e momentul în care orice atingere următoare e înghețată. Conținutul nou apare după 1,1–1,8 s (5.000@6×).
- Calendarul și Obligațiile sunt ieftine. Problemele sunt pe Astăzi, Mișcări, Plicuri și la salvare.

### 2.3 Profil CPU (5.000 de mișcări, 4×, build de producție mapat pe sursă)

| Fază | Timp ocupat | Funcții fierbinți (inclusiv, ms) |
|---|---|---|
| Pornire | 2.401 ms | `TodayView` 1.059 · `todayBrief` (household-insights.ts:815) 550 · `buildTodaySummary` 385 · `TodayBrief` 301 · `allocationWeeksStatus` (finance-data.ts:1109) 277 · `allocationSpent` (finance-data.ts:973) 250 · `detectSubscriptions` (household-insights.ts:247) 261 · `planCycle` 224 · `weeklyEnvelopeDailyRhythm` (household-insights.ts:1073) 187 · persistare (usePersistAppData.ts:71) 169 · **`weekdayShortLabels` (civil-weekday.ts:9) 163** · `nodePainted` (native-splash.ts:56, layout forțat) 133 |
| Tab Astăzi | 1.905 ms | `TodayView` 550 · `todayBrief` 265 · `buildTodaySummary` 221 · `allocationWeeksStatus` 176 · `advisorSignals` 123 · `writeAppData` (app-storage.ts:238) 120 · persistare 109 · efectul widgetului (Home.tsx:568) 67 |
| Salvează („Gata”) | 1.216 ms | `TodayView` 421 · `todayBrief` 326 · `TodayBrief` 325 · **`weekdayShortLabels` 169 (self 166)** · `allocationWeeksStatus` 145 · persistare sincronă 114 + `writeAppData` 108 · `writeLocalStorageSnapshot` 70 · `todayBrief` din Home.tsx:568 52 |
| Tab Plicuri | 669 ms | `PlanStudio` 211 · `formatDate` (finance-data.ts:335, self 75) · `WeekBand` 35 |
| Caută „lidl” | 1.014 ms | `MovementsJournal` 532 · `matchesQuery` (MovementsJournal.tsx:52, self 208) · `exactMoney` (MovementsJournal.tsx:22) 77 · `formatDate` 89 |
| Paletă „kaufland” | 991 ms | `searchLedgerHits` 670 → `foldRo` (command-search.ts:13, self **593**) |
| Deschide Notează | 636 ms | `QuickEntryPanel` 207 (`envelopeDecisionStatus` pe fiecare plic, QuickEntryPanel.tsx:215) · **Astăzi randat din nou** (`TodayBrief` 87, `TodayView` 62) |

### 2.4 Micro-benchmark-uri pe modulele reale (ms per apel)

| Operație | 1.000 @4× | 5.000 @4× | 5.000 @6× |
|---|---|---|---|
| `syncPortable` (stringify complet) | 2,5 | 16,7 | 16,8 |
| `hashAppPayload` (FNV pe tot JSON-ul) | 1,4 | 7,8 | 12 |
| `localStorage.setItem` al registrului | 6,7 | 41,6 | 71,8 |
| **Persistare sincronă pe modificare** (cele 3 de mai sus) | 10,6 | 66 | **101** |
| `writeAppData` (IDB: stringify + hash + structured clone + put) | 23 | 120 | **142** |
| `normalizeAppData` | 6,5 | 41 | 52 |
| `encryptFamilyData` (gzip + AES + base64) | 26 | 102 | 146 |
| `decryptFamilyData` | 18 | 113 | 112 |
| PBKDF2 250k (în afara firului principal) | 38 | 38 | 40 |
| `mergeFamilyData` | 22 | 95 | 172 |
| `todayBrief` | 9 | 36 | 53 |
| `buildTodaySummary` | 17 | 69 | 101 |
| `searchLedgerHits` (o tastă) | 17 | 63 | 111 |
| filtrul jurnalului (o tastă) | 8 | 34 | 55 |
| `formatDate` × 100 | 25 | 33 | 43 |
| Pachet de sync criptat | 26 KB | 119 KB | 119 KB |

---

## 3. Constatări

### P1-1. „Gata” la o cheltuială îngheață ecranul ~1 s cu registru mare
- **Gravitate:** P1. **Efort:** M.
- **Observat:**
  - INP la „Gata”: 992 ms (5.000@6×), 664 ms (5.000@4×), 232 ms (1.000@4×).
  - După el vin încă 4–5 long tasks de 100–200 ms. Suma blocajelor în 2,5 s: 1,5 s la 5.000@6×.
- **Reproducere:** `measure.mjs` cu `N=5000 CPU=6` (pasul „salvează cheltuiala”).
- **Cauze** (din profil):
  1. **Astăzi se randează integral, cu aceleași calcule făcute de mai multe ori:**
     - `todayBrief(data)` e chemat de 4 ori pe fiecare schimbare: `TodayView.tsx:54` (prin `advisorSignals`), `TodayBrief.tsx:32` (nememoizat), `today-summary.ts:15` și `Home.tsx:577` (efectul widgetului nativ, care rulează și pe web, unde nu face nimic);
     - `weeklyEnvelopeDailyRhythm` și `envelopeRunOut` sunt chemate de câte 2 ori (`TodayView.tsx:63,76` și `186`, `today-summary.ts:16`);
     - `planWeeklyCycle(data)` e nememoizat în corpul componentei (`TodayView.tsx:222`) și cheamă `allocationWeeksStatus` pe fiecare plic;
     - `allocationWeeksStatus` (`finance-data.ts:1109`) filtrează tot registrul la fiecare apel. E chemat din `envelopeDecisionStatus`, `weekTooFast`, `weeklyEnvelopeDailyRhythm`, `planWeeklyCycle` și `allocationWeekStatus`. Asta dă zeci de treceri complete prin registru pe randare.
  2. **`weekdayShortLabels` construiește 7 `Intl.DateTimeFormat` la fiecare apel** (`civil-weekday.ts:9-15`). E chemat de 3 ori pe fiecare zi din banda de ritm (`TodayView.tsx:417, 420, 433`, prin `weekdayShort()`), deci ~150 de formattere pe randare: 166 ms self la 4×.
  3. **Persistarea sincronă intră în același cadru cu clicul:**
     - în React 19, efectele pasive ale unui eveniment discret se execută sincron. `usePersistAppData.ts:70-76` face `syncPortable` + `hashAppPayload` + `localStorage.setItem` de 1,24 MB (~100 ms la 6×);
     - 280 ms mai târziu, `writeAppData` (`app-storage.ts:238-240`) face din nou `JSON.stringify` + hash pe tot registrul, plus clonarea pentru IDB (~142 ms).
- **Remediere:**
  - un singur „derivat al zilei”: `useMemo(() => deriveToday(data, today), [data, today])` în `Home`, transmis ca prop lui `TodayView`, `TodayBrief`, `advisorSignals` și efectului widgetului. Efectul widgetului (`Home.tsx:568-584`) să ruleze doar dacă `isNativeApp()`;
  - un cache pe durata unui tick pentru funcțiile pure grele: `WeakMap<AppData, Map<string, …>>` golit cu `queueMicrotask`, cu cheia `allocation.id` + `asOf`. Mutațiile pe loc invocate în comentariul de la `finance-data.ts:931-934` nu pot apărea în mijlocul unei randări, deci cache-ul e sigur și rezolvă obiecția de acolo;
  - `weekdayShortLabels`: memorează rezultatul pe locale (`Map<string, string[]>`), iar în `TodayView` calculează-l o dată;
  - persistare:
    - scrie localStorage în `requestIdleCallback`, sau păstrează în LS doar un „head” mic, cu IDB ca sursă primară;
    - trimite lui `writeAppData` șirul și hash-ul deja calculate, în loc să le refacă;
    - sari scrierea dacă hash-ul e egal cu ultimul scris.
- **Estimare după** (5.000@6×):
  - INP „Gata” de la ~990 la **~350–450 ms**: −todayBrief ×3 ≈ 160, −weekdayShort ≈ 250, −persistare sincronă ≈ 100, −duplicatele de `allocationWeeksStatus` ≈ 150;
  - la 1.000@4×: de la 232 la ~110 ms.

### P1-2. Revenirea pe Astăzi recalculează tot, de fiecare dată
- **Gravitate:** P1. **Efort:** M.
- **Observat:**
  - blocaj de 863 ms (5.000@6×, din Mișcări), 433 ms din Calendar (INP 704);
  - la 1.000@6×: 484 ms;
  - conținutul apare la ~1,8 s.
- **Cauză:**
  - vederile sunt montate condiționat (`Home.tsx:606-620`), deci `useMemo`-urile din `TodayView` (8 la număr) se pierd la fiecare schimbare de tab. Cum `data` nu s-a schimbat, e muncă pur repetată;
  - la asta se adaugă calculele nememoizate de la P1-1.
- **Remediere:**
  - cache la nivel de modul pe identitatea lui `data`, de exemplu `let last = { data, today, result }` în `useTodaySummary` și în „derivatul zilei”. Astfel revenirea costă doar randarea React;
  - alternativ, păstrează Astăzi montat și ascuns (`<Activity mode="hidden">` în React 19.2, sau `hidden`) atât timp cât `data` e aceeași.
- **Estimare după:** blocaj la revenire de la ~860 la **~200 ms** (5.000@6×). Rămâne DOM-ul și stilul (vezi P2-10).

### P1-3. Pornirea cu registru mare face de 2–3 ori lucrul greu
- **Gravitate:** P1. **Efort:** M.
- **Observat** (5.000@6×):
  - h1 la 2,99 s, TTI 6,3 s, TBT 3,2 s;
  - după primul ecran vin încă ~10 long tasks de 100–630 ms;
  - la pornire au loc 2 scrieri complete în LS (81 + 83 ms), fiecare cu `writeAppData` (~142 ms) și o randare completă a Astăzi (~550 ms la 4×).
- **Reproducere:** `measure.mjs` (câmpul `ls` din `startup`). Cu `diff.mjs` se vede ce se schimbă la prima intrare pe Astăzi.
- **Cauze:**
  1. **Hidratarea:**
     - `usePersistAppData.ts:45-58` alege între LS și IDB. Chiar când hash-urile sunt egale, cheamă `adoptOutsideExpenses(normalizeAppData(picked))`, care produce un obiect nou;
     - asta declanșează o a doua randare completă a Astăzi și o rescriere a registrului neschimbat;
     - `resolveHydrateMerge` (`app-storage.ts:199-216`) face în plus un `JSON.stringify(memory)` complet doar pentru hash.
  2. `readInitialAppData` (`usePersistAppData.ts:20-27`) face deja `JSON.parse` + `normalize` + `adopt` sincron înainte de primul cadru, iar hidratarea repetă normalizarea.
  3. **Scriere o singură dată:** `TodayView.tsx:225-229` marchează tranșa văzută (`seenWeeklyPlanTranches`) printr-un eveniment care modifică `data`. Asta duce la încă o randare completă și încă o scriere de 1,24 MB, la prima intrare din fiecare săptămână. E confirmat cu diff pe registru.
- **Remediere:**
  - la hidratare, dacă `indexed.hash === hash(LS brut)` (hash-ul e deja în meta), returnează `current`. Nu normaliza și nu seta nimic;
  - calculează hash-ul memoriei din șirul brut deja citit, nu cu un stringify nou;
  - ține `seenWeeklyPlanTranches` în preferințele locale (localStorage mic), nu în registru. Oricum nu se sincronizează (`family-crypto.ts:99`).
- **Estimare după** (5.000@6×): TBT de la 3,2 s la **~1,5–1,8 s**, TTI de la 6,3 s la **~4,3 s**. Împreună cu P1-1 și P1-2 (Astăzi mai ieftin): **TBT ~1,3 s**.

### P1-4. Jurnalul (Mișcări) randează ~280 de rânduri deodată și le refolosește prost
- **Gravitate:** P1. **Efort:** M.
- **Observat** (5.000@6×):
  - intrarea în Mișcări: blocaj 908 ms, conținutul apare la ~1,7 s;
  - „Șterge căutarea”: INP 1.104 ms;
  - „Arată mișcările mai vechi”: INP 1.472 ms;
  - la 1.000@4× aceleași acțiuni costă 143 / 296 / 352 ms. Costul crește liniar cu numărul de rânduri, ~3 ms pe rând la 6×.
- **Cauze** (`MovementsJournal.tsx`):
  - `DAYS_PER_PAGE = 30` (linia 26) înseamnă ~280 de rânduri la 5.000 de mișcări. Fiecare rând are 2 SVG-uri lucide, 2 butoane și handlere de swipe;
  - `exactMoney` (linia 22) construiește un `Intl.NumberFormat` pe fiecare rând la fiecare randare;
  - `dateText` → `formatDate` (`finance-data.ts:335-338`) construiește un `Intl.DateTimeFormat` pe fiecare zi;
  - `colorFor(data, memberId)` e chemat de 2 ori pe rând;
  - banda săptămânii face `data.transactions.some(...)` pentru fiecare din cele 7 zile, la fiecare randare, plus un `new Intl.DateTimeFormat` pe zi;
  - `useEffect(() => setVisibleDays(DAYS_PER_PAGE), [list])` (linia 95) forțează o a doua randare la orice schimbare de filtru;
  - rândurile nu sunt `memo`, iar zilele nu au `content-visibility`;
  - efectul `knownIds` (linia 63) face `join` pe toate ID-urile la fiecare schimbare a registrului.
- **Remediere:**
  - paginează pe rânduri, nu pe zile (primele ~40 de rânduri, apoi încă 40 la derulare cu `IntersectionObserver`), sau virtualizează lista (lista e simplă, cu înălțimi aproape fixe);
  - `const MovementRow = memo(...)`;
  - formattere la nivel de modul;
  - `.bf-movement-day { content-visibility: auto; contain-intrinsic-size: auto 320px }`;
  - resetează `visibleDays` în handlerul de filtru, nu în efect;
  - un `Set` cu zilele care au mișcări, în `useMemo`.
- **Estimare după** (5.000@6×): intrarea în Mișcări de la ~900 la **~250 ms**; „Șterge căutarea” de la 1,1 s la **~250 ms**; „Mai vechi” de la 1,5 s la **~200 ms**.
  - Experimentul cu formattere Intl puse în cache global (fără alte schimbări) a scos 17% din „Mai vechi” (1.472 → 1.224). Deci câștigul mare vine din numărul de rânduri, nu din formattere.

### P2-5. Căutarea în jurnal refiltrează tot registrul la fiecare tastă
- **Gravitate:** P2. **Efort:** S.
- **Observat:** INP pe tastă 584 ms (5.000@6×), 184 ms (1.000@4×). În profil, `matchesQuery` are 208 ms self pentru 4 taste la 4×.
- **Cauză:** `MovementsJournal.tsx:52` construiește la fiecare tastă, pentru fiecare mișcare, un șir cu `join` + `toLocaleLowerCase("ro-RO")`. Același lucru se face și pentru `todayMoves` (linia 57, nememoizat).
- **Remediere:**
  - un index `useMemo(() => data.transactions.map(t => [t, lower(haystack)]), [data.transactions])`;
  - `useDeferredValue(query)` pentru listă;
  - `todayMoves` în `useMemo`.
- **Estimare după:** filtrarea de la 55 la ~5 ms per tastă la 6×. INP per tastă de la ~580 la **~120 ms** (restul e randarea listei, care se reduce și prin P1-4).

### P2-6. Paleta de căutare normalizează Unicode pe tot registrul la fiecare tastă
- **Gravitate:** P2. **Efort:** S.
- **Observat:** 8 taste „kaufland” produc ~1,0 s de long tasks (5.000@6×). În profil, `foldRo` are **593 ms self** (`command-search.ts:13`), cu `toLocaleLowerCase` + `normalize("NFD")` + regex pe fiecare mișcare și la fiecare tastă.
- **Cauză:** `searchLedgerHits` (`command-search.ts:32-38`) filtrează tot și abia apoi aplică `slice(0, 6)`. Nu se oprește la primele 6 rezultate.
- **Remediere:**
  - la deschiderea paletei, calculează o dată haystack-ul „împăturit” (cache `WeakMap<Transaction[], string[]>`);
  - o buclă care se oprește la `limit`;
  - `useDeferredValue` pe interogare.
- **Estimare după:** de la ~130 la **<10 ms per tastă** (5.000@6×).
- **Observație de UX:** paleta nu pune focusul în câmp. Focusul rămâne pe `section[role=dialog]`, deci pe telefon trebuie încă o atingere înainte de a tasta.

### P2-7. Plicuri (a doua deschidere): INP 850 ms
- **Gravitate:** P2. **Efort:** M.
- **Observat:**
  - prima deschidere are INP bun (120 ms), pentru că Suspense pictează imediat indicatorul de încărcare;
  - la a doua, chunk-ul e în memorie și randarea completă a `PlanStudio` intră în interacțiune: 848 ms la 5.000@6×, 456 ms la 1.000@4×.
- **Cauză:**
  - `PlanStudio.tsx` nu are niciun `useMemo`;
  - `formatDate` (`finance-data.ts:335-338`, un `Intl.DateTimeFormat` nou pe apel) apare cu 75–97 ms self la 4×;
  - blocurile de la `PlanStudio.tsx:442-512` recalculează starea fiecărui plic prin `allocationWeeksStatus`.
- **Remediere:**
  - cache de formattere în `formatDate`, cu cheia `locale|JSON(options)`;
  - cache-ul pe tick de la P1-1 pentru `allocationWeeksStatus`/`allocationStatus`;
  - `useMemo` pe listele de plicuri.
- **Estimare după:** de la 848 la **~300 ms** (5.000@6×).

### P2-8. Orice schimbare de stare din Home randează din nou vederea curentă
- **Gravitate:** P2. **Efort:** S–M.
- **Observat:**
  - „Deschide Notează”: INP 264 ms (5.000@6×). Profilul arată că `TodayView` + `TodayBrief` se randează din nou doar pentru că se deschide modalul;
  - „Paletă: Esc”: `processing` de 273 ms pentru o singură tastă, doar randarea din nou a Astăzi;
  - același lucru se întâmplă când dispare bara „Anulează”.
- **Cauză:** în tot codul client nu există niciun `memo(`. `Home.tsx` nu are niciun `useCallback`, iar `current()` (`Home.tsx:606-620`) dă vederii zeci de lambda-uri noi la fiecare randare.
- **Remediere:**
  - `export const TodayView = memo(function TodayView…)`, la fel pentru `MovementsJournal` și `PlanStudio`;
  - callback-uri stabile: `useCallback`, sau un `useEvent` (ref + funcție stabilă) pentru `onEdit`, `onGo`, `onChange` și celelalte.
- **Estimare după:** deschiderea Notează de la 264 la ~100 ms, Esc în paletă de la 272 la ~50 ms (5.000@6×). Câștig indirect la fiecare toast și modal.

### P2-9. Sincronizarea costă ~0,5 s de fir principal pe fiecare modificare, plus 2 PBKDF2
- **Gravitate:** P2. **Efort:** M.
- **Observat:** am măsurat prin benchmark pe modulele reale și prin citirea codului, fără server real. Pentru o sesiune conectată, la fiecare modificare:
  1. `useFamilySync.ts:450`: `syncPortable(data)` complet în efect, sincron (17 ms la 6×);
  2. după 800 ms (`useFamilySync.ts:453-489`):
     - `fetchFamilyEnvelope`;
     - `decryptFamilyData` (112 ms), cu PBKDF2 250k pe sarea pachetului;
     - `normalizeAppData` (52 ms);
     - `mergeFamilyData` (172 ms);
     - două `syncPortable` pentru comparație (34 ms);
     - `encryptFamilyData` (146 ms), cu **încă un PBKDF2**, pentru că sarea e aleatorie la fiecare push (`family-crypto.ts:80-82`);
     - la final încă un `syncPortable` (17 ms).
  3. Dacă unirea schimbă ceva, urmează `setData`, deci o nouă persistare (P1-1) și o randare completă.
- **Total:** ≈ **550 ms de fir principal** la 5.000@6×, plus 2 × ~40–70 ms de PBKDF2 (în afara firului principal, dar pe drumul critic al latenței). Pachetul are 119 KB datorită gzip-ului. Compresia a fost implementată de la auditul trecut.
- **Remedieri:**
  - păstrează `iv`/`createdAt` al ultimului pachet văzut. Dacă `remoteEnvelope.iv` e același cu cel de la ultima unire, sari peste decriptare, normalizare și unire. Listener-ul realtime oricum aplică schimbările partenerului;
  - cache pentru cheia AES derivată: `Map<salt, CryptoKey>` pe sesiune, și refolosește sarea camerei (sare stabilă pe cameră, IV aleatoriu pe push, ceea ce e sigur cu AES-GCM). Dispare un PBKDF2 pe push și unul pe primire;
  - `toBase64` (`family-crypto.ts:37-41`) concatenează caracter cu caracter pe 119 KB. Folosește `String.fromCharCode.apply` pe bucăți de 32 KB, sau `Uint8Array.prototype.toBase64` unde există;
  - pe termen mediu, mută criptarea, unirea și `syncPortable` într-un Web Worker.
- **Estimare după:** fir principal pe modificare de la ~550 la **~120 ms** (5.000@6×); latența până la push scade cu ~80–130 ms.

### P2-10. CSS-ul (635 KB, ~7.950 de selectori) dublează costul de stil al fiecărui ecran
- **Gravitate:** P2. **Efort:** L.
- **Observat:**
  - 80 de fișiere sursă, **3.320 de `!important`** în sursă și 2.559 în build (1.001 în `index` + 1.558 în `deferred-styles`);
  - selectori: 3.179 în `index` și 4.777 în `deferred`; **2.413 au ca ultim element un tag sau `*`** (de exemplu `html body .os-shell :is(small, …)`, `.bf-app *`, `.bf-app ::after`), deci se verifică pe fiecare element de acel tip;
  - în trace, cei mai scumpi selectori au 4.215 încercări fiecare, adică tot DOM-ul: `html body .os-shell :is(.os-hero, …)`, `:where(.space-y-1 > :not(:last-child))`, `.bf-app *`, `.bf-app ::after`.
- **Experiment** (1.000@4×, tur Plicuri → Mișcări → Astăzi → Mai mult → Astăzi, timp de „Recalculate Style” din `Performance.getMetrics`):

| Variantă | Stil pe tur |
|---|---|
| Bază | 624 ms (repetare: 622) |
| Fără `deferred-styles.css` | **292 ms (−53%)** |
| `prefers-reduced-motion` | 437 ms (−30%; recalculări pe Plicuri: 77 → 22) |
| Fără regulile `.bf-app *` | 652 ms (fără efect) |

- **Concluzie:** volumul de reguli contează, nu o regulă anume. Pe tab-ul Plicuri, stilul reprezintă ~jumătate din blocaj (246 din ~476 ms). Foaia amânată sosește la 3,2–3,9 s pe Slow 4G și declanșează o restilizare completă după ce ecranul e deja folosit. Straturile de tip `ui-modern-pass`, `ui-modern-pass-aggressive`, `ui-modern-pass-max`, `display-fixes-pass`, `contrast-fix` și `visual-polish` se suprascriu una pe alta cu `!important`.
- **Remediere:**
  - consolidează pe ecran: un fișier CSS per chunk leneș, cum e deja `PlanStudio-*.css`;
  - elimină straturile „pass/fix” prin contopire în regulile de bază;
  - înlocuiește `html body .os-shell :is(tag, …)` cu clase;
  - scoate `:where(.space-y-1 > …)` și restul utilitarelor Tailwind nefolosite;
  - adaugă un buget în CI: `deferred-styles` sub 150 KB, niciun `!important` nou.
- **Estimare după:** −40–50% din timpul de stil la fiecare navigare (~100–250 ms la 5.000@6× pe Plicuri și Mișcări) și −60 KB gzip descărcați.

### P2-11. Service worker: ecranele leneșe nu merg offline pe web, iar cache-ul crește la nesfârșit
- **Gravitate:** P2 pe web; nu afectează APK-ul, unde SW-ul nu e înregistrat. **Efort:** S.
- **Observat:**
  - `client/public/sw.js` pune în cache la instalare doar 6 fișiere de shell;
  - JS/CSS cu hash intră în cache abia când sunt cerute. Prima vizită nu e controlată de SW, deci nici pachetul principal nu e în cache până la a doua deschidere;
  - `PlanStudio`, `MovementsJournal`, `QuickEntryPanel` etc. lipsesc offline dacă n-au fost deschise înainte;
  - versiunile vechi cu hash rămân în același `CACHE` până la creșterea manuală a lui `v91` (26 de creșteri în 225 de commituri). Fiecare build adaugă ~1 MB.
- **Remediere:**
  - un plugin Vite care emite `precache.json` cu fișierele din build;
  - SW-ul le adaugă la `install`, iar la `activate` șterge intrările cu hash care nu sunt în listă;
  - numele cache-ului derivat din `BUILD_ID`.
- **Estimare după:** a doua pornire pe web, pe rețea lentă, nu mai așteaptă nimic din rețea pentru JS/CSS (~1,3 s câștigat pe Slow 4G la ecranele leneșe). Cache-ul rămâne mărginit la ~1,5 MB.

### P3-12. Bucăți mici care ar putea ieși din pachetul de pornire
- **Gravitate:** P3. **Efort:** S.
- `tailwind-merge` (24 KB) intră în `index` doar prin `cn()` din `ErrorBoundary.tsx:1`. Folosește `clsx` sau concatenare simplă.
- `family-crypto.ts` (15 KB) intră în `index` prin importul static din `EnvelopeConflictBanner.tsx:9`. Mută `activeAllocationConflicts`/`activeTransactionConflicts` într-un modul mic `sync-conflicts.ts`.
- **Estimare după:** −40 KB decodat, −13 KB gzip, adică ~70 ms mai puțin pe Slow 4G și ~15 ms parse la 4×.
- `family-sync` (520 KB) conține `re2js` 141 KB, tras de Firestore 12. Se încarcă leneș, dar costă ~150–250 ms de parse la 6× la reluarea sesiunii. Merită verificat dacă o versiune de Firestore fără `re2js` (sau importul `firebase/firestore/lite` pentru `fetchFamilyEnvelope`) e posibilă.

### P3-13. Fonturi
- **Gravitate:** P3. **Efort:** S.
- **Observat:** Fraunces 560 latin (66 KB) + latin-ext (58 KB) și Plex latin-ext (26 KB) sosesc la 1,9–4,1 s. Doar Plex latin e preîncărcat.
- **Remediere:** un singur subset Fraunces cu latin de bază + ĂÂÎȘȚăâîșț (~30–35 KB), cu `unicode-range` explicit.
- **Estimare după:** −90 KB descărcați la prima vizită.

### P3-14. `nodePainted` forțează layout sincron la pornire
- **Gravitate:** P3. **Efort:** S.
- `native-splash.ts:56-68` cheamă `getBoundingClientRect` + `getComputedStyle` în rAF până apare ecranul: 133 ms atribuiți la 4× cu 5.000 de mișcări.
- Lucrul oricum trebuia făcut, dar e tras înainte, în același task cu randarea Astăzi.
- **Remediere:** semnal explicit din `TodayView` (marcajul `bf-today-painted` există deja) în loc de interogare prin layout.

### P3-15. Animațiile de intrare mută rândurile, iar asta produce multe recalculări de stil
- **Gravitate:** P3. **Efort:** S.
- **Observat:** `bf-delight-row-in`, `bf-delight-panel-in` și `bf-screen-mobile-enter` animă doar `transform`/`opacity` (bine, pe compositor). Pornirile decalate produc însă 60–80 de recalculări pe o navigare. Fără animații, stilul scade cu 30%.
- **Remediere:** animă containerul, nu fiecare rând, și limitează decalajul la primele 6 elemente.

---

## 4. Idei de dezvoltare (performanță), prioritizate

1. **Buget de performanță în CI.** Scriptul `measure.mjs` din scratchpad, adaptat ca `e2e/perf.e2e.mjs`, cu 5.000 de mișcări și CPU 4×. Eșuează dacă:
   - INP la „Gata” depășește 300 ms;
   - blocajul la Mișcări depășește 300 ms;
   - TBT la pornire depășește 1,5 s.
   Pe lângă asta, raportează `bf-today-painted` în locul LCP-ului din splash.
2. **Agregate incrementale:** un index `cheltuit[plic][săptămână]` actualizat la adăugarea sau ștergerea unei mișcări, în locul trecerilor complete prin registru. Astăzi și Plan devin O(plicuri), independent de mărimea registrului.
3. **Worker pentru date:** normalizare, unire, criptare, căutare și rapoarte într-un Web Worker, cu `postMessage` pe structuri transferabile.
4. **Arhivă pe ani:** mișcările din ciclurile încheiate de peste 12 luni mutate într-un store IDB „rece”, încărcat doar în Analiză/Jurnal la cerere. Registrul „cald” rămâne sub 1.500 de mișcări pentru orice familie, iar localStorage nu mai atinge cota.
5. **Diagnostic local:** în Setări → Despre, afișează ultimele valori `web-vitals` deja colectate de `performance-monitor.ts` (INP, pornire), ca utilizatorul să poată trimite cifre în feedback.
6. **Precache de ecrane în timp mort:** după `bf-today-painted`, `requestIdleCallback` → `import()` pentru Notează, Mișcări și Plan. Legătura există deja la `pointerdown` (`preloadView`), iar asta ar elimina și prima așteptare.

## 5. Ce e deja foarte bine

- Împărțirea în chunk-uri e corectă: Firebase, jsPDF, html2canvas, OCR, AI, i18n-en și toate ecranele secundare se încarcă leneș, iar la pornire vin doar 4 fișiere JS.
- `isoToday()` are formatterul în cache (remedierea din auditul trecut e confirmată), iar `allocationWeeksStatus` face o singură trecere pe plic.
- Pachetul de sync e comprimat cu gzip înainte de criptare (119 KB la 5.000 de mișcări, față de 1,24 MB JSON).
- Jurnalul grupează în O(n) și paginează. Nu mai randează mii de rânduri.
- Memoria e mică și stabilă: 7,6 → 10,5 MB după un tur complet cu 5.000 de mișcări, fără creștere la navigări repetate. CLS e ~0.
- CSS-ul critic e inline pentru boot, `backdrop-filter` e oprit pe mobil, `content-visibility` e pus pe secțiunile de sub fold ale Astăzi, iar tab-urile folosesc `startTransition`.
- Calendarul și Obligațiile rămân sub 120 ms chiar și cu 5.000 de mișcări la 6×.

## Anexă: fișiere de lucru (scratchpad)

`/tmp/claude-0/-home-user-buget-familie/6251941a-2f52-5fdd-bb21-2d9641b66e0b/scratchpad/agenti/perf/`

| Fișier | Ce conține |
|---|---|
| `dist/`, `dist-map/` | build de producție, fără și cu sourcemap |
| `serve.mjs` | server static cu gzip |
| `seed.mjs`, `seed-1000.json`, `seed-5000.json` | date de test |
| `common.mjs`, `measure.mjs`, `summarize.mjs`, `res-*.json` | pornire și interacțiuni (INP, long tasks, scrieri LS) |
| `profile.mjs`, `profile-N5000-cpu4.json` | profil CPU mapat pe sursă |
| `bench.mjs`, `bench.json` | micro-benchmark-uri (persistare, criptare, derivări) |
| `composition.mjs` | compoziția chunk-urilor din sourcemap |
| `cssdup.py`, `cssexp.mjs`, `selstats.mjs`, `cls.mjs` | analiza CSS, experimente de stil, CLS |
| `diff.mjs` | ce scrie în registru o schimbare de tab |
