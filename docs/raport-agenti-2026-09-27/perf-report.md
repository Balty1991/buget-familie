# Buget Familie: audit de performanță, runda a treia

Commit `5b63e2a`, v1.1.96. Data: 27.09.2026. Rol: performanță. Nu am modificat nimic în repo în afară de acest fișier și nu am trimis nicio cerere spre Firebase. Build-urile și scripturile sunt în scratchpad (vezi anexa).

## 1. Pe scurt

- **Notă globală: 7/10** (runda trecută: 6/10).
- **Cu registru mare, câștigul e real și măsurabil.** La 5.000 de mișcări pe CPU 6×:
  - pornire: TBT de la 3,19 s la **1,78 s** (−44%), TTI de la 6,3 s la **4,6 s**;
  - „Gata” la o cheltuială: INP de la 992 la **536 ms** (−46%);
  - jurnalul:
    - intrarea în Mișcări: blocaj de la 908 la **226 ms**;
    - „Șterge căutarea”: INP de la 1.104 la **96 ms**;
    - „Arată mișcările mai vechi”: INP de la 1.472 la **368 ms**;
  - paleta: „Esc” de la 272 la **48 ms**, deschiderea de la 216 la **40 ms**.
- **Ce rămâne lent** (5.000@6×):
  - „Gata”: 0,54 s;
  - Plicuri, a doua deschidere: 0,66 s;
  - **foaia nouă „+ Plic”: 0,56 s la deschidere și 0,42 s la închidere**;
  - Astăzi, la revenire: 0,41 s;
  - paleta: 8 taste „kaufland” produc încă 0,74 s de long tasks.
- **Cauzele de acum sunt altele decât în runda trecută:**
  1. `tickMemo` elimină calculele duplicate *în cadrul* unei randări. După orice modificare, însă, `data` e un obiect nou, deci totul se recalculează la rece.
  2. Calea cea mai fierbinte e `addIsoDays`. E apelată **pentru fiecare mișcare**, prin `recurringPaidInPlan → inPlanPeriod → planCoverEndDate → paydayWindow`.
  3. `PlanStudio` nu are niciun `useMemo`. Deschiderea foii „+ Plic” randează din nou toată lista de plicuri, cu istoricul pe 6 luni al fiecăruia.
  4. Paleta și jurnalul sortează tot registrul cu `localeCompare` la fiecare tastă.
- **Regresie mică la registru gol.** La 0 mișcări, TBT a crescut de la 195 la 390 ms (4×) și de la 457 la 858 ms (6×). Cauzele: un `toLocaleDateString` pe randare și layoutul forțat din `nodePainted`, care încă rulează.
- **Sincronizarea:** criptarea și decriptarea au ieșit de pe firul principal. Unirea (~190 ms la 6×), clonarea spre worker și înapoi (~2 × 57 ms) și o copie de 309 KB a „bazei de sync” scrisă de două ori în localStorage rămân pe firul principal. Estimez ~0,4 s de fir principal pe fiecare trimitere, față de ~0,55 s înainte.
- **Pachetele:**
  - JS la pornire: 184 KB transfer (runda trecută: 190);
  - CSS: 635 KB în build, neschimbat, din care 249 KB blocant (45 KB gzip);
  - CSS sursă: 927 KB, sub plafonul de 935 KB;
  - memoria: 6,4 → 9,8 MB după un tur complet (runda trecută: 7,6 → 10,5).

## 2. Cum am măsurat

Metoda e aceeași ca pe 26.09, ca cifrele să fie comparabile. Am refolosit aceleași scripturi, cu datele regenerate pe schema de acum.

- **Build:** build de producție `GITHUB_PAGES=true vite build --outDir <scratchpad>/agenti3/perf/dist`, plus un al doilea cu `--sourcemap` pentru profil. L-am servit cu un server static cu gzip, ca GitHub Pages, pe porturile 4180 și 4181. Serverul de dezvoltare de pe 5174 l-am folosit doar în citire, pentru a genera datele și pentru micro-benchmark-uri.
- **Browser:** Chromium headless, 390×844, DPR 2, touch, `ro-RO`, fus Europe/Bucharest, service worker blocat, gazdele externe blocate.
- **Condiții:**
  - la pornire: rețea Slow 4G (150 ms, 1,6 Mbps), cache dezactivat;
  - la interacțiuni: fără limitare de rețea;
  - CPU 4× și 6×.
