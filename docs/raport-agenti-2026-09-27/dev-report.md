# Buget Familie: code review de dezvoltator senior, runda a treia (27.09.2026)

Commit `5b63e2a` · v1.1.96 (versionCode 98) · doar citire. Sondele de reproducere sunt în scratchpad (`agenti3/dev/probe/`), nu în repo. Repo-ul a rămas curat.

## 1. Pe scurt

- **Verificări:** `pnpm check` (aplicația plus testele) are 0 erori, `eslint --max-warnings 0` are 0 probleme, iar `vitest` rulează **123 de fișiere și 1.132 de teste, toate trec**.
- **D1–D16 din runda trecută țin.** Le-am verificat în cod și, unde se putea, cu sondele vechi. Stratul de sync e mult mai sănătos: coadă serială, pachetele deja văzute sunt sărite după IV, iar fiecare scriere are precondiție. Conflictele sunt calculate din perspectiva fiecărui telefon, iar rezolvările se propagă. Importul de backup ține cont de sync. `pushWithRetry` e acum un modul pur, cu teste.
- **Problemele noi stau în trei locuri:**
  1. **„Închide anul”** (funcție nouă) are 5 greșeli de calcul și de pierdere. Plicurile din ciclul curent „câștigă” bani când închizi anul în ianuarie. Orice mișcare cu dată din anul închis care nu era în registru la închidere dispare tăcut, fie că e netrimisă de partener, fie că e importată ulterior din extras. Soldul în EUR se mută după curs.
  2. **Modelul de sync unește *sume*, nu *operații*.** Două salarii repartizate în același plic de pe două telefoane dau un conflict în care nicio variantă nu e corectă (2.600 sau 2.100, în loc de 4.100). Două plăți la aceeași datorie scad doar una.
  3. **A rămas o cursă în `useFamilySync`.** Callback-ul `onRemoteMerged` (și `syncOpenRoom`) face `setData(merged)` nefuncțional, cu o stare citită *înainte* de decriptare. O cheltuială notată cât se decriptează pachetul partenerului se pierde.
- Mai sunt: rotunjirea regulilor în procente (100% refuzat la sume cu bani), „nerepartizați” greșit la plicuri finanțate parțial din tichete, reamintiri Android dublate și care nu se anulează, și hidratarea care poate înlocui tot registrul dacă `localStorage` a fost golit de plafon.

**Notă globală (dev): 7,5/10** (față de 7/10). Reparațiile din runda trecută sunt corecte și testate, iar sync-ul nu mai pierde date în scenariile vechi. Nota nu urcă mai mult pentru că funcția nouă „Închide anul” a intrat cu bug-uri de bani pe care testele ei nu le acoperă. În plus, sync-ul tratează încă sumele de plic și soldul datoriilor ca valori absolute (LWW sau conflict), deși ele se schimbă prin operații care se adună.

Probleme: **P0: 0 · P1: 4 · P2: 8 · P3: 5** (17 în total, toate cu test de reproducere, cu excepția a trei P3 de proces).

---

## 2. Ce s-a confirmat reparat (D1–D16)

