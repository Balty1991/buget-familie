# Raport QA — Buget Familie, runda a treia (27.09.2026, commit 5b63e2a, v1.1.96)

Probele și capturile sunt în `scratchpad/agenti3/qa/` (`t50-…` … `t64-…`, `seedlib.mjs` = familia demo din `scripts/store-screenshots/seed.mjs`, plus până la 3.000 de mișcări). Au rulat pe serverul de dezvoltare de la :5174, fără Firebase și fără emulator. `e2e/layout.e2e.mjs` nu l-am rulat, cum s-a cerut.

## 1. Pe scurt

- **Verificări automate: toate trec.**
  - `pnpm -s check` (tsc aplicație + teste): exit 0.
  - `pnpm -s test`: **123 fișiere / 1132 teste** trec. În runda trecută erau 115 / 1104.
  - `e2e/flows.e2e.mjs`: 6 fluxuri, exit 0.
- **Reparațiile din runda trecută: 11 din 12 țin.** QA-04 e reparată doar pe jumătate: ștergerea și anularea ei ajustează corect datoria, dar **corectarea** unei plăți de rată o rupe de datorie (vezi QA3-01).
- **Funcțiile noi:**
  - Web Worker-ul pentru criptare merge. Cu 3.000 de mișcări: criptare în 157 ms, decriptare în 45 ms. Cel mai lung blocaj al firului principal a fost de 15 ms. Parola greșită dă mesaj în română.
  - Reîncercarea sync (`pushWithRetry`, 5 s / 30 s / 2 min) e corectă la citirea codului și are teste.
  - Bara laterală de la ≥1200 px și capturile de tabletă la 800 px nu au overflow.
  - Închiderea anului are o problemă de fond (QA3-02). Foaia „+ Plic” nu se comportă ca un dialog (QA3-05).
- **Lățimi și teme:** 6 lățimi (320, 360, 390, 768, 800, 1280) × 3 teme × 6 ecrane, cu 3.000+ mișcări.
  - Overflow orizontal: 0.
  - Erori sau avertismente în consolă și cereri eșuate: 0.
  - Trecerea între ecrane: 1,4–2,6 s.
  - axe-core: 2 reguli încălcate (QA3-06, QA3-07). Modalele „Notează” și „Corectează” și foaia „+ Plic” trec pe toate cele 3 teme.
- **Date limită** (ceas mutat, fus Europe/Bucharest): 25.10.2026 03:30 (trecerea la ora de iarnă), 28.03.2027 03:30 (trecerea la ora de vară), 29.02.2028, 31.12.2026 23:59, 31.01.2027, 28.02.2027 23:30.
  - Pe niciun ecran nu apar NaN, „Invalid Date”, `undefined` sau „-0,00”.
  - `isoToday` e corect în toate cazurile.
- **Defecte noi: 9** — 0 P0, 2 P1, 4 P2, 3 P3.
- **Notă globală QA: 8/10** (față de 7/10 pe 26.09). Toate cele 12 defecte din runda trecută au fost atacate, iar P0-ul (pozele bonurilor) e reparat cu adevărat. Rămân două probleme P1 de integritate a registrului: corectura care șterge „natura” unei mișcări și închiderea anului care taie ciclul de salariu în două.

## 2. Ce s-a confirmat reparat (reprobat pe 5b63e2a)

| # | Probă | Rezultat acum |
|---|---|---|
| QA-01 P0 poze bon | `t9-rkeys.mjs` | `imageKeys` rămâne după editare și reîncărcare (LS le are). ✅ |
| QA-02 3 zecimale | `t1-amount.mjs` | câmpul arată „12,35”, se salvează 12,35. ✅ |
| QA-03 recurentă ștearsă | `t2-recur.mjs` | rămâne ștearsă după reîncărcare. ✅ |
| QA-04 rată ↔ datorie | `t3-debt.mjs`, `t63-undo.mjs` | ștergere → 5.000 ✅, anulare → 4.500 ✅; **corectura rupe legătura** ❌ (QA3-01) |
| QA-05 Back Android | cod `Home.tsx:303-319` | listener `backButton`: dialog → modal → Mai mult → Astăzi → ieșire. ✅ (netestat pe telefon) |
| QA-06 exporturi în APK | cod `lib/save-export.ts` | Filesystem + Share pe nativ, revocare întârziată pe web. ✅ (netestat pe telefon) |
| QA-07 date invalide | `t7-date.mjs` | „31.02.2026” și „01.01.9999” blochează salvarea, cu eroare. ✅ |
| QA-08 sume limită | `t8-quick.mjs` | „0,001” → „Suma e mai mică de un ban”; plafon 999.999.999. ✅ |
| QA-09 registru stricat | `t4-corrupt.mjs` | nume numerice sau obiecte nu mai dărâmă aplicația. ✅ (rămâne doar avertismentul React pentru id-uri duplicate) |
| QA-10 două file | `t11-tabs.mjs` | `[11, 5200, 230.5, 22]`: ambele cheltuieli rămân. ✅ |
| QA-11 CSV injection | cod `save-export.ts:10-14` | `csvSafe` pune `'` în față. ✅ |
| QA-12 plata datoriei pe copie veche | — | marcat reparat în STATUS; n-am reprobat separat. |