- **Date:** 0, 1.000 și 5.000 de mișcări pe 18 luni, 8 plicuri, 2 plăți recurente și o datorie (255 KB și 1,27 MB JSON). Le-am scris direct în localStorage și IndexedDB (`buget-familie:app-data-v6` + meta + IDB `buget-familie/app/data`).
- **Metrici:**
  - INP = durata maximă Event Timing pe interacțiune;
  - „blocaj” = cel mai lung long task în 2,5 s după acțiune;
  - „h1” = primul `#root h1`, adică cifra zilei;
  - TTI = sfârșitul ultimului long task urmat de 5 s de liniște.
  Clicurile se fac prin coordonate, fără interogări ARIA în pagină.
- **Repetări:** pentru 1.000@4× și 5.000@6× am rulat de 3 ori și raportez mediana. Restul sunt rulări unice. Variația e de ±15–25%.
- **Pas nou:** deschiderea și închiderea foii „+ Plic” (`.bf-add-envelope`, apoi clic pe fundal).
- **Rezervă:** e un desktop încetinit, nu un Android real. Micro-benchmark-urile rulează pe modulele de dezvoltare (neminificate), deci se compară între ele, nu cu build-ul.

## 3. Cifrele de acum vs. 26.09

### 3.1 Pornire (Slow 4G, cache rece)

| Mișcări / CPU | h1 vizibil (26.09 → acum) | TTI | TBT | Long task max | Heap pornire → după tur |
|---|---|---|---|---|---|
| 0 / 4× | 2,00 → 2,22 s | 3,32 → 3,38 s | 195 → **390 ms** ⚠ | 209 → 363 ms | 3,1 → 5,7 MB (la fel) |
| 0 / 6× | 2,25 → 2,69 s | 3,62 → 4,12 s | 457 → **858 ms** ⚠ | 410 → 700 ms | la fel |
| 1.000 / 4× (med. 3) | 2,30 → 2,46 s | 3,71 → 3,59 s | 716 → 777 ms | 492 → 620 ms | 4,5→7,3 / 4,2→7,3 MB |
| 1.000 / 6× | 2,71 → 2,89 s | 4,43 → 4,15 s | 1.319 → 1.361 ms | 853 → 906 ms | la fel |
| 5.000 / 4× | 2,61 → 2,47 s | 5,12 → **4,02 s** | 2.198 → **1.201 ms** | 825 → 732 ms | 7,6→10,5 / 6,4→9,8 MB |
| **5.000 / 6× (med. 3)** | 2,99 → **2,88 s** | 6,32 → **4,62 s** | 3.192 → **1.776 ms** | 1.161 → **1.040 ms** | 7,6→10,5 / 6,4→9,8 MB |

- FCP și LCP sunt tot imaginea de splash: 1,27–1,48 s, practic neschimbate. Nu spun nimic util.
- Numărul de scrieri complete în LS la pornire a scăzut de la 2 la 1 (1,24 MB). Hidratarea nu mai randează de două ori (P1-3 confirmat).

### 3.2 Interacțiuni: INP / blocaj maxim (ms)

| Acțiune | 1.000@4× 26.09 | **1.000@4× acum** | 5.000@6× 26.09 | **5.000@6× acum** |
|---|---|---|---|---|
| Tab Plicuri (prima dată) | 112 / 164 | 144 / 248 | 120 / 288 | 176 / 403 |
| Tab Plicuri (a doua oară) | 456 / 139 | 296 / 174 | 848 / 311 | **656 / 299** |
| **Deschide foaia „+ Plic”** (nou) | n/a | 312 / 178 | n/a | **560 / 482** |
| **Închide foaia „+ Plic”** (nou) | n/a | 200 / 170 | n/a | **424 / 358** |
| Tab Mișcări | 56 / 143 | 112 / 57 | 64 / 908 | 216 / **226** |
| Caută „lidl” (per tastă) | 184 / 125 | 88 / 0 | 584 / 403 | **208 / 122** (Σ 392) |
| Șterge căutarea | 296 / 240 | 64 / 0 | 1.104 / 885 | **96 / 207** |
| Arată mișcările mai vechi | 352 / 278 | 168 / 76 | 1.472 / 1.223 | **368 / 218** |
| Tab Astăzi (din Mișcări) | 32 / 186 | 168 / 0 | 80 / 863 | **408 / 188** |
| Tab Astăzi (din Calendar) | 224 / 90 | 144 / 0 | 704 / 433 | 280 / 82 |
| Deschide Notează | 120 / 95 | 56 / 56 | 264 / 233 | 80 / 99 |
| Tastează suma (per tastă) | 64 / 0 | 176 / 0 | 152 / 115 | 128 / 69 |
| **Salvează cheltuiala („Gata”)** | 232 / 193 | **208 / 148** | 992 / 961 | **536 / 483** (Σ 733, înainte 1,5 s) |
| Deschide căutarea (paleta) | 80 / 80 | 24 / 0 | 216 / 210 | 40 / 75 |
| Paletă: 8 taste „kaufland” (Σ long) | 0 | 0 | 1.037 | **739** (INP 240) |
| Paletă: Esc | 144 / 109 | 48 / 0 | 272 / 244 | 48 / 0 |
| Mai mult → Obligații → Calendar | ≤ 56 / ≤ 71 | ≤ 96 / ≤ 78 | ≤ 88 / ≤ 110 | ≤ 112 / ≤ 119 |

