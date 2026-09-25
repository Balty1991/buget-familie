# Buget Familie: review de arhitectură și cod (principal engineer)

Data: 25.09.2026 · Commit: `867bb12` · Versiune: 1.1.96 (versionCode 98)
Stack real: **React 19.2** (nu 18), Vite, TS strict, Capacitor 8, Firebase 12, Functions Node 22.

Ce am rulat (read-only):
- `tsc --noEmit`: 0 erori. `eslint --max-warnings 0`: 0 probleme. `vitest`: **103 fișiere, 1051 teste, toate trec** (33 s).
- Build `GITHUB_PAGES=true vite build`: reușit, cu un warning de chunk >500 kB (`family-sync`, 649 kB).
- Am scris sonde vitest (scratchpad `agents/probe/*.test.ts`, în afara repo-ului) ca să **reproduc** bug-urile de mai jos. Fiecare bug marcat „reprodus” are o sondă care îl arată.

---

## 1. Rezumat (verdict)

**Nu e gata pentru o lansare Play „top-tier” cu sincronizarea de familie activă.** Aplicația locală (un singur telefon) e solidă: are tipare stricte, 1051 de teste, lazy-loading bine gândit, reguli Firestore întărite și multă atenție la cazuri-limită (fus orar, DST, ferestre de salariu). Problemele grave stau în **modelul de date al sincronizării** și în **creșterea datelor în timp**:

1. **Sincronizarea se oprește definitiv după aproximativ 1 an de folosire.** Tot registrul stă într-un singur document Firestore, iar Firestore acceptă cel mult 1 MiB pe document. Am măsurat 5.500 de mișcări → 2,69 MB ciphertext. Plafonul de 1 MiB se atinge pe la **~2.100 de mișcări**. (Critic, reprodus.)
2. **Ștergerile nu se propagă** pentru plicuri, transferuri, reguli, aplicări de salariu, nevoi lunare, venituri așteptate, membri și categorii. Tot ce ștergi reapare la prima unire cu celălalt telefon. (Critic, reprodus.)
3. **O editare normală, făcută pe un singur telefon, apare ca „conflict”** la celălalt, iar telefonul care primește își păstrează valoarea veche. Merge-ul compară doar două copii (2-way), fără o versiune de bază. (Mare, reprodus.)
4. **„Anulează” după ștergere se pierde** dacă ștergerea a apucat să fie trimisă (debounce de 800 ms, iar Undo stă 9 s pe ecran). **Anularea repartizării salariului se poate aplica de două ori.** (Mare, reprodus.)
5. **Rotunjirea banilor e greșită:** un plic cheltuit exact până la ultimul ban apare **„depășit”** (126,33 + 155,77 + 83,18 dintr-un plic de 365,28 → `state: "over"`). (Mare, reprodus.)
6. **Performanță:** ecranul Astăzi recalculează aceleași agregate de 3–4 ori pe randare (≈130 ms pe desktop la 5.500 de mișcări, de 4–6 ori mai mult pe un Android mediu). Merge-ul de sync ia 350 ms, iar 80% din timp se duce pe o deduplicare O(n²) a pietrelor de mormânt. În CSS: 117 fișiere și 3.448 de `!important`.

Recomandare: lansare publică doar cu sync marcat „beta” sau limitat, după ce se rezolvă P0 (secțiunea 7, etapele 0–2). Pentru mentenanța pe termen lung, `finance-data.ts` și CSS-ul sunt cea mai mare datorie.

---

## 2. Probleme de arhitectură

### 2.1 God-files
| Fișier | Linii | Linie maximă | Observații |
|---|---|---|---|
| `client/src/lib/finance-data.ts` | 1.917 | **6.629 caractere** (l. 601) | Ține împreună: tipuri de domeniu (l. 9–203), date/fus (l. 213–243), ID-uri, parsare sume, normalizare/migrare (l. 355–611, `normalizeAppData` ~250 de linii), review drafts, istoric, reguli de salariu, valute, fereastra de salariu, tombstones, matematica plicurilor (l. 857–1150), datorii (snowball), recurente, prognoză, NLP (`guessCategoryFromText`, `answerBudgetQuestion`, l. 1564–1713), scor de sănătate (l. 1715–1917). 43 de linii au peste 300 de caractere. |
| `client/src/lib/household-insights.ts` | 1.391 | 306 | Peste 40 de export-uri de „insights”, fiecare recalculând statusul plicurilor de la zero. |
| `client/src/lib/understand.ts` | 1.242 | 353 | Al treilea strat NLP, lângă `assistant-intents.ts` (58 KB), `analyst.ts` (55 KB) și partea NLP din `finance-data.ts`. |
| `client/src/pages/Home.tsx` | 622 | **5.022** (l. 313) | 16 `useState`, 24 `useEffect`, 0 `useMemo`. `applyFinancialUpdate` (l. 313) este un reducer de domeniu de 5 KB scris pe o singură linie. Tot aici e și o magistrală de evenimente globale. |
| `client/src/components/PlanStudio.tsx` | 685 | 2.012 (l. 496, 683) | 30 `useState`, 0 `useMemo`, 37 de linii JSX peste 300 de caractere. Tot calculul planului rulează la fiecare tastă. |
| `client/src/pages/TodayView.tsx` | 571 | 534 | Exportă logică de domeniu (`advisorSignals`, l. 40; `recentActivityMoves`, reexportat din `Home.tsx:48`). Asta e logică de business ținută într-o pagină. |
| `client/src/hooks/useFamilySync.ts` | 572 | — | Hook de 26 KB. Amestecă orchestrarea camerei, criptarea, merge-ul, jurnalul, notificările și props-urile UI (`syncPanelProps`). |