| # | Verificare | Stare |
|---|---|---|
| D1 | `useFamilySync.ts:240,256`: `localPending` nu mai marchează drept trimis un pachet unit care conține schimbări locale. După un eșec, `syncLastPortableRef` revine la valoarea de dinainte și pornește reîncercarea 5 s / 30 s / 2 min (`sync-engine.ts:50`, l. 561–568). | ✅ |
| D2 | `family-crypto.ts:338–343`: un conflict „deschis” e recalculat pe fiecare telefon (`localAmount` = valoarea telefonului), iar cât timp e deschis nu mai câștigă nimeni automat. | ✅ |
| D3 | `latestConflict` după `resolvedAt`/`detectedAt`. Sonda veche: A are 0 conflicte după pachetul lui B (înainte avea 1). | ✅ |
| D4 | `syncOpenRoom` scrie cu `expectedIv`, cu 3 reîncercări (l. 288–334). Doar stub-ul „camera s-a mutat” scrie orb, intenționat. | ✅ |
| D5 | `SettingsPanel.tsx:351–358`: pe telefon conectat, backup-ul se unește cu `base = syncBaseOf(backup)` și nu mai derulează familia. | ✅ |
| D6 | `categoryRevivedAt` (sync-removals + merge). Sonda veche: categoria recreată rămâne. | ✅ |
| D7 | `eventContributions` e urmărit în `TRACKED`, iar merge-ul filtrează după piatră. | ✅ |
| D8 | Cheia e ținută pe sare, cu o sare pe sesiune, și ecoul e sărit după IV. | ✅ |
| D9 | `syncEnqueue` serializează tot, iar handler-ul de snapshot folosește `setData` funcțional. **Callback-ul de push nu îl folosește încă (vezi P1-1).** | ⚠️ parțial |
| D10 | `familyNameSetAt`. | ✅ |
| D11 | Nu mai e niciun `.slice(-500)`; peste tot e `TOMBSTONE_MAX`. | ✅ |
| D12 | Efectul `adoptOutsideExpenses` depinde de plicuri și de numărul de mișcări (`Home.tsx:208–211`). | ✅ |
| D13 | `perDay`/`floorCents` în `money-format.ts:26,32`, folosite de allowance și household-insights. | ✅ |
| D14 | `global-day` e împărțit pe 10 shard-uri (`functions/src/index.ts:575–577`). | ✅ |
| D15 | `pnpm check` include `tsconfig.test.json`. APK și AAB rulează check, lint și test. Acțiunile sunt fixate pe SHA, cu Dependabot, iar `firebase-tools@15.31.0` e fixat. `exhaustive-deps: warn` pe `hooks/`. | ✅ |
| D16 | `sync-engine.ts` are teste. Hook-ul `useFamilySync` (682 de linii) **tot nu are teste proprii**, iar P1-1 stă exact în callback-urile lui. | ⚠️ parțial |

---

## 3. Probleme noi

Comanda pentru sonde (din rădăcina repo-ului):
`./node_modules/.bin/vitest run --config <scratchpad>/agenti3/dev/vitest.probe.config.mjs`
Fiecare test descrie comportamentul **corect**, deci dacă pică, bug-ul e confirmat. La rulare: 17 pică și 2 trec (două sume la care rotunjirea nimerește).

### P1-1. O cheltuială notată cât se decriptează pachetul partenerului se pierde (push și intrare sau reluare)
- **Unde:** `client/src/hooks/useFamilySync.ts:528–537` (`onRemoteMerged` → `setData(merged)`), `:325` și `:311` (`syncOpenRoom`).
- **Cauza:** `pushWithRetry` citește `current()` imediat după fetch (`sync-engine.ts:32`), apoi decriptează în worker, unde un await durează de la zeci de ms la ~1 s cu PBKDF2 la o sare nouă. `merged` se calculează din starea veche. Dacă între timp omul a salvat o cheltuială, `mergedPortable !== syncPortable(syncDataRef.current)`, iar `setData(merged)` **înlocuiește** starea: cheltuiala dispare din memorie și din stocare și nu mai pleacă nicăieri. În `syncOpenRoom`, la pornire, fereastra e mai mare: fetch, apoi decriptare cu cheie rece, apoi `touchSyncDevice`, apoi `setData(merged)`. Exact atunci omul intră din widget pe „+ Cheltuială”.
- **Scenariu:** Ioana notează 40 lei (Lidl). La push, camera are 111 lei de la Radu. Cât se decriptează, Ioana notează 25 lei (farmacie). După push are `[kaufland, lidl]`, iar farmacia a dispărut.
- **Test:** `probe/push-race.test.ts` (motorul real `pushWithRetry`, `mergeFamilyData` real, callback-ul copiat 1:1). Pică: `expected ['kaufland','lidl'] to include 'farmacie'`.
- **Reparare:** același model ca în `syncHandleRemoteEnvelope:258`, adică `setData((current) => current === snapshot ? merged : retainImages(mergeFamilyData(current, remote, base)))`, unde `snapshot` e starea din care s-a calculat `merged`. La fel în `syncOpenRoom` (l. 311, 325). Pentru siguranță, `pushWithRetry` poate primi `current()` și după decriptare. Merită un test pe hook (jsdom plus `@testing-library/react` lipsesc din proiect) sau mutarea întregii orchestrări într-un reducer pur.
- **Efort:** S.