**Cum se citește tabelul:**
- La 5.000@6×, blocajele de 0,9–1,2 s din jurnal au dispărut.
- Tab-urile au acum INP mai mare și blocaj mai mic, deoarece o parte din lucru intră în cadrul clicului. Suma a scăzut însă mult: Mișcări Σ 467 ms față de ~1,5 s.
- La 1.000@4× aproape totul e sub 200 ms, cu excepția Plicurilor și a foii „+ Plic”.

### 3.3 Profil CPU (5.000 de mișcări, 4×, build mapat pe sursă)

Timp ocupat pe fază, 26.09 → acum:

| Fază | Ocupat | Funcții fierbinți acum (ms) |
|---|---|---|
| Pornire | 2.401 → **1.808** | `TodayView` 833 incl. · `tickMemo` 636 · `buildTodaySummary` 400 · `planCycle` (plan-cycle.ts:5) 297 · `planAllocationMath` (finance-data.ts:1053) 266 · **`pendingRecurringInPlan` → `recurringPaidInPlan` (finance-data.ts:1698 → 1684) 254** · `inPlanPeriod` (959) 230 → `planCoverEndDate` (895) → `paydayWindow` (910) → **`addIsoDays` (898): 202 self** · `nodePainted` (native-splash.ts:56) 171 self · `allocationSpent` (996) 108 self |
| Salvează („Gata”) | 1.216 → **971** | `TodayView` 490 · `buildTodaySummary` 216 · **`addIsoDays` 127 self** · `recurringPaidInPlan` 136 · persistare (usePersistAppData.ts:96) 137, din care `setItem` 55 și `localSnapshotText` (app-storage.ts:243) 55 · `TodayBrief` 134 · `planCycle` 124 |
| Deschide + Plic (nou) | **698** | `PlanStudio` 533 · blocul plicurilor (PlanStudio.tsx:468) 298 · **istoricul lunar pe plic (PlanStudio.tsx:534 → `envelopeMonthlyHistory`, household-insights.ts:1042–1048) 206** · `sourceFreeBalance` pentru opțiunile de sursă (PlanStudio.tsx:261) 168 · `recurringPaidInPlan` 211 |
| Tab Plicuri | 669 → 587 | `PlanStudio` 230 · aceleași funcții, la scară mai mică |
| Plicuri → Astăzi | 1.043 → 834 | `PlanStudio` 301 (ieșirea) · `TodayView` doar 101 (cache-ul merge) · **`scrollTo` 104 self** (Home.tsx:188, layout forțat) |
| Caută „lidl” | 1.014 → **466** | `MovementsJournal` 233 · sortarea (MovementsJournal.tsx:77) 136 · `haystackOf` la prima trecere (58) 68 |
| Paletă „kaufland” | 991 → 809 | **comparatorul sortării (command-search.ts:40) 408 self** · `searchLedgerHits` 471 · sortarea fără interogare (QuickActionsPalette.tsx:35) 84 |

Registru gol (0@4×), pornire 632 ms ocupat:
- `nodePainted` 110 ms (layout forțat);
- `today-summary.ts:75` 61 ms (`toLocaleDateString` cu formatter nou pe apel);
- `scrollTo` 38 ms;
- restul e React.

### 3.4 Micro-benchmark-uri (ms per apel, module de dezvoltare)