### 2.2 Logică duplicată (cu divergențe reale)
- **Predicatul „cheltuiala aparține plicului” are 4 copii, iar ele diferă între ele:**
  - `finance-data.ts:884-887` (`allocationSpent`): `(!allocation.sourceId || !item.sourceId || allocationSourceIds(allocation).includes(item.sourceId))`
  - `finance-data.ts:975-979` (`allocationSpentFromSource`): `includes(item.sourceId || "")`. O mișcare fără sursă **nu** se potrivește aici, dar se potrivește în copia de mai sus.
  - `finance-data.ts:1048-1052` (`allocationWeeksStatus`): încă o copie inline.
  - `household-insights.ts:950-956` (`matchesAllocation`): `item.sourceId === allocation.sourceId`. Ignoră `funding` (completările din alte surse) și cere sursă. De aceea `weeklyCheckIn` (l. 1173) dă alt „cheltuit” decât `allocationSpent` pentru plicurile cu completări.
- **Cifra „pe zi” se calculează cu 5 reguli de rotunjire diferite:**
  - `household-insights.ts:512`: `Math.floor(remaining / days)`, lei întregi. Împarte la `latestDays`, adică **fără** ziua de azi.
  - `household-insights.ts:527`: `floor` la bani. Numără **cu** ziua de azi (`+1`).
  - `allowance.ts:97`: `round2(remaining / (daysLeft+1))`. Rotunjește în sus, deci poate promite mai mult decât există.
  - `calendar-budget.ts:92`: `roundMoney(remaining / daysLeft)`, cu altă convenție pentru zile (`periodDays`, inclusiv).
  - `analyst.ts:408`: `round(after / daysLeft)`.

  Același plic poate arăta cifre diferite pe Astăzi, Plan, în notificare și în „Telefonul lui X”.
- **Helper-e de dată duplicate**, cu două convenții amestecate (amiază locală vs amiază UTC):
  - `toIso`: `monthly-needs.ts:32`, `planned-events.ts:40` și `calendar-budget.ts:16` (varianta UTC!), plus `isoDate` în `finance-data.ts:213`.
  - `daysBetween`: `suggestions.ts:25`, `allowance.ts:50`, `household-insights.ts:45`, `planned-events.ts:45`, plus inline în `analyst.ts:626,887`, `proposal-date.ts:19`, `RecurringPanel.tsx:245`.
  - La `planned-events.ts:44` comentariul spune „inclusiv ziua de început”, dar implementarea e exclusivă. E o capcană pentru cine o apelează.
  - `round2`/`roundMoney`/`money2`: 8 definiții (`MonthlyAllocationWizard.tsx:9`, `price-history.ts:52`, `allowance.ts:48`, `receipt-utils.ts:35`, `monthly-needs.ts:30`, `planned-events.ts:41`, `calendar-budget.ts:20`, `household-insights.ts:948`), unele cu `EPSILON`, altele fără.
- **Normalizarea textului românesc:** `foldRo` în `understand.ts:92` și `command-search.ts:13`, `foldRomanian` în `finance-data.ts:1564`, plus încă 19 `normalize("NFD")` inline. `Home.tsx:313` repetă de 4 ori același lanț pe o singură linie.
- **Conversia lună ↔ săptămână:** `52/12` în `monthly-needs.ts:372`, dar `*30/days` în `analyst.ts:888`, `planned-events.ts:172`, `monthly-needs.ts:83` și `RecurringPanel.tsx:246`.

