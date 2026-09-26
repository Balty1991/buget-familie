# Raport QA — Buget Familie (26.09.2026; pornit pe commit 1935b14, reverificat pe HEAD 33f7b6e + working tree)

Probe și capturi: `scratchpad/agenti/qa/` (`t1-amount.mjs` … `t13-320.mjs`, `lib.mjs` = deschidere + seed prin stocarea aplicației; `*.log` = ieșirile verificărilor). Toate probele au rulat pe serverul de dezvoltare de la :5174, fără Firebase. În timpul testării, HEAD a avansat la 33f7b6e; am rerulat probele pentru QA-01…QA-05, QA-07 și QA-10 pe codul nou și toate se reproduc la fel. Liniile de cod citate sunt cele de la 33f7b6e.

## 1. Pe scurt

- **Verificări automate: toate trec.** `tsc --noEmit` exit 0. `eslint --max-warnings 0` exit 0. `pnpm test`: **115 fișiere / 1104 teste trec**. `e2e/flows.e2e.mjs` trece (6 fluxuri). `e2e/layout.e2e.mjs` trece: „13 ecrane × 3 teme × 2 lățimi”.
- **axe-core (WCAG 2.2 AA)**: 0 încălcări pe Astăzi, Mișcări, Plicuri, Obligații, Analiză, Mai mult, De verificat, Sync, Setări, Aspect, Notează și Ghid, pe white, dark și navy.
- **Consolă și rețea**: 0 erori sau avertismente și 0 cereri eșuate, cu 3.000 de mișcări, la 320/360/390/768/1280 px. Nu există overflow orizontal la aceste lățimi. Ecranul pornește în aproximativ 3 s, iar trecerea între ecrane durează aproximativ 1,5 s.
- **Am găsit 12 bug-uri noi**, pe care auditul din 25.09 nu le avea: 1 P0, 5 P1, 4 P2 și 2 P3. Cel mai grav este **pierderea legăturii dintre bonuri și fotografiile lor la fiecare reîncărcare** după o modificare. Urmează:
  - sume cu trei zecimale care cresc de **1.000 de ori** la o simplă corectură;
  - plăți recurente șterse care **reapar singure**;
  - plăți de rată care, corectate sau șterse, **nu mai corespund cu soldul datoriei**;
  - butonul Back de pe Android, care **închide aplicația** cu formularul completat.
- **Notă globală QA: 7/10.** Ce testează suitele automate e bine acoperit (layout, a11y, fluxuri de bază). Defectele sunt la granițele dintre module: persistență ↔ sincronizare, registru ↔ datorii, tombstones ↔ generare automată, formulare ↔ parser.

## 2. Constatări

### QA-01 — P0 — Bonurile își pierd fotografiile după orice modificare urmată de reîncărcare
- **Ce se întâmplă:** după o modificare, localStorage primește `syncPortable(data)`, adică registrul fără `imageData`, `imageData2` și **`imageKeys`**. IndexedDB primește registrul complet, cu aceeași ștampilă `savedAt`. Cele două hash-uri se calculează pe texte diferite, deci nu se potrivesc. La pornire, `chooseFresherAppData` găsește aceeași ștampilă și alege **localStorage** („Același milisecund: preferăm LS”). Bonurile rămân astfel fără `imageKeys`, apoi această versiune se scrie înapoi în IndexedDB. Pozele rămân în stocarea lor, dar nimic nu mai trimite la ele: bonul apare „fără poze”.
- **Pași:**
  1. Un bon cu fotografie (`imageKeys: ["receipt-img-r1-0"]`).
  2. Notează orice cheltuială (5 lei).
  3. Reîncarcă aplicația.
- **Așteptat:** `imageKeys` rămâne. **Obținut:** `after edit (IDB): [["receipt-img-r1-0"]]` → `LS has imageKeys? false` → `after reload (IDB): [null]` (`t9-rkeys.mjs`).
- **Cauză:**
  - `client/src/hooks/usePersistAppData.ts:73`: LS primește `syncPortable`, iar IDB primește `data`;
  - `client/src/hooks/useFamilySync.ts:49-53`: `syncPortable` scoate și `imageKeys`;
  - `client/src/lib/app-storage.ts:173-190`: la ștampile egale câștigă LS;
  - hash-ul din `writeAppData` (`app-storage.ts:240`) se calculează pe alt text decât cel din LS.