| Operație | 5.000@4× 26.09 | 5.000@4× acum | 5.000@6× 26.09 | 5.000@6× acum |
|---|---|---|---|---|
| Persistare sincronă (stringify + hash + LS) | 66 | 84 | 101 | 97, **acum amânată 120 ms și sărită la hash egal** |
| `writeAppData` (IDB) | 120 | 170 | 142 | 235 (fără al doilea stringify în aplicație: primește hash-ul) |
| `encryptFamilyData` | 102 | 137 **în worker** | 146 | 246 **în worker**; latență totală 116 ms, fir principal ≈ clonare 57 |
| `decryptFamilyData` + normalizare | 113 + 41 | în worker | 112 + 52 | în worker; latență 105 ms |
| `mergeFamilyData` (fir principal) | 95 | 159 | 172 | **191** |
| Baza de sync în LS (`syncBaseOf` + stringify + setItem, 309 KB) | n/a | 18 | n/a | **29, de 2 ori pe trimitere** |
| `todayBrief` la rece / la cald | 36 | 70 / **0** | 53 | 88 / **0** |
| `buildTodaySummary` la rece | 69 | 107 | 101 | 131 |
| `searchLedgerHits` (o tastă) | 63 | 12 | 111 | 20 (+ sortarea din paletă) |
| `weekdayShortLabels` | 23 (×1) | 0 | 28 | 0 |
| Pachet de sync criptat | 119 KB | 119 KB | | |

- Valorile „la rece” sunt mai mari decât pe 26.09 pentru că registrul are acum mai multe reguli, de exemplu „Închide anul” și plățile potrivite după nume.
- Valorile „la cald” sunt 0: cache-ul funcționează.
- Problema e că după orice schimbare toate calculele pornesc la rece.

### 3.5 Pachete și resurse

| | 26.09 | Acum |
|---|---|---|
| JS la pornire (decodat / transfer) | 586 / 190 KB (index 377 + react 193 + notif. 16) | **568 / 184 KB** (index 358 + react 193 + notif. 16) |
| CSS blocant (`index`) | 246 KB (44 gzip) | 249 KB (45 gzip) |
| CSS amânat (`deferred-styles`) | 389 KB (60 gzip), sosit la 3,2–3,9 s | 386 KB (60 gzip), sosit la 2,9–4,2 s |
| `!important` în build | 2.559 | 2.502 |
| CSS sursă (80 de fișiere) | ~935 KB | **927 KB** (plafon în test: 935; `!important` sursă 3.263 = plafonul) |
| Fonturi la pornire | Plex latin 40, Fraunces latin 66 + latin-ext 58, Plex latin-ext 26 | Plex latin 40, **Fraunces latin 66** + ro **7**, Plex latin-ext 26 (−51 KB) |
| Leneșe mari | `family-sync` 520, `jspdf` 386, `i18n-en` 282 | `family-sync` 532, `jspdf` 386, `i18n-en` 292, **`sync.worker` 28** (conține 24 KB din finance-data) |
| Precache SW la instalare | 6 fișiere | **113 fișiere, 2,6 MB brut / ~760 KB gzip**, inclusiv `i18n-en` |

Compoziția `index` (358 KB):
- `finance-data.ts` 68 KB;
- `Home.tsx` 37 KB;
- `household-insights.ts` 33 KB;
- `TodayView.tsx` 25 KB;
- `useFamilySync.ts` 14 KB;
- `monthly-needs.ts` 12 KB.

`tailwind-merge` și `family-crypto` au ieșit din pachetul de pornire (P3-12 confirmat).

## 4. Ce s-a reparat de la 26.09 (verificat)

| Constatare 26.09 | Starea măsurată |
|---|---|
| P1-1 „Gata” ~1 s | Parțial reparat: 992 → 536 ms. `tickMemo` elimină duplicatele. `weekdayShortLabels` e în cache. Persistarea e amânată și sărită la hash egal. |
| P1-2 Revenire pe Astăzi | Reparat pentru `data` neschimbat: `TodayView` a scăzut de la 550 la 101 ms în profil. Rămân `scrollTo` și demontarea vederii anterioare. |
| P1-3 Pornire | Reparat: o singură randare și o singură scriere. `seenWeeklyPlanTranches` e scos din registru. TBT −44%. |
| P1-4 Jurnal | Reparat în mare parte: 10 zile pe pagină, `haystackOf` în WeakMap, `useDeferredValue`. |
| P2-5, P2-6 Căutări | Parțial: filtrul nu se mai reface, dar sortarea completă pe tastă a rămas (vezi P2-3 și P2-4 mai jos). |
| P2-7 Plicuri | Parțial: `formatDate` e în cache, dar `PlanStudio` tot nu are `useMemo`. |
| P2-8 Randări din Home | Reparat: `stableView` (memo + funcții stabile). Notează și Esc au costuri mici. |
| P2-9 Sync | Parțial: criptarea e în worker, iar cheia e în cache. Unirea și baza de sync rămân pe firul principal. |
| P2-10 CSS | Neschimbat ca volum livrat (635 KB). Există plafon în teste. |
| P2-11 SW offline | Reparat, dar descarcă tot la instalare (vezi P3-9). |
| P3-13 Fonturi | Parțial: subsetul ro are 7 KB, dar Fraunces latin (66 KB) se descarcă în continuare. |
| P3-14 `nodePainted` | **Nereparat în practică:** marcajul `bf-today-painted` apare abia după 2 rAF, iar primul tick măsoară tot prin layout (110–171 ms). |