### P1-2. „Închide anul” în mijlocul unui ciclu de salariu umflă plicurile și cifra zilei
- **Unde:** `client/src/lib/year-close.ts:17–22` (`closableYears`) și `:48–68`. Calculul e în `finance-data.ts:996–1006` (`allocationSpent` citește doar `data.transactions`).
- **Cauza:** anul se poate închide din 1 ianuarie. Cheltuielile din 25–31 decembrie ale ciclului curent (salariu pe 25) ies din registru, iar `allocationSpent` nu le mai vede. Soldul rămâne corect (`archivedNet`), dar plicurile arată mai mult rămas și `unrepartized` scade. Venitul ciclului dispare și din `periodIncome`.
- **Scenariu:** ciclul 25.12–25.01, plicul Mâncare 2.000, cu 900 cheltuiți pe 28.12 și 100 pe 02.01. Înainte de închidere rămân 1.000. **După închidere rămân 1.900.** „Poți folosi azi” crește cu ~900 / 22 zile.
- **Test:** `probe/year-close.test.ts` Y1: `expected 1900 to be 1000`.
- **Reparare:** `closableYears` să refuze anul Y cât timp `salaryPlan.periodStart <= Y-12-31`, cu textul „Poți închide anul după ce începe primul ciclu din Y+1”. Alternativ, arhiva să lase în registru mișcările din perioada planului curent (atunci `archivedThrough` nu mai e o simplă dată și trebuie și un set de id-uri).
- **Efort:** S.

### P1-3. Mișcările cu dată din anul închis, care nu erau în registru la închidere, dispar tăcut, iar soldul e greșit
- **Unde:** `client/src/lib/finance-data.ts:656` (`normalizeAppData` taie tot ce e `<= archivedThrough`) și `client/src/lib/family-crypto.ts:609` (merge-ul la fel).
- **Scenariul A (partenerul):** Radu notează offline, pe 30.12, 250 lei. Pe 3 ianuarie Ioana închide 2025. Când Radu se conectează, cheltuiala lui e tăiată de merge, **nu intră în arhivă și nici în `archivedNet`**. Soldul familiei rămâne mai mare cu 250 lei, pentru totdeauna.
- **Scenariul B (după închidere):** în februarie, Ioana importă extrasul din decembrie sau corectează data unei mișcări pe 2025-12-31. Rândul apare, dar dispare la prima normalizare (repornire, pachet de la partener), fără să fie arhivat.
- **Teste:** Y2: `expected 5000 to be 4750` (soldul). Y3: `expected false to be true` (mișcarea dispare la reîncărcare).
- **Reparare:** nicio mișcare nu trebuie ștearsă tăcut. În normalizare și merge, o mișcare `<= archivedThrough` care nu figurează în arhivă (de ținut `archivedIds` compact pe an, sau `closedAt` și `createdAt`/`updatedAt > closedAt`) trebuie **pliată**: suma ei intră în `archivedNet[sourceId]` și în `yearSummaries`, cu mesajul „am adăugat 1 mișcare în arhiva 2025”. Sau rămâne în registru. În UI, data unei mișcări și importul de extras trebuie să avertizeze la date din anul închis.
- **Efort:** M.

### P1-4. Două salarii repartizate în același plic, pe telefoane diferite, dau un conflict fără nicio variantă corectă
- **Unde:** `client/src/lib/family-crypto.ts:350–366` (`mergeAllocationsWithConflicts`: sume absolute, bază în 3 căi).
- **Cauza:** repartizarea (`applySalaryAllocationRules`, `finance-data.ts:765`) **adună** la suma plicului, dar sync-ul compară **sume absolute**. Dacă ambele telefoane pleacă de la 600, A pune +2.000 (2.600), iar B pune +1.500 (2.100), ambele diferă de bază și rezultă conflictul {2.600, 2.100}. Corect ar fi 4.100. Oricare variantă aleasă pierde un salariu întreg din plic. Pe ambele telefoane rămân active ambele aplicări, deci o anulare ulterioară scade și suma care nu mai e acolo.
- **Scenariu:** salariile Ion și Ioana vin în aceeași zi, fiecare apasă „Repartizează” pe telefonul lui (unul e pe date mobile slabe).
- **Test:** `probe/two-salaries.test.ts`: primit `{ amount: 2600, options: [2600, 2100] }`, așteptat 4.100.
- **Reparare:** unire aditivă când diferențele față de bază se explică prin aplicări noi (id-uri de `salaryAllocationApplications` care lipsesc de pe o parte): `amount = local + remote − base`. Mai robust: suma plicului să fie derivată (`limita de bază + Σ aplicări active + Σ transferuri`), nu stocată. Minim: în conflict, o a treia opțiune „Adună ambele (4.100)”.
- **Efort:** M.