Alte verificări care trec:
- Backup cu 2.100 de mișcări, an închis, datorie și bon, exportat și reimportat: mișcări, sume, plicuri, venituri, datorii, `imageKeys`, `archivedThrough`/`archivedNet`, surse, membri și evenimente sunt identice (`t62-backup.mjs`).
- Sumele negative, zero și prea mari sunt refuzate la „+ Plic”.

## 3. Defecte noi

### QA3-01 — P1 — Corectarea unei mișcări „speciale” îi șterge natura: rata se desface de datorie, transferul devine venit, corecția de sold devine venit
- **Pași:**
  1. Obligații → plătește rata 500 din datoria „Credit IFN” 5.000. Soldul datoriei devine 4.500.
  2. Mișcări → atingi plata → schimbi suma în 50 → Salvează.
  3. La fel, deschizi și salvezi fără nicio schimbare un „Mutat din Card debit” (transfer) și o „Corecție de sold”.
- **Așteptat:** datoria ajunge la 4.950, iar mișcările își păstrează `debtId`, `transferId`, `adjustment` și `recurringId`.
- **Obținut** (`t3-debt.mjs`, `t50-editflags.mjs`):
  - Datoria revine la **5.000**, deși s-au plătit 50. Mișcarea rămâne cu `debtId: null`.
  - Jumătatea „intrare” a transferului pierde `transferId` și primește categoria **„Venit”**, deci apare ca venit în rapoarte și în închiderea ciclului.
  - „Corecția de sold” pierde `adjustment` și devine venit adevărat.
  - O plată recurentă confirmată și corectată pierde `recurringId`. Obligații o poate arăta din nou ca neplătită, deci omul poate plăti de două ori.
- **Cauză:** `client/src/pages/TransactionForm.tsx:136` construiește obiectul de la zero. Păstrează doar `receiptId` și `createdAt` din `initial`, iar `commitLedgerEntry` (`client/src/lib/finance-data.ts:1460-1463`) înlocuiește rândul întreg. `adjustDebtsForLedgerEdits` (`finance-data.ts:1596-1625`) vede mișcarea fără `debtId` și o tratează ca ștearsă.
- **Reparare:** în formular, `{ ...initial, ...câmpuriEditate }`, adică păstrează `debtId`, `debtRemainingAfter`, `transferId`, `adjustment`, `recurringId` și `originalAmount`. Pentru transferuri și corecții, fie formularul arată „Mutare între surse”, fie editarea lor e blocată. Un test „edit fără schimbări = registru identic” ar prinde toată clasa de probleme.
- **Efort:** S.

### QA3-02 — P1 — „Închide anul” taie ciclul de salariu în curs: plicurile se „umplu” la loc, iar o mișcare pe anul închis dispare la reîncărcare
- **Pași** (`t51-yearcycle.mjs`):
  1. Ciclul merge de la 20.12.2025 la 20.01.2026, cu plicul „Mâncare” de 2.000.
  2. S-au cheltuit 800 pe 28.12 și 200 pe 03.01.
  3. Pe 05.01.2026, Setări → Închide anul 2025.