## 5. Constatări

### P1-1. „Gata” și pornirea: calculele planului trec prin tot registrul, cu `addIsoDays` pe fiecare mișcare
- **Gravitate:** P1. **Efort:** S–M.
- **Observat:**
  - „Gata”: INP 536 ms, Σ 733 ms (5.000@6×);
  - pornire: cel mai lung task 1,04 s (841 ms la 4×, aproape tot randarea Astăzi la rece);
  - 1.000@4×: 208 ms.
- **Cauze** (profil, 4×):
  1. `recurringPaidInPlan` (`finance-data.ts:1684-1695`) apelează `inPlanPeriod(transaction.date, plan)` (`:959`) pentru **fiecare mișcare**. Fiecare apel refolosește `planCoverEndDate` → `paydayWindow` → de 2 ori `addIsoDays` (`:898`), cu concatenare de șir și căutare în Map. Rezultă 202 ms self la pornire și 127 ms la „Gata”, doar în `addIsoDays`. `pendingDebtsInPlan` (`:1706`) face la fel. Totul e apelat din `pendingRecurringInPlan` (`:1698`) și `scheduledInPlan`, adică din `planCycle`, `advisorSignals` și `buildTodaySummary`.
  2. `planCycle` (`plan-cycle.ts:5`), `planAllocationMath` (`finance-data.ts:1053`), `allocationStatus` (`:1027`) și `allocationSpent` (`:996`) nu trec prin `tickMemo`. Sunt chemate din `useTodaySummary`, `advisorSignals` (`TodayView.tsx:44`), `usePlanCycle` și `PlanStudio`, deci același plan se socotește de mai multe ori pe randare.
  3. Cache-ul e legat de identitatea lui `data`. Orice modificare pornește totul la rece: `todayBrief` 88 ms, `buildTodaySummary` 131 ms la 6×.
  4. Persistarea (`usePersistAppData.ts:96-110`) e acum după clic, dar tot ~110 ms sincron, în primul task de după: `localSnapshotText` 55, `setItem` 55.
- **Reparație:**
  - în `recurringPaidInPlan` și `pendingDebtsInPlan`, calculează `const end = planCoverEndDate(plan)` o dată și compară direct `date >= start && date <= end`;
  - și mai bine: un derivat `periodTransactions(data)` prin `tickMemo([data], "period:"+asOf)`, pe care îl folosesc `allocationSpent`, `recurringPaidInPlan` și `pendingDebtsInPlan`. Dintr-un registru de 18 luni, perioada are ~300 de mișcări, nu 5.000;
  - `tickMemo` pe `planCycle`, `planAllocationMath` și `allocationStatus` (cheie `[data, allocation]`);
  - persistarea: scrie localStorage în `requestIdleCallback({timeout: 1000})` sau păstrează IDB ca sursă primară și în LS doar un „head” mic.
- **Estimare după** (5.000@6×):
  - „Gata” de la 536 la **~250–300 ms**;
  - cel mai lung task la pornire de la 1,04 s la ~0,5 s, TBT de la 1,78 la **~1,0 s**;
  - la 1.000@4×, „Gata” sub 120 ms.

### P1-2. Plicuri și foaia „+ Plic”: `PlanStudio` recalculează tot la orice stare locală
- **Gravitate:** P1 (foaia e un ecran nou, pe drumul principal). **Efort:** M.
- **Observat:**
  - deschiderea foii: INP 560 ms, blocaj 482 (5.000@6×); 312 / 178 la 1.000@4×;
  - închiderea: 424 ms;
  - Plicuri, a doua deschidere: 656 ms.