### P2-1. Același salariu repartizat pe ambele telefoane: două aplicări active, iar anularea duce plicul la 0
- **Unde:** `family-crypto.ts:565` (`salaryAllocationApplications: mergeById`, fără deduplicare pe `incomeId`), `finance-data.ts:806–807` (`current - line.amount`).
- **Scenariu:** ambele telefoane repartizează același venit înainte de sync. Suma iese corect (2.600, pentru că e aceeași schimbare), dar rămân 2 aplicări active. După două anulări plicul e 0, nu 600.
- **Test:** `probe/double-apply.test.ts`: primit `{ duplicate: 2, amount: 0 }`.
- **Reparare:** la merge, păstrați o singură aplicare activă pe `incomeId` (cea mai veche), iar pe cealaltă o marcați `revertedAt` fără efect pe sume. Se rezolvă împreună cu P1-4.
- **Efort:** S.

### P2-2. Două plăți la aceeași datorie: soldul datoriei scade doar cu una
- **Unde:** `family-crypto.ts:610` (`debts: mergeCollection` = LWW pe tot obiectul) și `finance-data.ts:1583–1588` (`remaining` e stocat absolut).
- **Scenariu:** datoria e 10.000. A plătește 500 (9.500), B plătește 300 (9.700). După unire există ambele mișcări, dar `remaining = 9.700` (ultima scriere). Corect ar fi 9.200. Nu apare niciun conflict. Obiectivele de economii (`savings.current`) au același tipar.
- **Test:** `probe/debt-merge.test.ts`: `expected 9700 to be 9200`.
- **Reparare:** `remaining` derivat (`principal − Σ plăți`), sau intrarea datoriilor în `SyncBase` cu unire aditivă (`local + remote − base`) când ambele părți au plăți noi.
- **Efort:** S/M.

### P2-3. Rotunjire: regulile în procente care fac exact 100% sunt refuzate la sume cu bani
- **Unde:** `finance-data.ts:772–775`.
- **Cauza:** fiecare parte se rotunjește separat la ban (`roundedMoney`), iar suma părților poate depăși venitul cu 1 ban. Rezultatul e eroarea „Regulile active depășesc suma venitului”.
- **Scenariu:** salariu 1.000,01 lei cu 50/50% (500,01 + 500,01 = 1.000,02), sau 1.234,55 lei cu 30/30/40%.
- **Test:** `probe/rules-rounding.test.ts`: 2 din 4 cazuri pică.
- **Reparare:** repartizare la ban cu cel mai mare rest (floor pe fiecare parte, apoi banii rămași la părțile cu rest mare) și comparație cu toleranță de 0,005.
- **Efort:** S.

### P2-4. „Nerepartizați” scade din card partea de tichete a unui plic
- **Unde:** `finance-data.ts:1053–1085` (`planAllocationMath`).
- **Cauza:** `availableSources` exclude tichetele (l. 1056), dar `reservedInEnvelopes` scade tot restul plicului, inclusiv partea finanțată din tichete (`funding`). `sourceFreeBalance` (l. 1124) face corect împărțirea pe surse, deci ecranele se contrazic.
- **Scenariu:** card 3.000 lei, tichete 600, plic Mâncare 1.500 din card cu completare 600 din tichete. Cardul liber (`sourceFreeBalance`) e 2.100, dar „nerepartizați” e **1.500**. Cu mai puțini bani pe card apare „Peste limita planului” fals.
- **Test:** `probe/misc.test.ts` M1: `expected 1500 to be 2100`.
- **Reparare:** în `planAllocationMath`, rezervați din fiecare plic doar partea surselor din `sourceIds` (`allocationFundingShares`), la fel ca în `sourceFreeBalance`.
- **Efort:** S.

### P2-5. Soldul în valută al unei surse EUR se schimbă după „Închide anul”
- **Unde:** `finance-data.ts:873` (`archivedNet` în lei împărțit la cursul **de azi**) și `year-close.ts:54–56`.
- **Scenariu:** în 2025 intră 1.000 EUR (4.970 lei, `originalAmount: 1000`), iar cursul actual e 5,10. Înainte de închidere soldul e **1.000 EUR**, după închidere **974,51 EUR**, iar `exact` rămâne `true`.
- **Test:** Y4: `expected 974.51 to be 1000`.
- **Reparare:** `archivedNetOriginal: Record<sourceId, number>` în valuta sursei, calculat la închidere cu aceeași regulă ca `sourceBalanceInCurrency`.
- **Efort:** S.