- **Așteptat:** închiderea e oprită (sau amânată) cât timp ciclul care cuprinde 31.12 e deschis, ori plicurile păstrează ce s-a cheltuit.
- **Obținut:**
  - `allocationSpent` scade de la **1.000 la 200**, deci plicul arată cu 800 lei mai mult disponibil. Venitul din 20.12 dispare și el din ciclu.
  - Soldul sursei rămâne corect, prin `archivedNet`.
  - Un bon uitat, trecut după închidere cu data 30.12.2025, se salvează și schimbă soldul (4.950). La reîncărcare **dispare fără urmă** (`normalizeAppData` îl filtrează), iar soldul revine la 5.000.
- **Cauză:**
  - `client/src/lib/year-close.ts:17-23`: `closableYears` verifică doar `year < anul curent`.
  - `year-close.ts:49-53` arhivează tot ce e până la 31.12.
  - `client/src/lib/finance-data.ts:656` (`keptTransactions`) aruncă mișcările cu data ≤ `archivedThrough`.
  - Formularele nu refuză o dată din anul închis.
- **Reparare:**
  - Anul se poate închide doar după ce `periodStart` > 31.12 (sau tăietura se face la `periodStart`).
  - `RoDateInput` refuză datele ≤ `archivedThrough`, cu mesaj: „Anul 2025 e închis”.
- **Efort:** S–M.

### QA3-03 — P2 — Arhiva anului nu poate fi citită sau reimportată din aplicație
- **Ce se întâmplă:** comentariul din `year-close.ts:71` promite că arhiva e „citibilă și importabilă”. `parseBackup` (`client/src/lib/app-storage.ts:264-268`) acceptă însă doar `kind: "buget-familie-backup"`, deci fișierul `buget-familie-arhiva-2025.json` e refuzat cu „Fișierul nu este un backup Buget Familie valid.”. În aplicație rămân doar totalurile anuale din Setări: analiza pe categorii și căutarea nu mai văd anul închis.
- **Reparare:** vizualizare doar-citire a arhivei (Mișcări filtrate pe anul arhivei) sau import care o recunoaște. Cel puțin, un mesaj de eroare specific.
- **Efort:** M.

### QA3-04 — P2 — Închiderea ciclului: ziua salariului „alunecă” (31 → 28 pentru totdeauna, 10 → 30 când închizi târziu)
- **Pași** (`t64-cycle.mjs`, `startNextCycle` direct):
  - Salariu pe 31, ciclu 31.01 → 28.02.2027, închis pe 31.03: ciclul nou e **28.03 → 28.04**. Ar trebui 31.03 → 30.04.
  - Salariu pe 10, ciclul închis cu 20 de zile întârziere (30.10): ciclul nou e **30.10 → 30.11**. Ar trebui … → 10.11.
- **Cauză:** `client/src/lib/cycle-close.ts:115-116` și `nextMonthSameDay` (`:62-68`) iau ziua din data de start, nu din `salaryPlan.incomes[].day`. După un februarie, ziua de plată rămâne 28 în fiecare lună.
- **Reparare:** `nextPaydayAfter(nextStart, ziuaSalariului)` din `lib/monthly-needs.ts:135`, cu ziua din venitul principal.
- **Efort:** S.

### QA3-05 — P2 — Foaia „+ Plic” pe telefon nu e un dialog: focusul rămâne în spatele ei
- **Pași** (`t60-plicfocus.mjs`, 390 px): Plicuri → focus pe „+ Plic” → Enter.
- **Obținut:**
  - Foaia se deschide (`position: fixed`, peste pagină), dar focusul **rămâne pe butonul din spatele fundalului**.
  - Tab merge prin pagina acoperită („Detalii”, „Am înțeles”, …), iar cititorul de ecran nu află că s-a deschis ceva: fără `role="dialog"` și fără `aria-modal`.
  - Esc nu închide foaia când focusul e în afara ei.
  - Previzualizarea „Verifică înainte de aplicare” (`role="dialog" aria-modal`) nu primește nici ea focus (`focusIn=false`).
- **Cauză:** `client/src/components/PlanStudio.tsx:553-556` (`<details>` + fundal, fără `useFocusTrap`) și `:666` (previzualizarea fără focus inițial).
- **Reparare:** `useFocusTrap` pe foaie și pe previzualizare (există deja în `hooks/use-focus-trap.ts`), focus pe primul câmp, `role="dialog" aria-modal="true" aria-labelledby`, iar la închidere focusul revine pe „+ Plic”. Asta face și ca Back pe Android să închidă foaia prin `closeTopDialog`.
- **Efort:** S.