- **Cauze:**
  - `PlanStudio.tsx` are **0 `useMemo`**. Deschiderea foii schimbă `builderOpen` (`:135`, `:153`) și randează din nou tot ecranul;
  - `envelopes` (`:164`): `allocationStatus`, `allocationWeekStatus` și `allocationWeeksStatus` pe fiecare plic;
  - istoricul pe luni al fiecărui plic (`:534` → `envelopeMonthlyHistory`, `household-insights.ts:1042-1048`): 6 filtre pe tot registrul pentru fiecare plic, adică 48 de treceri. Acestea sunt calculate chiar dacă `<details>` e închis (206 ms în profil);
  - opțiunile de sursă ale formularului (`:255-265`, `sourceFreeBalance` → `sourceBalance` + `allocationSpentFromSource` pe fiecare plic): 168 ms;
  - `recurringPaidInPlan` (P1-1): 211 ms.
- **Reparație:**
  - scoate foaia (`details.bf-plan-builder`, `:554-…`) într-o componentă separată cu stare proprie, ca deschiderea ei să nu randeze lista;
  - `useMemo` pe `envelopes` și pe lista sortată, cu dependența `[data]`;
  - `envelopeMonthlyHistory`: o singură trecere pe registru pentru toate plicurile, `tickMemo([data], "monthly:"+asOf)`, calculată doar când se deschide `<details>`;
  - `sourceOptionLabel`: calculează o dată pe randare harta `sourceId → {balance, free}`.
- **Estimare după** (5.000@6×): deschiderea foii de la 560 la **~100 ms**, închiderea la ~80 ms, Plicuri (2) de la 656 la **~250 ms**.

### P2-3. Paleta: registrul e sortat cu `localeCompare` la fiecare tastă
- **Gravitate:** P2. **Efort:** S.
- **Observat:** 8 taste „kaufland” produc Σ 739 ms de long tasks (5.000@6×). În profil, comparatorul de la `command-search.ts:40` are **408 ms self**. Căutarea în sine s-a oprit corect la 6 rezultate.
- **Cauză:**
  - `items.slice().sort((a,b) => (b.date||"").localeCompare(a.date||""))` înseamnă ~60.000 de `localeCompare` pe tastă;
  - la interogare goală, `QuickActionsPalette.tsx:35` sortează iar tot registrul (84 ms).
- **Reparație:**
  - sortare o singură dată, `useMemo(() => sorted, [data.transactions])`, cu comparație simplă `a.date < b.date` (ISO se compară corect ca șir). `searchLedgerHits` primește lista deja sortată;
  - pentru „ultimele 5”, o singură trecere cu top-5, fără sortare.
- **Estimare după:** de la ~90 la **<10 ms pe tastă**; Σ de la 739 la <80 ms.

### P2-4. Jurnalul: sortarea completă pe tastă și a doua randare după filtru
- **Gravitate:** P2. **Efort:** S.
- **Observat:** „lidl” are Σ 392 ms (5.000@6×). În profil, sortarea (`MovementsJournal.tsx:77`) are 136 ms incl. pe 4 taste la 4×.
- **Cauze:**
  - `narrowed` filtrează și **sortează cu `localeCompare`** la fiecare interogare (`:77`);
  - `useEffect(() => setVisibleDays(DAYS_PER_PAGE), [list])` (`:116`) încă dublează randarea;
  - banda săptămânii face `new Intl.DateTimeFormat` pe fiecare zi, la fiecare randare (`:139`);
  - `colorFor` e chemat de 2 ori pe rând.
- **Reparație:**
  - `const sortedLedger = useMemo(sort, [data.transactions])` cu comparație simplă. Filtrul păstrează ordinea, deci nu mai e nevoie de sortare;
  - resetează `visibleDays` în handlerele de filtru;
  - formatter la nivel de modul.
- **Estimare după:** per tastă de la 208 la **~80 ms**; Σ de la 392 la ~150 ms.

### P2-5. Revenirea pe Astăzi: `scrollTo` forțează layout, iar vederea anterioară se demontează în același cadru
- **Gravitate:** P2. **Efort:** S.
- **Observat:**
  - „tab Astăzi (din Mișcări)”: INP 408 ms (5.000@6×), față de 80 înainte. Lucrul a intrat în clic;
  - profilul Plicuri → Astăzi: `TodayView` doar 101 ms, dar `scrollTo` are **104 ms self**.
- **Cauză:** `Home.tsx:188` rulează `window.scrollTo({top: 0})` într-un efect, la fiecare schimbare de `view`. Asta forțează sincron layoutul întregului ecran nou.
- **Reparație:** apelează doar dacă `window.scrollY > 0`, și în `requestAnimationFrame`. Alternativ, `scrollTop` pe containerul vederii, după paint.
- **Estimare după:** de la ~400 la **~250 ms** INP. Restul vine din P1-1, prin randarea rece după modificări.