### P2-6. Hidratarea poate înlocui tot registrul cu o copie goală plus ultima cheltuială
- **Unde:** `app-storage.ts:206–213` (`resolveHydrateMerge` cu `editedBeforeHydrate`), `app-storage.ts:143–147` (la QuotaExceeded se șterge copia din `localStorage`, meta rămâne), `usePersistAppData.ts:24`.
- **Scenariu:** registrul a depășit plafonul `localStorage`, deci copia LS s-a golit. La pornire `readInitialAppData()` dă un registru gol. Dacă omul salvează ceva înainte să răspundă IndexedDB (widget → „+ Cheltuială”, sau migrarea de bonuri de la `Home.tsx:187`), memoria „ștampilată acum” câștigă în fața IndexedDB, **iar registrul întreg e înlocuit** cu o singură mișcare și apoi salvat.
- **Test:** M4: `expected 1 to be greater than or equal to 50`.
- **Reparare:** la `editedBeforeHydrate`, **unire** (`mergeFamilyData(indexed, memory)`) în loc de alegere. Alternativ, blocarea editărilor până la `storageReady` când LS nu are date dar are meta.
- **Efort:** S.

### P2-7. Android: fiecare reamintire apare de două ori
- **Unde:** `local-notifications.ts:818–820`: pe nativ, cu permisiune, se programează **și** prin WorkManager (`scheduleWorkManager`) **și** prin `@capacitor/local-notifications` (`tryCapacitorSchedule`). Cele două canale postează cu chei diferite (tag+id față de id), deci notificarea apare dublată.
- **Test:** `probe/notifications.test.ts` N1 (trebuie copiat temporar în `client/src/lib/`, pentru că `vi.mock` pe pachet nu se rezolvă din scratchpad; după rulare l-am șters). Rezultat: ambele canale apelate.
- **Reparare:** un singur canal. Dacă puntea `BugetFamilieReminders.schedule` există, nu se mai apelează Capacitor.
- **Efort:** S.

### P2-8. Android: reamintirile care nu mai sunt adevărate sună oricum
- **Unde:** `ReminderScheduler.java:20–57` (doar `REPLACE` pe același tag) și `local-notifications.ts:819` (fără `cancelAll` înainte).
- **Scenariu:** la 08:00 se programează „Plic epuizat: Alimente” și „Scadență aproape: Gaz (18:00)”. Omul corectează cheltuiala sau plătește gazul. La reprogramare, alertele acelea lipsesc din listă, dar job-urile WorkManager rămân și sună, cu sume vechi. Același lucru se întâmplă când lista nouă e goală (`if (alerts.length)`).
- **Test:** N2: nici `cancelAll`, nici o reprogramare a tag-ului `env-over-alloc-1`.
- **Reparare:** `ReminderScheduler.scheduleJson` să facă întâi `cancelAllWorkByTag("bf-reminder")` (sau să anuleze tag-urile care lipsesc), iar JS să trimită lista și când e goală.
- **Efort:** S.

### P3-1. După „Închide anul”, Astăzi spune „Pune banii de azi” și scorul spune „nu există mișcări”
- **Unde:** `plan-cycle.ts:22–23` (`hasNoMoneyYet`) și `finance-data.ts:2009` (`marginKnown`) nu văd `archivedNet`.
- **Scenariu:** pe 1 ianuarie, după închidere, nu există nicio mișcare din noul an și soldurile de pornire sunt 0. Soldul real e 4.700, dar eroul zice „Pune banii de azi”.
- **Test:** Y5: `expected true to be false`.
- **Reparare:** să țină cont de `Object.values(archivedNet).some(v => v !== 0)`.
- **Efort:** S.

### P3-2. Plafoanele de normalizare numără și rândurile arhivate, așa că rândul nou dispare
- **Unde:** `finance-data.ts:450` (`incomes … .slice(0, 12)`) și `:436` (`needs … .slice(0, 40)`). „Șterge” doar arhivează (`MonthlyNeedsPanel.tsx:152,160`), iar rândurile noi se adaugă la coadă.
- **Test:** M2: cu 12 venituri arhivate, venitul nou lipsește după normalizare.
- **Reparare:** întâi rândurile active, apoi cele arhivate, sau plafonul aplicat doar pe cele active.
- **Efort:** S.

### P3-3. Web, două file: o sumă schimbată într-o filă devine conflict în cealaltă
- **Unde:** `usePersistAppData.ts:146` (`mergeFamilyData(current, other)` fără bază).
- **Test:** M3: 1 conflict, iar fila B rămâne pe 600.
- **Reparare:** fiecare filă ține `syncBaseOf` al ultimei copii salvate sau primite și o dă merge-ului.
- **Efort:** S.