- **Reparare:**
  - `imageKeys` rămâne în snapshot-ul LS. Sunt doar chei scurte; pozele propriu-zise pot fi scoase în continuare.
  - Același hash pe ambele căi: hash-ul se calculează pe `syncPortable(data)` și în `writeAppData`.
  - La ștampile egale, câștigă copia care are `imageKeys`.
  - Un test: „persist → hydrate păstrează imageKeys”.
- **Efort:** S.

### QA-02 — P1 — Suma cu 3 zecimale devine de 1.000 de ori mai mare la o simplă corectură
- **Ce se întâmplă:** „Notează” acceptă „12,345” și salvează `12.345` fără rotunjire la bani. „Corectează mișcarea” pune în câmp `String(12.345)` = „12.345”. `parseRomanianAmount` citește punctul urmat de 3 cifre ca separator de mii, deci suma devine **12.345 lei**. Omul schimbă doar titlul sau data și apasă Salvează.
- **Pași:** Notează → Sumă „12,345” → Salvează. Apoi Mișcări → atingi mișcarea → „Salvează mișcarea” fără nicio altă schimbare.
- **Așteptat:** 12,35 lei. **Obținut:** `amount field shows: 12.345` → `stored after save: 12345` (`t1-amount.mjs`, `t8-quick.mjs`).
- **Cauză:**
  - `client/src/pages/TransactionForm.tsx:16` și `:31` (`String(initial.amount)`). La fel `client/src/components/PlanStudio.tsx:344` (`String(item.amount)`, `String(entry.amount)`).
  - Lipsa rotunjirii la salvare: `client/src/components/QuickEntryPanel.tsx:150-161` și `TransactionForm.tsx:86-101`.
  - Regula de mii din `client/src/lib/finance-data.ts:298` (`\.(?=\d{3}…)`).
- **Reparare:**
  - Sumele se rotunjesc la 2 zecimale la salvare (`roundedMoney`), în toate formularele.
  - În câmpul de editare, suma apare în format românesc: `String(x).replace(".", ",")`, cum fac deja `QuickEntryPanel:53` și `RecurringPanel:64`. Mai bine, un helper comun `amountForInput()`.
- **Efort:** S.

### QA-03 — P1 — O plată recurentă adăugată automat, dacă o ștergi, reapare la următoarea deschidere
- **Pași:**
  1. O scadență „Internet” 60 lei cu „adaugă automat”, cu scadența acum 2 zile.
  2. Deschizi aplicația. Mișcarea `recurring-auto-net-2026-09-24` apare.
  3. Mișcări → Șterge → confirmi. Mișcarea dispare și primește tombstone.
  4. Reîncarci.
- **Așteptat:** rămâne ștearsă. Omul a hotărât că luna asta n-a plătit sau a plătit altfel.
- **Obținut:** reapare cu același id și cu `updatedAt` nou, deși `deleted` conține încă id-ul (`t2-recur.mjs`). Pentru că `updatedAt` e mai nou decât tombstone-ul, la sincronizare câștigă rândul, deci ștergerea nu ajunge pe celălalt telefon.
- **Cauză:** `client/src/lib/finance-data.ts:1629-1647` (`autoPostDueRecurring` nu verifică `data.deleted`). Funcția e apelată la fiecare pornire: `client/src/hooks/usePersistAppData.ts:89-92`.
- **Reparare:** se sare peste orice `id` din `data.deleted` (entity `transactions`). Opțional, confirmarea ștergerii poate întreba: „Nu am plătit luna asta / Oprește plata automată”.
- **Efort:** S.

### QA-04 — P1 — Corectarea sau ștergerea unei plăți de rată nu actualizează soldul datoriei
- **Pași:**
  1. Datoria „Credit IFN” 5.000. Obligații → Plătește rata 500. Soldul devine 4.500.
  2. Mișcări → corectezi plata la 50. Soldul rămâne 4.500, deși ar trebui să fie 4.950.
  3. Ștergi plata. Soldul rămâne tot 4.500, deși ar trebui să revină la 5.000.