### P2-6. Sync: unirea, clonarea și baza de sync rămân pe firul principal
- **Gravitate:** P2. **Efort:** M.
- **Observat** (benchmark pe module, 5.000@6×, fără server real). Pe fiecare trimitere, pe firul principal:
  - `mergeFamilyData` **191 ms** (`useFamilySync.ts:527`, și `:242`, `:305` la primire);
  - clonarea `AppData` spre worker la criptare ~57 ms, iar la decriptare rezultatul normalizat se clonează înapoi ~57 ms;
  - `syncPortable` de 4–5 ori (`:510`, `:515`, `:532-533`, `:550`), ~10–17 ms fiecare;
  - `writeSyncBase` de 2 ori (`:530`, `:549`) cu **309 KB** în localStorage (`family-crypto.ts:283`, o semnătură pe fiecare mișcare), 29 ms fiecare. Asta mai mută 0,3 MB spre cota de 5 MB, care conține deja registrul de 1,24 MB.
  - **Total ≈ 0,4 s** (față de ~0,55 s pe 26.09). Criptarea (246 ms) și decriptarea (117 ms) nu mai blochează.
- **Reparație:**
  - mută în worker și `mergeFamilyData` + `syncPortable` (worker-ul conține deja `finance-data`). Firul principal trimite registrul o singură dată pe schimbare și primește doar rezultatul unit;
  - `syncPortable` memorizat pe identitatea lui `data` (WeakMap);
  - baza de sync în IndexedDB, sau un hash pe mișcare în loc de semnătura completă.
- **Estimare după:** de la ~0,4 s la **~0,1 s** de fir principal pe trimitere; −0,3 MB în localStorage.

### P2-7. Registrul gol pornește mai greu decât pe 26.09
- **Gravitate:** P2 (e prima impresie a oricărui utilizator nou). **Efort:** S.
- **Observat:**
  - 0@4×: TBT de la 195 la 390 ms, cel mai lung task de la 209 la 363 ms;
  - 0@6×: de la 457 la 858, respectiv de la 410 la 700 ms;
  - sunt rulări unice, dar la ambele limitări (h1: 2,22 s și 2,69 s).
- **Cauze** (profil 0@4×):
  - `nodePainted` (`native-splash.ts:56-68`), 110 ms: `firstScreenReady` verifică întâi marcajul `bf-today-painted`, dar acesta e pus abia după 2 rAF (`TodayView.tsx:170-171`). Primul tick măsoară deci prin `getBoundingClientRect` + `getComputedStyle`, adică layout sincron;
  - `today-summary.ts:78`: `toLocaleDateString(getLocale(), {weekday: "long"})` creează un formatter nou pe apel (61 ms);
  - `scrollTo` (38 ms, P2-5).
- **Reparație:**
  - în `waitUntilPainted`, primul tick așteaptă un rAF fără măsurare, sau `TodayView` pune marcajul direct în `useLayoutEffect`;
  - formatter de zi a săptămânii la nivel de modul, cu cheia locale.
- **Estimare după:** TBT la 0@6× de la 858 la **~450 ms**, adică înapoi la nivelul din 26.09.

### P3-8. CSS: volumul livrat e neschimbat
- **Gravitate:** P3 (aici), P2 ca datorie. **Efort:** L.
- **Observat:**
  - 635 KB în build (249 blocant + 386 amânat), cu 2.502 `!important`;
  - foaia amânată sosește la 2,9–4,2 s pe Slow 4G și restilizează ecranul deja folosit;
  - sursa are 927 KB, la 8 KB de plafonul din `tokens.test.ts:75`.
- **Concluzie:** experimentul din 26.09 (−53% timp de stil fără `deferred-styles`) rămâne valabil, pentru că volumul e același.
- **Reparație:** foi CSS pe chunk leneș (Plicuri, Mișcări și Setări au deja chunk-uri), contopirea straturilor „pass/fix”, plafon separat pentru CSS-ul **livrat** (de exemplu `deferred-styles` < 250 KB).
- **Estimare după:** −40% timp de stil pe navigare.