### 2.3 Cuplaj și state management
- **Nu există cicluri de import** (am verificat cu un script Tarjan pe importurile runtime din `client/src`), iar `lib/` nu importă din `pages/` sau `components/`. E un punct bun.
- `hooks/usePersistAppData.ts` importă `syncPortable` din `hooks/useFamilySync.ts`. Persistența depinde astfel de modulul de sync, iar serializarea ar trebui să stea în `lib/`.
- Navigarea și comenzile trec printr-o **magistrală de evenimente globale pe `window`**: 14 tipuri de `CustomEvent` (`buget-familie:open-catalog`, `:local-settings`, `:open-familie` etc.). `Home.tsx:290` aplică un patch **arbitrar** pe `settings` venit dintr-un eveniment `buget-familie:local-settings`. E nefiltrat și netipat la runtime.
- Singurul context React e `ThemeContext`. Tot `AppData` coboară prin props din `Home`, iar fiecare modificare re-randează tot arborele vizibil, fără `React.memo` sau selecții pe felii.
- `react-hooks/exhaustive-deps` e **dezactivat** (`eslint.config.js`). `useFamilySync` se bazează intenționat pe ref-uri, dar regula oprită ascunde bug-uri reale, de exemplu cel de la §3 #12.
- Timpul („azi”) e o **stare globală mutabilă** (`let familyTimeZone`, `finance-data.ts:219`), citită implicit de sute de funcții prin parametri impliciți `asOf = isoToday()`. Memo-urile React nu o au în chei (§3 #11).
- Setările sunt împărțite în două: „doar pe telefon” (tăiate la criptare, `family-crypto.ts:66-81`) și „sincronizate”. Împărțirea e implicită, într-o listă scrisă de mână care trebuie ținută în acord cu `mergeFamilyData:431-462`. `exchangeRates` e doar locală, dar influențează soldurile, care sunt partajate (§3 #9).

---

## 3. Bug-uri și riscuri de corectitudine găsite în cod

Severitate: **Critic** (pierdere sau corupere de date, oprirea unei funcții de bază), **Mare** (cifre financiare greșite, UX confuz care afectează încrederea), **Mediu**, **Mic**.

| # | Fișier:linie | Problemă | Severitate |
|---|---|---|---|
| 1 | `lib/family-crypto.ts:57-87`, `lib/realtime-sync.ts:152-156`, `firestore.auth.rules` (`ciphertext.size() < 2000000`) | **Tot registrul stă într-un singur document Firestore, necomprimat, cu base64 (+33%).** Limita Firestore e de 1 MiB pe document, iar regula de 2.000.000 este peste ea, deci nu apără nimic. Sonda `mergeperf.test.ts`: 5.500 de mișcări → JSON 2,0 MB → ciphertext 2,69 MB, adică **~489 de caractere pe mișcare**. Plafonul vine la ~2.100 de mișcări, adică **9–15 luni pentru o familie cu 5–7 mișcări pe zi**. După asta `setDoc` eșuează și utilizatorul vede doar mesajul generic „Actualizarea nu a putut fi trimisă”. În plus, fiecare editare descarcă și urcă tot documentul (`useFamilySync.ts:441-455`). | **Critic** |
| 2 | `lib/finance-data.ts:134` (`DeletedRecord.entity` doar pentru `transactions/debts/savings/receipts/recurring`), `lib/family-crypto.ts:363-385`, `202-248`, `349-355` | **Ștergerile nu au tombstone** pentru: plicuri (`allocations`), `transfers`, `weekTransfers`, `salaryAllocationRules`, `salaryAllocationApplications`, `needs`, `incomes`, `plannedEvents`, contribuțiile la evenimente, `members` și `customCategories`. `mergeById` și `mergeAllocationsWithConflicts` fac reuniune. Sonda `merge.test.ts` confirmă: un plic șters pe A revine după merge, un transfer șters revine, un membru scos revine, iar o categorie nu mai poate fi ștearsă niciodată. `PlanStudio.tsx:311` și `MonthlyNeedsPanel.tsx:147` șterg plicuri prin simplu `filter`. | **Critic** |
| 3 | `lib/family-crypto.ts:218-231` (plicuri), `286-306` (mișcări) | **Merge-ul compară doar două copii (2-way), fără versiune de bază.** Dacă A schimbă suma unui plic sau a unei mișcări și B nu atinge nimic, B vede **conflict și își păstrează valoarea veche** (reprodus: B rămâne cu 500 în loc de 600 și cu 10 în loc de 12). Orice editare de sumă, dată, plic sau sursă ajunge astfel pe ecranul de conflicte al partenerului. Testul `family-crypto.test.ts:97` („nu aplică LWW tăcut”) fixează comportamentul ăsta. Nu există nicio sursă de adevăr de tip „ultima versiune văzută de la server” care să separe o editare secvențială de una concurentă. | **Mare** |
| 4 | `lib/undo-delete.ts:32-61` | **Undo după ștergere, pe un telefon sincronizat.** Ștergerea scrie un tombstone, iar push-ul pleacă după 800 ms (`useFamilySync.ts:436`). Undo, disponibil 9 s (`useUndo.ts:17`), scoate tombstone-ul **doar local** și pune înapoi rândul cu `updatedAt` vechi. La următorul merge, tombstone-ul din cameră (`family-crypto.ts:339`, reuniune) e mai nou decât rândul, iar rândul **dispare din nou** (reprodus: 1 → 0). Remediu: la restaurare trebuie pus `updatedAt = now`. | **Mare** |
| 5 | `lib/finance-data.ts:714-733` + `family-crypto.ts:383` | **Anularea repartizării salariului, pe un telefon sincronizat.** `revertSalaryAllocationApplication` scoate aplicarea din listă, dar `mergeById` o readuce din cameră. Butonul „Anulează” apare din nou, iar o a doua anulare **scade încă o dată** sumele (`amounts`, l. 717-718, `roundedMoney(item.amount - …)`). Reprodus: aplicarea revine după merge, plus conflict de sumă. Tot aici se reînvie contribuțiile `event:` scoase la l. 725-730, pentru că `mergePlannedEvents` (l. 399) le reunește după `date`. | **Mare** |
| 6 | `lib/finance-data.ts:719`, `728` | Anularea pune la loc **suma absolută** `previousAmount`. Dacă plicul a fost editat între timp, sau altă repartizare l-a mărit, editarea aceea se pierde fără niciun semn. Trebuie restaurat un delta, sau refuzată anularea când suma curentă ≠ suma de după aplicare. | **Mare** |
| 7 | `lib/finance-data.ts:895` (`allocationStatus`), `876-892` (`allocationSpent` nu rotunjește) | **Rotunjire float.** `remaining = budget - spent` fără rotunjire, apoi `state: remaining < 0 ? "over"`. Reprodus: 126,33 + 155,77 + 83,18 = 365,28000000000003, deci plicul de 365,28 apare „depășit”, iar `envelopeDecisionStatus` spune la fel pentru plicurile lunare. Același tipar există în `sourceBalance` (l. 756-765), `planAllocationMath` (l. 910-949) și `cycleEndReport`. Doar `allocationWeeksStatus` rotunjește (`roundSigned`). | **Mare** |
| 8 | `lib/family-crypto.ts:360`, `finance-data.ts:680` | Câmpurile scalare ale planului (`nextPayday`, `periodStart`, `paydayFlexDays`, `weekCarryOver` etc.) urmează LWW pe `salaryPlan.updatedAt`, dar **orice** editare de plic sau din istoric ridică `updatedAt` (`appendAllocationHistory`). Un telefon offline care editează un plic după ce partenerul a schimbat data salariului îi **anulează** schimbarea datei. | Mediu |
| 9 | `lib/family-crypto.ts:77`, `441`; `lib/finance-data.ts:756-765` | `exchangeRates` e doar locală (tăiată la criptare), dar `sourceBalance` o folosește ca să convertească soldul inițial valutar. Doi parteneri văd **solduri, „nerepartizat” și ritm zilnic diferite** pentru aceleași date. | Mediu |
| 10 | `pages/Home.tsx:191-194` + `hooks/usePersistAppData.ts` (`applyData` recreat la fiecare randare) | Efectul `[storageReady, applyData]` rulează **după fiecare randare a Home**. `adoptOutsideExpenses` (`finance-data.ts:1291-1307`) parcurge toate mișcările și apelează `inPlanPeriod` (cu construcții `Date`) pentru fiecare. Mai grav: mută în plicuri și cheltuielile pe care omul le-a pus **explicit** „În afara plicurilor” (opțiune oferită în `ReviewCenterPanel.tsx:219` și `QuickEntryPanel`), fără să ridice `updatedAt`. Asta poate produce conflicte de mișcare la sync, fiindcă `allocationId` intră în `transactionMateriallyDiffers`. | Mediu |
| 11 | `pages/TodayView.tsx:165,175,177,180,196-199`; `hooks/usePlanCycle.ts` | Memo-urile au cheia `[data]`, dar calculează cu `isoToday()` înăuntru. Doar `useTodaySummary` pune `today` în cheie. Dacă aplicația rămâne deschisă peste noapte, primul re-render după miezul nopții arată cifra mare pe „azi” și plicurile, alertele și „prea repede” pe „ieri”, pe același ecran. | Mediu |
| 12 | `android/.../SpendTodayWidgetProvider.java:64-72`, `res/xml/widget_spend_today_info.xml` (`updatePeriodMillis="0"`) | Widgetul verifică dacă cifra e „de ieri” doar în `updateOne`, iar asta rulează numai când aplicația publică o cifră nouă. După miezul nopții widgetul continuă să arate cifra de ieri **fără** eticheta „veche”. În plus, `today` e în fusul telefonului, pe când `date` vine din fusul familiei (`isoToday`). | Mediu |
| 13 | `lib/family-crypto.ts:467-470` | Camerele vechi au `roomId = SHA-256("buget-familie-room:" + parolă)`, un hash rapid, fără sare. Oricine vede ID-ul (acces la consolă sau loguri Firebase) poate face brute-force pe parolă cu viteza GPU, **ocolind cele 250k iterații PBKDF2**, apoi decriptează. Migrarea spre invitație există, dar camerele vechi rămân vulnerabile. | Mediu |
| 14 | `lib/realtime-sync.ts:155` | `setDoc` fără precondiție (fără `updateTime` sau tranzacție). Ciclul fetch → merge → push (`useFamilySync.ts:441-455`) are o fereastră de cursă, iar ultimul care scrie suprascrie tot documentul. Reuniunea din merge vindecă de obicei adăugările, dar nu și conflictele de sume. | Mediu |
| 15 | `lib/family-crypto.ts:120`, `136`, `352`, `mergeSyncDevices` | Toată rezolvarea LWW și a tombstone-urilor compară **ceasurile telefoanelor** (`new Date().toISOString()`). Un telefon cu ceasul greșit câștigă sau pierde sistematic, iar o ștergere poate fi „mai veche” decât rândul. Nu există nicio corecție cu `serverTimestamp`. | Mediu |
| 16 | `pages/Home.tsx:313` (fragmentul `current.transactions.some(… item.amount === change.amount && item.title === change.title && item.date === …)`) | Deduplicarea venitului introdus prin ghid ignoră membrul. Doi parteneri cu „Salariu” de aceeași sumă în aceeași zi duc la **al doilea venit aruncat fără niciun mesaj**. Tot aici, `catch { return current; }` înghite erorile din `commitLedgerEntry`. | Mediu |
| 17 | `lib/finance-data.ts:710`, `732`; `lib/allocation-history` | În date se salvează text **deja tradus sau hard-codat**: `note: \`Venit de ${income.amount.toLocaleString("ro-RO")} RON\``, `"Plic eliminat"` (l. 732, fără `t()`), `t("Plăți rare")`, `t("Repartizarea a fost anulată.")`. Textul intră în pachetul sincronizat, deci un partener cu interfața în engleză vede istoric în română, și invers. | Mic |
| 18 | `components/AllocationHistoryChart.tsx:15`, `39` | `new Date().toISOString().slice(0,7)` dă luna în UTC. Pe 1 ale lunii, între 00:00 și 03:00 în România, graficul consideră că ultima lună e cea precedentă. `monthSequence` face `toISOString()` pe amiaza locală, deci în fusurile UTC+12/+13 rezultă luna greșită. | Mic |
| 19 | `components/ReportsPanel.tsx:27-28`, `components/PlanStudio.tsx:246`, `components/FinancialCalendarView.tsx:18`, `pages/ObjectivesView.tsx:92` | „Luna curentă” vine din `new Date()` (fusul telefonului), nu din `isoToday()` (fusul familiei), deci e inconsecventă cu restul aplicației când fusurile diferă. | Mic |
| 20 | `lib/family-crypto.ts:339-344` | Deduplicarea tombstone-urilor e O(n²): `findIndex` plus `[...all, item]` la fiecare pas. Cu 1.500 de tombstone-uri, merge-ul urcă de la 70 ms la **350 ms** (măsurat), iar asta se întâmplă la fiecare snapshot și la fiecare push. | Mediu (perf) |
| 21 | `functions/src/index.ts:532-549` | `takeQuota` lasă cererea să treacă dacă Firestore cade (`return true`). App Check lipsă e acceptat (`trust === "absent"`, l. 610), iar identitatea anonimă se obține gratuit. Costul Gemini/Groq poate fi abuzat prin rotirea IP-urilor (IPv6). În plus, `context` (până la 12 KB din registrul familiei) pleacă la furnizori terți. Trebuie declarat în Data Safety din Play. | Mediu |
| 22 | `functions/src/index.ts:786-808` | `playRtdn` e public și nu verifică tokenul OIDC al Pub/Sub. Nu poate acorda abonamente, pentru că reverifică la Google, dar oricine poate declanșa apeluri la Android Publisher API. `verifyPlayPurchase` (l. 752) nu are limită de cereri. | Mic |
| 23 | `android/app/src/main/res/xml/file_paths.xml` | FileProvider expune `external-path path="."`, adică toată memoria externă, și `files-path "."`. Ajung doar căile pentru backup și bonuri. | Mic |
| 24 | `android/app/src/main/AndroidManifest.xml` (`allowBackup="false"`) | E o alegere bună pentru confidențialitate, dar la schimbarea telefonului **nu există nicio restaurare automată** pentru utilizatorii fără sync. Singura plasă e backup-ul săptămânal manual sau automat. Trebuie spus explicit la onboarding sau în Play listing. | Mic (produs) |

---

## 4. Datorie tehnică

**Tipare și lint**
- `tsconfig.json` exclude `**/*.test.ts`. Cele 1051 de teste **nu trec prin type-check** (vitest nu verifică tipurile), deci un test poate construi `AppData` invalid fără să știe nimeni. Sondele mele folosesc `as any` și rulează fără nicio eroare.
- Codul de producție are doar 8 cast-uri `any`/`as unknown as`, ceea ce e bine. Există însă 45 de cast-uri `as` în `finance-data.ts`, majoritatea în `normalizeAppData`. Acolo lipsește un schema-validator: pachetul decriptat e doar `JSON.parse(...) as AppData` (`family-crypto.ts:94`), iar normalizarea manuală e singura apărare împotriva unui pachet de la o versiune mai nouă a aplicației. Nu există un `version` real al schemei: `version: 9` e fix și nu se verifică „mai nou decât cunosc”.
- ESLint: `no-explicit-any: off`, `exhaustive-deps: off`. `functions/` nu are lint și nici teste.

**Linii foarte lungi și formatare**
- 43 de linii peste 300 de caractere în `finance-data.ts`, 29 în `Home.tsx`, 37 în `PlanStudio.tsx`. Prettier există (`pnpm format`), dar nu e impus în CI, iar liniile de 5–6 KB fac diff-urile și review-urile practic imposibile.

**i18n**
- Cheia este textul românesc (`lib/i18n.ts`), iar dicționarul EN are 284 KB, 3.186 de chei și e încărcat leneș, ceea ce e bine. Am măsurat: 0 chei `t("…")` literale lipsă, dar **483 de chei nefolosite** (mort sau folosit dinamic, nu se poate verifica). Riscul structural rămâne: orice corectură de diacritice în sursă strică traducerea fără niciun semn, pentru că se cade înapoi pe română.
- Mesaje de eroare fără `t()`: `family-crypto.ts:90,97`, `useFamilySync.ts:225,229`, `realtime-sync.ts:140-160` și `finance-data.ts:710,732`.

**CSS**
- **117 fișiere CSS, ~970 KB sursă, 3.448 de `!important`.** Straturile istorice poartă nume precum `ui-modern-pass-a1/a2/b1/b2/c1/c2/max/aggressive`, `atelier-*-pass`, `contrast-fix`, `display-fixes-pass` sau `visibility-safety`. `.os-dock` e stilizat în 18 fișiere (202 apariții), `.bf-primary` în 42 de fișiere.
- `design-system-37.css:375-386` introduce `@layer ds` cu `!important` tocmai ca să „bată” straturile vechi. Asta confirmă că cascada nu mai e controlabilă altfel.
- `main.tsx` importă pe drumul critic 25 de foi, iar `deferred-styles.ts` **reimportă** `tokens/today/movements/plan/obligations/analysis/design-system-37`. `visual-polish.css` intră **de două ori** în chunk-ul amânat, o dată prin `deferred-atelier.css:37` (`@import`) și o dată prin `deferred-styles.ts:9`. Am verificat în output: `.bf-chart-y{` apare de 3 ori în `deferred-styles-*.css`.
- `monthly-needs.css` a devenit un fișier „de toate”: conține stiluri pentru `bf-income-split` (16 reguli), `bf-envelope-weeks` (16), `bf-envelope-history` (13) și `bf-member-mode-*`. E importat din `MemberModeScreen.tsx:6`, `IncomeSplitCard.tsx:5` și `MonthlyNeedsPanel.tsx:5`.

**Alte probleme**
- `advisorSignals` și `recentActivityMoves` stau în `pages/TodayView.tsx`, deși sunt logică de domeniu. `EnvelopeConflictBanner.tsx:9` importă static `family-crypto` și astfel trage criptarea (28 KB sursă) în chunk-ul principal, cu toate că `useFamilySync` o încarcă leneș.
- CI: `build-android-apk.yml:27` rulează doar `finance-data.test.ts` și nu rulează lint. `deploy-firebase-functions.yml:117` folosește `firebase-tools@latest`, nefixat, deci cu risc de supply-chain.
- `android/app/build.gradle`: `minifyEnabled false` în release, adică fără R8/shrink. Codul Java e mic, dar pluginurile Capacitor și AndroidX intră întregi. `WidgetTemplates`, `QuickActions` și bridge-urile JS din `MainActivity.java:104-106` (`addJavascriptInterface`) dublează mecanismul de plugin Capacitor (`BugetFamilieNativePlugin.java`). Sunt două căi de comunicare nativ ↔ web.
- `server/index.ts` (Express, 33 de linii) și `esbuild` în `build` nu au niciun rol pentru GitHub Pages și Capacitor. `express` e în `dependencies`.
- Documente în rădăcină (`ideas.md`, `todo.md`, `RESTORE_HOME.md`, `REDESIGN_DIRECTION.md`…), `firestore-debug.log` pe disc (necomis).

---

## 5. Performanță

**Măsurători** (sonda `perf.test.ts`, Node pe desktop, 5.500 de mișcări pe 3 ani, 8 plicuri; pe un Android mediu trebuie înmulțit cu 4–6):

| Funcție | ms/apel | Observații |
|---|---|---|
| `buildTodaySummary` | 38–64 | apelează `planCycle`, `planForecast`, `todayBrief`, `weeklyEnvelopeDailyRhythm`, `envelopeDecisionStatus`×N |
| `advisorSignals` (`TodayView.tsx:40`) | 27 | **reapelează** `planCycle`, `planForecast`, `todayBrief` și `envelopeDecisionStatus`×N |
| `todayBrief` | 10–33 | |
| `planWeeklyCycle` | 4–9 | `allocationWeeksStatus` × plicuri × săptămâni × toate mișcările |
| `envelopeDecisionStatus` (toate) | 6–11 | |
| `weekTooFast` / `envelopeRunOut` | 4–8 fiecare | `envelopeRunOut` reapelează `weekTooFast` (`household-insights.ts:700`) |
| `mergeFamilyData` | **350** (70 fără tombstones) | O(n²) la `family-crypto.ts:339` |
| `isoToday()` cu fusul familiei setat | **0,126 ms/apel** (de 90× mai lent) | `isoDateInZone` (`finance-data.ts:238`) construiește un `Intl.DateTimeFormat` nou la fiecare apel |

**Recalculări pe randare**
- **TodayView**, la un singur `data` nou:
  - `planCycle` de 3 ori (`usePlanCycle`, `advisorSignals`, `buildTodaySummary`);
  - `planForecast` de cel puțin 4 ori;
  - `todayBrief` de 2 ori;
  - `envelopeDecisionStatus` pe toate plicurile de 3–4 ori (`TodayView.tsx:60,175`, `today-summary.ts:17`, `envelopeLane`);
  - `weekTooFast` de cel puțin 2 ori (`TodayView.tsx:180` și prin `envelopeRunOut`);
  - scanări `inPlanPeriod` pe fiecare mișcare (`TodayView.tsx:199`, `today-summary.ts:24`), fiecare construind un `Date` prin `planCoverEndDate`. E exact tiparul pe care comentariul de la `finance-data.ts:862-874` spune că l-a eliminat din `allocationSpent`.

  Estimare: ~130 ms pe desktop, 0,5–0,8 s pe un telefon mediu, la fiecare mișcare adăugată.
- **PlanStudio** (`PlanStudio.tsx:119-124`) are 0 `useMemo`. La **fiecare tastă** din formular (30 de `useState`) recalculează `planWeeklyCycle`, `envelopeRunOut` (cu `weekTooFast` înăuntru), `allocationStatus` + `allocationWeekStatus` + `allocationWeeksStatus` pe fiecare plic, `planAllocationMath` (care apelează `allocationStatus` de 3 ori pe plic, la `slice()` din l. 919, 920 și 930) și `isoToday()` de peste 10 ori.
- `Home.tsx:191-194` rulează `adoptOutsideExpenses` după fiecare randare (§3 #10).
- **Serializare:** `syncPortable` face `JSON.stringify` pe tot registrul de cel puțin 2–3 ori la fiecare schimbare (persistență plus efectul de push, `useFamilySync.ts:432,453`). La 2 MB de JSON asta înseamnă câteva zeci de ms pe telefon. PBKDF2 cu 250k iterații rulează la **fiecare** criptare și decriptare (`family-crypto.ts:52-55`), deci un push costă o derivare pentru decrypt plus una pentru encrypt.

**Bundle** (build de producție):
- JS critic: `react-runtime` 200 KB (63 KB gz) + `index` **366 KB (116 KB gz)**. Singurul modulepreload e `react-runtime`, iar restul ecranelor sunt lazy, ceea ce e bine.
- CSS critic `index-*.css` **265 KB (45,5 KB gz)**, plus `deferred-styles-*.css` **422 KB (63 KB gz)**, încărcat la 5 s pe web și 10 s pe Android (`ram-hygiene.ts:28`). Foaia vine **după** prima pictare și re-stilizează ecranul: flash sau CLS potențial, iar comentariul din `deferred-atelier.css` confirmă că dezactivează animații ca să mascheze efectul.
- Chunk-uri lazy mari:
  - `family-sync` (Firebase) 649 KB (161 KB gz);
  - `jspdf` 390 KB, plus `html2canvas` 202 KB și `purify` 29 KB, aduse de jspdf chiar dacă PDF-ul e generat programatic;
  - `i18n-en` 270 KB, se încarcă doar pentru EN;
  - `AICompanion` 99 KB, `PlanStudio` 91 KB, `index.es` 160 KB.
- Nu există o grilă de buget pe chunk-uri în CI. Lighthouse există doar ca script local.

---

## 6. Testare

**Ce e bine:** 1051 de teste pe logica de domeniu, un test separat pe `TZ=Pacific/Auckland` în CI, e2e cu emulatoare pentru sync și reguli (`test:sync`), și teste de layout și de fluxuri cu Playwright.

**Goluri pe căile critice:**
- **Sync și merge** (`family-crypto.test.ts` are 23 de teste):
  - nu e testată propagarea ștergerii pentru plicuri, transferuri, reguli, aplicări, nevoi, venituri, membri și categorii;
  - nu e testată editarea secvențială (A mai nou, B neatins);
  - nu e testat undo după push;
  - nu e testat revert repetat după merge;
  - nu e testată mărimea pachetului;
  - nu e testat comportamentul cu ceasuri decalate;
  - nu e testat LWW pe scalari ai planului cu editări concurente.
- `hooks/useFamilySync.ts` (26 KB), `hooks/usePersistAppData.ts`, `lib/realtime-sync.ts`, `lib/family-session.ts` și `lib/member-identity.ts` **nu au teste unitare**, doar e2e.
- `lib/local-notifications.ts` (33 KB) și `lib/receipt-utils.ts` (46 KB) nu au fișiere de test dedicate.
- Nu există teste de proprietăți (fuzz) pe bani. Nicio aserțiune de tipul „suma cheltuită exact = buget ⇒ nu e over”.
- Nu există teste de performanță sau regresie (buget de ms pe `buildTodaySummary` și pe merge).
- `functions/src/index.ts` (870 de linii: quota, Play, feedback) are **0 teste**.
- Android: niciun test JUnit sau instrumentat pentru widget, `ReminderScheduler` sau deep link.
- Testele nu sunt type-checked (§4).

**Teste concrete de adăugat** (fiecare corespunde unui bug de mai sus; primele 7 pică azi):
1. `family-crypto.test.ts`: „plicul șters pe A nu revine după unirea cu B”. Același test, parametrizat, pentru `transfers`, `weekTransfers`, `salaryAllocationRules`, `salaryAllocationApplications`, `needs`, `incomes`, `members` și `customCategories`.
2. `family-crypto.test.ts`: „editare secvențială: A schimbă suma (updatedAt mai nou), B neatins ⇒ după merge pe B suma e a lui A, fără conflict”. Pentru plic și pentru mișcare.
3. `undo-delete.test.ts`: „undo după ce tombstone-ul a ajuns în cameră ⇒ rândul supraviețuiește merge-ului”.
4. `finance-data.test.ts`: „revert după merge cu camera care încă are aplicarea ⇒ aplicarea nu revine și un al doilea revert nu mai scade nimic”.
5. `finance-data.test.ts`: „cheltuieli 126,33 + 155,77 + 83,18 într-un plic de 365,28 ⇒ `state` nu e `over`, `remaining === 0`”. Plus un test de proprietăți cu `fast-check` pe sume la 2 zecimale.
6. `family-crypto.test.ts`: „pachetul pentru N mișcări rămâne sub 900 KB”. N = 3.000 după comprimare sau împărțire. Azi pică.
7. `household-insights.test.ts`: „`weeklyCheckIn.spent` == `allocationWeekStatus.spent` pentru un plic cu `funding` și mișcări fără sursă”.
8. `family-crypto.test.ts`: „merge cu 2.000 de tombstone-uri < 50 ms”.
9. `TodayView`/`useTodaySummary` (vitest cu fake timers): „după miezul nopții toate cifrele folosesc aceeași zi”.
10. `Home` / `applyFinancialUpdate`, după extragere într-un reducer pur: „două venituri «Salariu» egale, de la membri diferiți, în aceeași zi, se păstrează amândouă”.
11. `adoptOutsideExpenses`: „o cheltuială marcată explicit «În afara plicurilor» rămâne în afară”. Necesită un flag distinct de valoarea implicită.
12. `functions/`: teste cu emulatorul pentru `takeQuota` (limita și comportamentul când Firestore cade), `syncPlayPurchase` (mutarea entitlement-ului între camere) și `appFeedback` (tăierea câmpurilor).
13. Android (Robolectric): „widgetul arată textul «de ieri» când `date` ≠ azi” și reprogramarea la miezul nopții.

---

## 7. Plan de refactorizare pe etape

Pașii sunt mici și sigure, ordonați după valoare/risc. Fiecare etapă trebuie să lase `tsc`, `eslint` și `vitest` verzi.

**Etapa 0: siguranța datelor (1–2 zile, risc mic)**
1. `undo-delete.ts:32`: la restaurare pune `updatedAt: now` pe rândurile readuse. Plus testul #3.
2. `finance-data.ts:895`: `remaining = money2(budget - spent)`, iar `allocationSpent` să întoarcă `money2(total)`. Aceeași regulă în `sourceBalance`, `planAllocationMath` și `cycleEndReport`. Plus testul #5.
3. `family-crypto.ts:339`: deduplicarea tombstone-urilor cu `Map` (O(n)). Plus testul #8.
4. `finance-data.ts:238`: cache pe `Intl.DateTimeFormat` pentru fiecare fus (un `Map<zone, formatter>`).
5. `Home.tsx:191-194`: rulează `adoptOutsideExpenses` o singură dată, la `storageReady` (deps `[storageReady]`), sau stabilizează `applyData` cu `useCallback`.
6. `SpendTodayWidgetProvider`: programează o actualizare la miezul nopții (`AlarmManager` inexact sau WorkManager `OneTimeWorkRequest`), ca eticheta „veche” să apară efectiv.

**Etapa 1: sync corect (1–2 săptămâni, risc mediu, sub feature flag)**
7. Extinde `DeletedRecord.entity` cu `allocations | transfers | weekTransfers | rules | applications | needs | incomes | plannedEvents | contributions | members | categories`. Scrie tombstone în `PlanStudio.tsx:311`, `MonthlyNeedsPanel.tsx:147`, `revertSalaryAllocationApplication` și la ștergerea de membri sau categorii. Aplică filtrarea în `mergeById` și `mergeAllocationsWithConflicts`. Testele #1 și #4.
8. Merge în 3 căi (3-way): păstrează local `lastSyncedSnapshot`, adică hash-uri sau `updatedAt` per id din ultimul pachet unit. Un conflict apare doar dacă **ambele** părți s-au schimbat față de bază; altfel câștigă partea schimbată. Testul #2 (și ajustează `family-crypto.test.ts:97`).
9. Scalarii planului primesc fiecare propriul `…SetAt`, după modelul `familyTimeZoneSetAt`, în loc de LWW pe tot `salaryPlan.updatedAt`.
10. `revertSalaryAllocationApplication`: restaurează un **delta** și refuză anularea dacă plicul s-a schimbat de atunci. Pune un `revertedAt` (soft-delete) în loc să scoți aplicarea din listă.
11. `exchangeRates` intră în pachetul sincronizat, cu LWW per valută, sau conversia soldului inițial se face o singură dată, la salvare.

**Etapa 2: scalabilitatea documentului (1–2 săptămâni, risc mediu-mare)**
12. Pas rapid: comprimă înainte de criptare (`CompressionStream('gzip')`; JSON-ul de registru se comprimă de 5–8 ori) și adaugă `envelope.version: 2`. Regula Firestore trebuie adusă sub 1 MiB real, iar aplicația trebuie să avertizeze la 70% din limită. Câștigă 2–4 ani.
13. Soluția de durată: împarte datele în documente, `familySync/{room}/months/{yyyy-mm}` pentru mișcări și bonuri, plus un document `meta` cu planul și setările, fiecare criptat separat. Push-ul trimite doar luna atinsă. Fetch-ul la push poate fi înlocuit cu `onSnapshot` deja ascultat. Folosește precondiție `updateTime` sau tranzacție (§3 #14).
14. Cheia PBKDF2 derivată o singură dată per sesiune, cu sare per cameră, plus HKDF per pachet, în locul derivării la fiecare criptare.
15. Camere vechi: forțează migrarea spre invitație (ID aleator) și marchează camera veche `syncRoomMovedAt` (§3 #13).

**Etapa 3: performanță UI (3–5 zile, risc mic)**
16. Creează `lib/plan-snapshot.ts` → `computePlanSnapshot(data, today)`. O singură trecere prin mișcări, care calculează status, săptămâni, `decision`, `weekTooFast`, `runOut` și `forecast` pentru toate plicurile. Funcțiile existente devin selectori peste snapshot, fără să schimbe API-ul public.
17. Un hook `useToday()` care se actualizează la miezul nopții și la `visibilitychange`, plus `usePlanSnapshot(data, today)` memoizat. TodayView, PlanStudio și Home îl consumă. Testul #9.
18. PlanStudio: `useMemo` pe snapshot. Formularul de plic devine o componentă separată (starea formularului nu mai re-randează lista), iar liniile de 2 KB se sparg în subcomponente.
19. Mută `advisorSignals` și `recentActivityMoves` în `lib/`.

**Etapa 4: spargerea god-files (incremental, câte un PR pe modul, risc mic, doar mutări și re-exporturi)**
20. `lib/dates.ts`: `isoDate`, `isoToday`, `addIsoDays`, `daysBetween` (o singură convenție, amiază UTC ca în `calendar-budget.ts:15`), `monthKey`. `lib/money.ts`: `money2`, `perDayFloor` (o singură regulă pentru „pe zi”, cu ziua de azi inclusă sau nu, documentată), `WEEKS_PER_MONTH = 52/12`. Înlocuiește cele 8 `round2` și cele 7 `daysBetween`.
21. `lib/allocation-match.ts`: **un singur** `expenseMatchesAllocation(item, allocation)`, folosit la `finance-data.ts:884,975,1048` și `household-insights.ts:950`. Plus testul #7.
22. `finance-data.ts` → `domain/types.ts`, `domain/normalize.ts` (cu validare Zod sau Valibot și `schemaVersion` real), `domain/plan-math.ts`, `domain/salary-rules.ts`, `domain/recurring.ts`, `domain/health-score.ts`, `nlp/category-guess.ts`. `finance-data.ts` rămâne un barrel ca să nu se rupă importurile.
23. `Home.tsx:313` → `lib/financial-update.ts` (reducer pur, testat). Magistrala de `CustomEvent` se înlocuiește treptat cu un context mic de navigare (`useNavigate`), iar `buget-familie:local-settings` primește o listă albă de chei.
24. `useFamilySync.ts` → `lib/sync-engine.ts` (pur: open, merge, push, cu dependențe injectate, testabil) plus un hook subțire.

**Etapa 5: CSS (continuu, risc mediu, verificat cu `test:layout` și capturi de ecran)**
25. Scoate importurile duble (`deferred-styles.ts:2` `visual-polish`, și cele 7 foi reimportate). Câștig imediat de ~40 KB.
26. Declară ordinea straturilor: `@layer reset, tokens, base, legacy, screens, ds;`. Toate foile „pass” și „atelier” intră în `@layer legacy`. Apoi `!important` se scoate treptat din `ds` și din `screens`: în straturi, ordinea hotărăște, nu `!important`.
27. Consolidează pe ecrane (`today.css`, `plan.css`…) și șterge câte o foaie „pass” pe PR, cu diff vizual. Scoate `bf-income-split`, `bf-envelope-weeks`, `bf-envelope-history` și `bf-member-mode-*` din `monthly-needs.css` în fișiere lângă componentele lor.
28. Țintă: CSS critic ≤ 80 KB, nicio foaie amânată care re-stilizează primul ecran.

**Etapa 6: igienă și CI (1–2 zile)**
29. `tsconfig.test.json` care include testele, plus `tsc -p tsconfig.test.json` în CI.
30. Reactivează `react-hooks/exhaustive-deps` ca `warn`, cu excepții explicite. Prettier `--check` în CI.
31. APK CI: `pnpm test` complet și `pnpm lint`. Fixează versiunea `firebase-tools`. Lint și teste pentru `functions/`.
32. Buget de chunk-uri în CI (`index` ≤ 120 KB gz, CSS critic ≤ 50 KB gz). Evaluează `jspdf` fără `html2canvas`.
33. Release Android: `minifyEnabled true` și `shrinkResources true`, cu reguli keep pentru Capacitor. Restrânge `file_paths.xml` la directoarele folosite.
34. Functions: quota care refuză cererea când Firestore cade (fail-closed) pentru `aiGuide`, App Check obligatoriu după ce build-urile îl trimit, verificare OIDC pe `playRtdn`, rate-limit pe `verifyPlayPurchase`. Declară în Data Safety trimiterea contextului la Gemini/Groq.