- **Dovadă:** `t3-debt.mjs`: `after edit to 50: [Credit IFN, 4500]`, `after delete: [Credit IFN, 4500] 0`. Istoricul datoriei și „sold rămas” din notiță (`debtRemainingAfter`) nu se mai potrivesc cu registrul. Nici anularea ștergerii nu atinge datoria.
- **Cauză:** `recordDebtPayment` (`client/src/lib/finance-data.ts:1511-1517`) scade soldul o singură dată. Ștergerea (`client/src/pages/Home.tsx:607-609`) și `saveTx` pentru o mișcare cu `debtId` nu îl ajustează.
- **Reparare:** la edit sau delete al unei mișcări cu `debtId`, `remaining` se ajustează cu diferența (plafonat între 0 și sumă). Același lucru pentru `buildUndo`. Altă variantă: `remaining` se calculează din `total − Σ plăți`. Ar ajuta și un avertisment în formular: „Această mișcare e plata unei rate”.
- **Efort:** M.

### QA-05 — P1 — Butonul Back de pe Android închide aplicația, inclusiv din formularul completat
- **Ce se întâmplă:** aplicația nu scrie nimic în istoric (`history.length` rămâne 2 după navigare) și nu are listener `backButton` în Capacitor. `Home.tsx:287` ascultă doar `appUrlOpen`, iar `MainActivity.java` nu tratează back. În WebView, Back fără istoric **iese din aplicație**. Asta se întâmplă din orice ecran (Plicuri, Mai mult → Setări) și din „Notează” cu suma deja scrisă. La redeschidere aplicația pornește pe Astăzi, iar ciorna s-a pierdut.
- **Dovadă:** `t6-back.mjs`: `history 2` înainte și după navigare sau modal, câmpul e gol după reîncărcare, iar căutarea `backButton|popstate|pushState` dă 0 rezultate. Pe telefon n-am putut testa; comportamentul e cel standard Capacitor/WebView.
- **Reparare:** `App.addListener("backButton", …)` închide, în ordine, dialogul de confirmare, modalul, foaia „Mai mult”, apoi duce la ecranul anterior sau pe Astăzi. Doar de pe Astăzi apare „Mai apasă o dată pentru a ieși”. Pe web, același lucru prin `pushState`/`popstate` pentru modale.
- **Efort:** M.

### QA-06 — P1 — Exporturile CSV/PDF probabil nu fac nimic în APK (din cod, de confirmat pe telefon)
- **Ce se întâmplă:** Jurnal CSV (`client/src/lib/journal-csv.ts:30-34`), istoricul repartizărilor (`client/src/lib/allocation-history.ts:42`) și PDF-urile (`weekly-digest-pdf.ts:167`, `monthly-balance-pdf.ts:36`, `calendar-plan-pdf.ts:120`, toate cu `doc.save`) folosesc `<a download href="blob:…">`. WebView-ul Android nu descarcă `blob:` fără `DownloadListener`, iar `MainActivity.java` nu setează unul. Backupul are drum nativ separat (`BugetFamilieNativePlugin.saveBackupToDownloads`), exporturile acestea nu. În plus, `journal-csv.ts:33` revocă URL-ul imediat după `click()`, ceea ce strică descărcarea și pe unele browsere.
- **Reparare:** un `saveExport(name, mime, text|bytes)` comun. Pe nativ folosește MediaStore (pluginul existent, generalizat pentru `mime`) sau partajarea; pe web, `<a download>` cu `revokeObjectURL` întârziat, cum face deja `downloadBackup`.
- **Efort:** M.

### QA-07 — P2 — Data invalidă e ignorată în tăcere; data 01.01.9999 e acceptată
- **Pași:** corectezi o mișcare și scrii data „31.02.2026”, apoi Salvează. Separat, scrii „01.01.9999”, apoi Salvează.
- **Obținut:**
  - „31.02.2026”: modalul se închide fără eroare, iar mișcarea **păstrează data veche** (2026-09-23).
  - „01.01.9999”: se salvează `9999-01-01` (`t7-date.mjs`). Mișcarea apare într-un an inexistent în rapoarte și nu mai poate fi găsită ușor.