### P3-9. Service worker: la instalare descarcă 113 fișiere (~760 KB gzip)
- **Gravitate:** P3 (doar web). **Efort:** S.
- **Observat:** `sw.js` → `precache.json` include tot sub 400 KB (`vite.config.ts:62`), inclusiv `i18n-en` (292 KB), AI, rapoarte și OCR-utils. Pe Slow 4G, la prima vizită, asta concurează cu fonturile și cu foaia amânată.
- **Reparație:**
  - exclude `i18n-en`, `AICompanion`, `analyst`, `receipt-*`, `qrcode`, `purify` din precache-ul de instalare;
  - adaugă-le în cache la prima folosire, sau după `bf-today-painted`, în idle.

### P3-10. Fraunces latin (66 KB) se descarcă încă
- **Gravitate:** P3. **Efort:** S.
- Subsetul „ro” are 7 KB, dar fișierul `fraunces-560-latin` se descarcă în continuare (la 2,3–2,6 s). Fraunces e folosit doar la titluri: un singur subset cu glifele folosite ar avea ~25 KB.
- **Câștig estimat:** −40 KB.

## 6. Top 5

1. **P1-1: calculele planului, o dată pe registru.**
   - Ce: `end` scos din bucla lui `recurringPaidInPlan` și `pendingDebtsInPlan` (`finance-data.ts:1684-1712`), `periodTransactions(data)` memorizat, `tickMemo` pe `planCycle`, `planAllocationMath` și `allocationStatus`.
   - Câștig: „Gata” de la 536 la ~280 ms, TBT la pornire de la 1,78 la ~1,0 s (5.000@6×). Efort S–M.
2. **P1-2: `PlanStudio` cu `useMemo` și foaia „+ Plic” în componentă separată.**
   - Ce: istoricul lunar într-o singură trecere, calculat leneș.
   - Câștig: foaia de la 560 la ~100 ms, Plicuri de la 656 la ~250 ms. Efort M.
3. **P2-3 + P2-4: sortare o singură dată pe registru, nu pe tastă.**
   - Unde: `command-search.ts:40`, `QuickActionsPalette.tsx:35`, `MovementsJournal.tsx:77`, plus resetarea `visibleDays` în handler (`:116`).
   - Câștig: paleta de la Σ 739 la <80 ms, jurnalul de la 208 la ~80 ms pe tastă. Efort S.
4. **P2-6: unirea și `syncPortable` în worker, baza de sync scoasă din localStorage.**
   - Câștig: de la ~0,4 s la ~0,1 s de fir principal pe trimitere, −0,3 MB în LS. Efort M.
5. **P2-5 + P2-7: fără layout forțat la pornire și la schimbarea de tab.**
   - Ce: `scrollTo` condiționat și în rAF (`Home.tsx:188`), `nodePainted` fără măsurare pe primul tick, formatter în cache la `today-summary.ts:78`.
   - Câștig: registrul gol înapoi la ~450 ms TBT (6×), Astăzi de la 408 la ~250 ms. Efort S.

## 7. Ce e bine

- Pornirea cu registru mare s-a înjumătățit, iar hidratarea nu mai face lucru dublu.
- Jurnalul e rapid chiar și cu 5.000 de mișcări.
- `stableView` a oprit randările inutile (Notează 80 ms, Esc 48 ms).
- Criptarea e în worker, cu cheia în cache.
- Pachetul de pornire a mai scăzut (184 KB transfer), iar Firebase, PDF, OCR, AI și engleza rămân leneșe.
- Memoria e mică și stabilă: 9,8 MB după tur cu 5.000 de mișcări. CLS ~0.
- Calendarul, Obligațiile și Notează stau sub 140 ms în toate configurațiile.

## Anexă: fișiere de lucru

`/tmp/claude-0/-home-user-buget-familie/6251941a-2f52-5fdd-bb21-2d9641b66e0b/scratchpad/agenti3/perf/`

| Fișier | Ce conține |
|---|---|
| `dist/`, `dist-map/`, `serve.mjs` | build-uri de producție (fără și cu sourcemap), server static cu gzip |
| `seed.mjs`, `seed-1000.json`, `seed-5000.json` | date de test |
| `measure.mjs`, `runall.sh`, `res-*.json`, `med.mjs`, `sum3.mjs` | pornire și interacțiuni, cu mediane |
| `profile.mjs`, `profile-N5000-cpu4.json`, `profile-N0-cpu4.json` | profil CPU mapat pe sursă |
| `bench3.mjs`, `bench3.json` | micro-benchmark-uri (persistare, sync, worker, derivări) |
| `trace0.mjs`, `composition.mjs` | compoziția task-urilor de pornire și a chunk-urilor |