### QA3-06 — P2 — Tema Navy pe desktop (≥1200 px): elementul activ din bara laterală are contrast 1,9:1
- **Obținut:** axe `color-contrast` pe Astăzi, Plicuri, Mișcări, Obligații și Analiză, la 1199–1280 px: text `#111111` pe `#3b444e`, adică **1,9:1** (minimul e 4,5:1). Captura `navy-nav-1280.png`: „Astăzi” abia se vede. La 768–1024 px trece.
- **Cauză:** `client/src/contrast-fix.css:377-379` forțează `color: var(--cf-on-primary)` (închis, gândit pentru o umplutură deschisă), iar `client/src/household-os-chrome.css:625-629` dă un fundal închis (`--os-mint-dim`).
- **Reparare:** pe Navy, `.os-desktop-nav button.is-on` primește `color: var(--os-mint)` sau o umplutură deschisă. De adăugat în `layout.e2e` o verificare axe la 1280 × navy.
- **Efort:** S.

### QA3-07 — P3 — Analiză: `aria-label` pe un `<span>` fără rol (axe `aria-prohibited-attr`, 6 noduri, toate temele)
- **Cauză:** `client/src/components/MonthVsAverage.tsx:24`, `<span className="bf-mva-bar" aria-label=…>`. Cititoarele de ecran ignoră eticheta, deci „X acum, media Y” nu se aude.
- **Reparare:** `role="img"` pe span, sau textul într-un `<span className="sr-only">`.
- **Efort:** S.

### QA3-08 — P3 — Căutarea din Mișcări nu ignoră diacriticele și nu găsește suma scrisă cu virgulă
- **Obținut** (`t55-search.mjs`, familia demo):
  - „mancare” → 0 și „Mâncare” → 0, deși plicul Mâncare are 4 mișcări. Paleta Ctrl K le găsește pe toate 4.
  - „benzina” → 0.
  - „86,40” → 0, dar „86.4” → 1.
- **Cauză:** `client/src/components/MovementsJournal.tsx:58-61`: haystack-ul folosește `String(item.amount)`, nu are numele plicului și nu trece prin `foldRomanian`. Comparația de la `:71-72` e `toLocaleLowerCase` simplu.
- **Reparare:** același `foldRomanian` pe ambele părți. În haystack intră și eticheta plicului și suma în format românesc (`amountInput`).
- **Efort:** S.

### QA3-09 — P3 — Suma plicului nu se rotunjește la bani
- **Obținut** (`t61-plicsave.mjs`): „+ Plic” cu „12,345” salvează `amount: 12.345`, deși previzualizarea arată „12,35 RON”. Totalurile planului pot da „…,005” și diferențe de un ban între ecrane.
- **Cauză:** `client/src/components/PlanStudio.tsx:194` (`allocationTotalFromInput`) și `:339`, fără `money2`.
- **Reparare:** `money2(...)` la salvare, ca în `commitLedgerEntry`.
- **Efort:** S.

## 4. Top 5

1. **QA3-01 (P1):** corectura unei plăți de rată, a unui transfer, a unei corecții de sold sau a unei plăți recurente le strică legătura. Se repară cu o linie (`...initial`), dar efectul pe datorii și pe rapoarte e mare.
2. **QA3-02 (P1):** „Închide anul” în mijlocul unui ciclu decembrie–ianuarie reface plicurile, iar o mișcare pe anul închis dispare la reîncărcare.
3. **QA3-04 (P2):** ziua salariului alunecă după februarie sau după o închidere de ciclu întârziată.
4. **QA3-05 (P2):** foaia „+ Plic” fără capcană de focus și fără rol de dialog (tastatură, cititor de ecran, Back pe Android).
5. **QA3-06 (P2):** contrastul de 1,9:1 al elementului activ din bara laterală pe Navy, la desktop.

## 5. Observații fără defect

- Cu familia demo plus 3.000 de mișcări, pornirea (seed + reîncărcare) durează ~5–5,9 s, față de ~3 s în runda trecută cu seed mai mic. Nu e o măsurătoare comparabilă, dar merită o probă de performanță separată.
- `t4-corrupt.mjs`: id-urile duplicate din registru dau încă avertismentul React „two children with the same key”. Normalizarea ar putea dedubla id-urile.
- Web: Back-ul din browser (fără Capacitor) tot nu închide modalele (`pushState`/`popstate` lipsesc). Pe APK e rezolvat.