- **Cauză:** `client/src/components/RoDateInput.tsx:9-20` (doar `year < 1900`, fără limită superioară). La blur, câmpul rămâne `aria-invalid`, dar părintele primește valoarea veche, iar `TransactionForm.save` (`TransactionForm.tsx:86-99`) nu știe că textul e invalid.
- **Reparare:**
  - `RoDateInput` expune starea invalidă (`onValidity`), iar formularele blochează salvarea.
  - Interval acceptat: de la azi − 5 ani la azi + 2 ani. Pentru date viitoare, confirmare: „Data e în viitor — sigur?”.
- **Efort:** S.

### QA-08 — P2 — Sume fără limită superioară și sume sub 1 ban
- **Pași:** Notează → „99999999999999999999” sau „0,001”.
- **Obținut:**
  - Prima se salvează ca `1e20` și apare pe Astăzi drept „PESTE LIMITA PLANULUI 100.000.000.0…”, tăiat (captura `t8.png`). Cu sume de ordinul milioanelor, pastila „NEREPARTIZAȚI” din Plicuri suprapune eticheta și cifra la 320 px (`big-320-navy.png`). La 122.400 RON se vede bine (`t13-320.mjs`).
  - „0,001” se salvează ca mișcare de „0 RON” (`t8-quick.mjs`).
- **Cauză:** `amountError` (`client/src/lib/finance-data.ts:305-312`) verifică doar `> 0`.
- **Reparare:**
  - Refuz sub 0,01. Plafon rezonabil, de exemplu 10.000.000 lei pe mișcare, cu mesaj.
  - Rotunjire la bani (vezi QA-02).
  - `min-width: 0` și `overflow-wrap:anywhere` pe `.bf-plan-header-stat b`.
- **Efort:** S.

### QA-09 — P2 — Un registru stricat cu tipuri greșite blochează aplicația la pornire
- **Pași:** în `buget-familie:app-data-v6` (și în IDB), o sursă cu `name: 123` sau un membru cu `name: {…}`. Asta poate veni dintr-un backup editat de mână, dintr-un export vechi sau de la alt telefon.
- **Obținut:** ecranul ErrorBoundary „A apărut o eroare neașteptată”, cu `TypeError: source.name.toLowerCase is not a function` (`t4-corrupt.mjs`). Ecranul recomandă „Setări → exportă backup”, dar la Setări nu se mai poate ajunge. Butonul „Eliberează cache” șterge doar LS, iar IDB are aceeași copie. La import din Setări apare mesajul tehnic englezesc, fără nicio explicație pentru om.
- **Ce merge:** JSON trunchiat, `[]`, `null`, date imposibile, sume „abc”/„1e400” și rânduri `null` sunt tratate fără eroare.
- **Cauză:** `client/src/lib/finance-data.ts:441-452`. `name: member.name || …` păstrează orice valoare truthy. Hydrate-ul (`usePersistAppData.ts:58`) nu are try/catch în jurul `normalizeAppData`.
- **Reparare:**
  - `String(...)` pe toate câmpurile text în normalizare: nume, titluri, categorii.
  - try/catch în hydrate, cu cădere pe cealaltă copie (LS ↔ IDB).
  - În ErrorBoundary, un buton „Descarcă datele brute” care citește IDB și salvează JSON-ul.
- **Efort:** S.

### QA-10 — P2 — Două file deschise (PWA sau browser) își suprascriu una alteia mișcările
- **Pași:** aceeași aplicație deschisă în două file. În fila 1 notezi 11 lei, în fila 2 notezi 22 lei.
- **Obținut:** registrul are doar 22 (`t11-tabs.mjs`: `[22, 5200, 230.5]`). Cheltuiala de 11 lei s-a pierdut fără niciun semn, pentru că fiecare filă scrie starea ei întreagă.
- **Cauză:** lipsește coordonarea între file: fără `storage` event, `BroadcastChannel` sau Web Locks.
- **Reparare:** `BroadcastChannel("buget-familie")`. La un mesaj de salvare din altă filă, fila reîncarcă din IDB și reaplică unirea existentă (`mergeCollection`). Variantă minimă: banner „Aplicația e deschisă în altă filă”. Nu afectează APK-ul, care rulează o singură instanță.
- **Efort:** M.