### P3-4. Reluarea sesiunii nu se mai reîncearcă după un eșec de rețea
- **Unde:** `useFamilySync.ts:474–502`: `syncResumeTriedRef` blochează orice a doua încercare. Dacă Firestore răspunde „unavailable” la pornire (rețea mobilă instabilă), sync-ul rămâne oprit până la repornirea aplicației sau până la reconectarea manuală. Bannerul „oprit” apare, dar nicio cheltuială nu pleacă între timp.
- **Reparare:** la eroare, reîncercare cu `retryDelay` și la evenimentul `online`.
- **Efort:** S.

### P3-5. Functions: fără teste, iar `functions/lib/index.js` e versionat și vechi
- **Unde:** `functions/src/index.ts` are 958 de linii (plafoane AI, `verifyPlayPurchase`, `playRtdn`) și niciun test. `functions/lib/index.js` e în git, din 24.09, deci mai vechi decât sursa din 26.09. CI construiește din nou, dar copia veche încurcă la review și la deploy-uri manuale.
- **Reparare:** `functions/lib` în `.gitignore` și teste vitest pentru `takeQuota` și verificarea cumpărăturii (cu Admin SDK mock-uit).
- **Efort:** S/M.

---

## 4. Datorie tehnică notabilă

- **Sume absolute în loc de operații.** Plicurile, soldul datoriilor și obiectivele sunt valori stocate, schimbate de operații aditive (repartizări, plăți, contribuții). Asta e cauza comună pentru P1-4, P2-1 și P2-2. Pe termen mediu, valorile ar trebui derivate din jurnal (aplicări, plăți), iar sync-ul ar uni jurnale pe id, care se unesc fără conflicte.
- **`useFamilySync.ts` (682 de linii) nu are încă teste de hook.** `sync-engine.ts` acoperă doar bucla de scriere, iar bug-ul P1-1 stă în callback-uri. Proiectul nu are `jsdom` și nici `@testing-library/react`. Propun un reducer pur (`onLocalChange`, `onRemote`, `onPushResult`) cu toate `setData` funcționale.
- **„Închide anul” are 3 teste**, toate pe cazul fericit. Lipsesc: ciclul peste an, partenerul cu mișcări netrimise, valuta, datele ulterioare închiderii.
- `finance-data.ts` are 2.175 de linii, iar `normalizeAppData` e încă o singură linie de ~9 KB (l. 663). `Home.tsx` are ~690 de linii, cu efecte pe o singură linie.
- `react-hooks/exhaustive-deps` e oprit în afara `hooks/`, deci efectele din `Home.tsx` nu sunt verificate.
- Android: `minifyEnabled false` în release. Există două mecanisme de notificări (WorkManager și Capacitor) care fac același lucru (P2-7).
- Plafonul AI pe shard-uri e `ceil(cap/10)` pe un shard ales la întâmplare. Poate refuza înainte de plafonul global real (tolerabil, de documentat).

## 5. Top 5

1. **P1-1:** `setData` funcțional în `onRemoteMerged` și `syncOpenRoom` (S). Oprește pierderea tăcută a cheltuielilor.
2. **P1-2 și P1-3:** „Închide anul” refuzat cât timp ciclul curent începe în anul respectiv, iar mișcările târzii pliate în arhivă, nu șterse (S+M).
3. **P1-4 și P2-1:** unire aditivă pentru repartizări (sau sume de plic derivate) și o singură aplicare activă pe venit (M).
4. **P2-6:** hidratarea unește în loc să aleagă (S). Previne înlocuirea întregului registru.
5. **P2-2, P2-3 și P2-4:** datoriile cu plăți concurente, rotunjirea la ban a procentelor și rezervarea pe surse în „nerepartizați” (S fiecare).

---
Sonde (în afara repo-ului, în `scratchpad/agenti3/dev/probe/`): `push-race.test.ts` (P1-1), `year-close.test.ts` (P1-2, P1-3, P2-5, P3-1), `two-salaries.test.ts` (P1-4), `double-apply.test.ts` (P2-1), `debt-merge.test.ts` (P2-2), `rules-rounding.test.ts` (P2-3), `misc.test.ts` (P2-4, P2-6, P3-2, P3-3), `notifications.test.ts` (P2-7, P2-8; se rulează copiat temporar în `client/src/lib/`). Configurare: `agenti3/dev/vitest.probe.config.mjs`.