### QA-11 — P3 — Export CSV: formula injection
- **Ce se întâmplă:** titlurile vin și din extrase bancare importate, deci din texte controlate de comercianți. Un titlu care începe cu `=`, `+`, `-` sau `@` este executat ca formulă în Excel sau LibreOffice (de exemplu `=HYPERLINK(…)`).
- **Cauză:** `client/src/lib/journal-csv.ts:7` (`quote` doar dublează ghilimelele).
- **Reparare:** celula primește prefixul `'` când începe cu `= + - @ \t \r`. La fel în `allocation-history.ts`.
- **Efort:** S.

### QA-12 — P3 — Plata datoriei salvează o copie întreagă a registrului, făcută la apăsare
- **Ce se întâmplă:** `DebtPaymentForm.pay` (`client/src/pages/GoalForms.tsx:21`) calculează `next` din `data` înainte de `await askConfirm(...)`, apoi `onSave(next)` înlocuiește **tot** registrul. Dacă între timp vine o sincronizare sau se salvează automat o scadență, acele schimbări se pierd.
- **Reparare:** `onSave((current) => recordDebtPayment(current, …) ?? current)`, adică un updater funcțional aplicat după confirmare.
- **Efort:** S.

## 3. Idei de dezvoltare (pentru QA), prioritizate

1. **Test de persistență „round-trip”** (vitest + fake-indexeddb): seed → `usePersistAppData` → hydrate. Compară câmp cu câmp, inclusiv `imageKeys`, `debtId` și `deleted`. Ar fi prins QA-01.
2. **Test de proprietăți pe sume** (fast-check): `parse(formatForInput(x)) === x` pentru orice sumă cu cel mult 2 zecimale, și `parse` pe 3 zecimale ⇒ eroare sau rotunjire. Ar fi prins QA-02.
3. **Invariante de registru** rulate după fiecare flux e2e:
   - `debt.remaining == total − Σ plăți`;
   - nicio mișcare cu id din `deleted`;
   - id-uri unice (acum duplicatele trec de normalizare și dau avertisment React „two children with the same key”, `t4-corrupt.mjs`/dupIds).
4. **e2e pentru Back pe Android** (Capacitor + emulator) și pentru exporturi pe APK.
5. În `e2e/flows`, pași pentru: ștergere scadență automată + reload, corectare plată rată, bon cu poză + reload.
6. Scriptul `scratchpad/audit/axe.mjs` caută butoane vechi („Plan”, „Obligații”, „Analiză” din dock). 7 ecrane × 3 teme n-au mai fost verificate de el. Eu le-am acoperit separat (`t12-axe.mjs`), dar scriptul trebuie actualizat.

## 4. Ce e deja foarte bine

- Suitele verzi: 1104 teste unitare, fluxuri și layout e2e, tsc și eslint fără avertismente.
- Accesibilitate: axe fără încălcări pe toate ecranele principale și pe cele 3 teme. Focusul revine pe „Notează” după Esc, iar capcana de focus din modal ține (40 de Tab-uri, 0 ieșiri). Dublu-click pe „Salvează” nu dublează mișcarea, pentru că id-ul captării e stabil.
- Robustețe la date stricate: JSON trunchiat, `null`, rânduri `null`, date imposibile și sume text nu dărâmă aplicația. Excepțiile sunt cele de la QA-09.
- 3.000 de mișcări la 320–1280 px, fără overflow orizontal și fără erori în consolă sau în rețea.
- Datele calendaristice sunt tratate atent: amiază UTC în `calendar-budget.ts`, scadența din ziua 31 limitată corect în februarie și în anii bisecți. BF-09 (dedublare import) și BF-13 (ziua 31) din auditul anterior sunt reparate.

## Notă

Fișierele `base.mjs`, `probe.mjs` și `seed.mjs` din rădăcina repo-ului (create la 15:11, neversionate) **nu sunt ale mele** și nu le-am atins. Scripturile mele sunt doar în `scratchpad/agenti/qa/`.
