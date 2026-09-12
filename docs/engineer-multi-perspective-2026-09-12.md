# Evaluare multi-perspectivă — ingineri specialiști (produs + codebase)

**Data:** 12 septembrie 2026  
**Baseline:** `main` @ `d33bacf` (a11y/i18n filtre Mișcări ≥48dp; wrap TodayBrief; copy reamintiri WorkManager; pe lanț: colaps Astăzi, trust line Sync, hydrate LS↔IDB cu `chooseFresher` / `resolveHydrateMerge`, App Check ready / Enforce oprit)  
**Metodă:** **evaluare expert-sintetică**, **NU sondaj real**. Opt persona-uri de **specialist software engineers** „review-uiesc” Buget Familie ca produs + codebase în 30–90s pe domeniu, ancorate în fișiere reale: `family-crypto.ts`, `realtime-sync.ts`, `app-storage.ts`, `firestore.rules`, `finance-data.ts`, hydrate din `Home.tsx`, `MainActivity.java` / widget / WorkManager, `firebase-config.ts` App Check. Continuă `user-multi-perspective-2026-09-12.md` + `audit-dual-lens-2026-09-12.md` (unele P0 din dual-lens sunt deja atenuate pe `d33bacf` — notăm diferența).

**Constrângeri produs (și pe care le respectă review-ul):** fără bank scraping, fără Notification Listener, fără Play Billing live; local-first; sync opțional AES-GCM cu parolă ≥12; App Check în Monitor, nu Enforce.

---

## Persona-uri (8)

### 1. Senior React / PWA engineer (perf, state, storage)

**Cine e:** 10+ ani React/WebView; a văzut PWA-uri care „mor” pe mid-range Android din CSS + state monolitic. Lentila: first paint, re-render, dual storage, code-split.

**30–90s review lens:** Deschide `main.tsx` (CSS eager), `Home.tsx` (~754 linii: hydrate + persist 280ms + warm Plan/secondary la 250ms + reminders), `app-storage.ts` (`chooseFresherAppData` / `resolveHydrateMerge` / `safeSetItem` + IDB envelope `__bf:1`).

**Ce găsesc greșit**
- **Critical CSS încă greu:** zeci de importuri CSS pe first paint; ~83 foi, mii de `!important` — pe WebView Capacitor costul e parse + style recalc, nu HTTP. Dual-lens a semnalat ~12k linii / ~2.8k `!important`; driftul în sus rămâne pe radar.
- **Un `setData` = recalcul mare:** planMath, semnale, ritm, sync debounce, reminders — fără context/selector split. Acceptabil la zeci de mișcări; riscant la mii (jurnalul e paginat 30 zile — bine).
- **Persist dual LS+IDB cu debounce 280ms:** modelul e acum corect pe hârtie (`editedBeforeHydrate`, hash, stampă), dar orice bug în `syncPortable` / normalize poate diverja cache-ul LS de IDB; LS pe quota plină rămâne doar meta — first paint fără snapshot greu e mai lent.
- **Warm navigare la 250ms** pe 4G consumă radio înainte ca utilizatorul să tap-uiască Plan.

**Ce sugerează**
- CSS core (`index` + `household-os-*` + `contrast-fix` + polish) pe critical path; restul lângă `lazy()` pe ecran.
- Extrage `useFamilySync` / `usePersistAppData` / `useThemeChrome` (theme deja extras) — Home rămâne orchestrator, nu god-component.
- Măsoară LCP/INP pe WebView mid-range (nu doar Lighthouse Chrome desktop); țintă: first interactive captura <2s pe mid-range.

**Ce și-ar mai dori**
- **Tech:** React Query / store atomic doar pe slice-uri financiare; virtualizare jurnal când >N; Service Worker versionat din `app-version` (nu hardcod `sw.js?v=`).
- **Produs:** skeleton Astăzi care arată *un* număr înainte de hydrate IDB, fără flicker 0→valoare.

---

### 2. Mobile / Android + Play engineer (Capacitor, widget, WorkManager, Play)

**Cine e:** A publicat AAB-uri; cunoaște PendingIntent pe API 31+, OEM battery kill pe WorkManager, Data safety / allowBackup.

**30–90s review lens:** `MainActivity.java` (QuickActionBridge `consume()` o dată; ReminderBridge; safe-area inject), `QuickAddWidgetProvider` (fără sume; până la 3 șabloane etichetă), `ReminderScheduler` (OneTime, unique work, max 6, orizont 14 zile), `AndroidManifest` `allowBackup=false`, `PLAY_CHECKLIST.md` — **0 bife hardware**.

**Ce găsesc greșit**
- **PLAY_CHECKLIST nebifat** = widget/dală/WorkManager/pairing rămân „teoretice” pentru magazin. Fără telefon, CI nu poate valida Intent când app e în fundal.
- **`consume()` one-shot:** dacă JS poll-uiește târziu sau WebView e deja up, trebuie confirmat că `observeQuickActions` nu pierde `onNewIntent` — clasic Capacitor race.
- **WorkManager OneTime ≤14 zile:** corect anti-spam; dar facturile lunare >14z nu primesc reminder fără re-open app (documentat implicit, ușor de uitat în listing).
- **Bridge JSInterface:** doar acțiuni + etichete șablon — bine (fără sume pe widget). Payload reminder JSON din WebView: invalid → swallow — ok, dar fără telemetrie e greu de diagnosticat pe device.

**Ce sugerează**
- Închide `PLAY_CHECKLIST` pe un Pixel/Samsung mid-range înainte de AAB: widget Cheltuială/Bon/titlu, app-in-background intent, 3 șabloane, dală, canal notificări, pairing 12 caractere.
- Documentează în listing: „reamintiri pe orizont scurt (≤14 zile); la deschiderea app se reprogramează”.
- Play Integrity provider pe Android când treci pe closed testing (lângă reCAPTCHA web) — vezi persona Firebase.

**Ce și-ar mai dori**
- **Tech:** instrumentare debug (logcat tag `BF-QuickAction` / `BF-Reminder`) doar pe debug builds; test Espresso/Macrobenchmark opțional pentru cold start.
- **Produs:** widget care deschide captura în <1s pe mid-range; Data safety 1:1 cu `allowBackup=false` + sync criptat.

---

### 3. Security / privacy engineer (E2E sync, App Check, secrets, XSS)

**Cine e:** Threat-model pe sync „password = room”; App Check; XSS pe ledger; secrets în client.

**30–90s review lens:** `family-crypto` (PBKDF2 250k → AES-GCM; shareable strip pe pendingReview/images/templates/FX/merchantRules), `deriveFamilyRoomId` (`SHA-256("buget-familie-room:"+secret)`), `firestore.rules` (`get` nu `list`; `create/update` nu `delete`; salt 24 / iv 16 / ciphertext <2MB), `firebase-config` (apiKey public OK; site key Enterprise în bundle; Enforce oprit), scan `dangerouslySetInnerHTML` / `innerHTML` — **gol** pe `client/src`.

**Ce găsesc greșit**
- **Knowledge-of-password = full write pe cameră:** rules nu autentifică user Firebase — by design. Cine știe parola poate `update` envelope (nu `delete` — bine). Nu e „E2E cu identity”; e „E2E cu secret shared”. Trebuie copy onest (deja pe Sync / trust line).
- **Room ID = hash(parolă):** offline brute-force pe ID-uri ghicit e greu (64 hex), dar parola slabă (<12) ar reduce spațiul — UI cere ≥12 + generator; bine.
- **App Check ready, Enforce Monitor:** corect; metrics pe release încă pe checklist. Enforce prematur = outage familii.
- **apiKey + site key în client:** normal Firebase; riscul e abuz de cotă Firestore, nu leak ledger (ciphertext). Fără Enforce, un client modificat poate scrie envelope-uri valide către camere cunoscute.

**Ce sugerează**
- Păstrează **Monitor** până metrics verzi pe Pages + AAB (`docs/app-check-enforce-prep.md`).
- Audit public scurt: „ce e în pachetul criptat / ce nu” (alineat shareable din `encryptFamilyData`) — deja parțial în UI Sync.
- Continuă zero `innerHTML` pe date user; CSV/OCR → text nodes / React children only.

**Ce și-ar mai dori**
- **Tech:** rate-limit / App Check Enforce pe Firestore *după* metrics; opțional salt pe room derivation pe v2 envelope (migrație grea — nu acum); secret scanning CI pe PAT-uri lipite în chat/docs.
- **Produs:** export total + ștergere demonstrată; mod „doar offline” care nu încarcă Firebase chunk.

---

### 4. Distributed systems / sync engineer (CRDT/LWW, conflicts, offline)

**Cine e:** A construit sync offline-first; știe că „un document criptat” ≠ CRDT.

**30–90s review lens:** `pushFamilyEnvelope` = `setDoc` pe un singur doc; `subscribeFamilyRoom` ignoră `hasPendingWrites`; `mergeFamilyData` — colecții pe id + tombstones; **plicuri** și **mișcări materiale** cu conflict UI (nu LWW tăcut pe bani); plan scalars LWW pe stampă; settings preferințe locale rămân pe telefon.

**Ce găsesc greșit**
- **Nu e CRDT:** un blob AES pe cameră ⇒ last writer wins la nivel de *document*, apoi merge client-side la decrypt. Două push-uri aproape simultane: al doilea ciphertext câștigă pe Firestore; merge-ul pe receptor repară colecțiile *dacă* ambele părți au văzut celălalt snapshot — race clasică „push fără pull recent”.
- **Conflict pe plic/tx e local-preferring** la detectare (`allocations.push(localItem)`): corect UX pe telefonul curent; partenerul vede conflict doar după ce primește push-ul — OK dacă UI e vizibil.
- **pendingReview nu se sync** (anti-zombie) + meta remote: decizie bună; cuplul o citește ca „sync stricat” dacă UI nu e imposibil de ratat.
- **Parola nu e persistată:** reconnect la fiecare sesiune — bun pentru privacy, rău pentru „sync mereu on” pe telefonul 2 lăsat deblocat.

**Ce sugerează**
- Înainte de push: fetch+merge obligatoriu (dacă nu e deja în hook) + backoff pe `unavailable`.
- Vector clock / `updatedAt` pe envelope pe lângă `serverTimestamp` pentru a detecta „am suprascris un remote mai nou” și a forța re-merge.
- Nu promite CRDT în listing — spune „unire pe telefon, conflict pe bani”.

**Ce și-ar mai dori**
- **Tech:** operații pe colecții (tx op-log) în loc de full-document rewrite — v2 mare; până atunci envelope size budget + compresie.
- **Produs:** banner conflict pe Astăzi (nu doar Plan); jurnal sync (`SYNC_JOURNAL_KEY`) vizibil userului power.

---

### 5. Fintech / ledger engineer (double-entry, envelopes, idempotency, money rounding)

**Cine e:** A văzut ledger-e bancare; se uită la invarianti, rotunjiri, idempotency la import CSV / debt payment.

**30–90s review lens:** `finance-data.ts` (~1284 linii): `sourceBalance` = opening ± tx (nu double-entry); plic = **limită** + transfers (`allocationBudget` / `allocationSpent`); `roundedMoney` / `roundSigned` la 2 zecimale; `parseRomanianAmount`; debt payment creează tx + update remaining; De verificat / dedupe CSV (critical-flows).

**Ce găsesc greșit**
- **Nu e double-entry:** un singur jurnal + sold sursă derivat. Corect pentru household app; greșit dacă cineva așteaptă conturi T. Documentează invariantul: sum(source balances) ≠ sum(envelope remaining).
- **Plic ≠ cont:** transfers între plicuri nu mișcă bani pe sursă — model YNAB-like. UI trebuie să o spună pe first tap (glosar există pe lanțul recent).
- **Rotunjiri:** majoritatea fluxurilor folosesc `*100/100`; hero/pulse încă pot arăta `Math.round` lei întregi pe unele grafice (`3k`) — UX ok, audit trail pe bani trebuie să rămână la bani.
- **Idempotency:** CSV dedupe + review gate sunt bune; `autoPostDueRecurring` la `storageReady` — risc dublu-post dacă clock/timezone + reinstall fără tombstone clar (de verificat pe teste recurring).
- **FX:** `exchangeRates` locale, excluse din sync — două telefoane pot calcula `sourceBalance` diferit pe aceeași sursă multi-currency.

**Ce sugerează**
- Invariant tests: după orice mutator (add tx, transfer plic, debt pay, confirm review) — balances deterministic.
- O funcție unică `money2(n)` folosită peste tot (inclusiv UI hero dacă vrei bani, nu doar grafice).
- La sync: fie exclude soldurile derivate (deja — se recalculează), fie sync FX rates dacă multi-currency devine first-class.

**Ce și-ar mai dori**
- **Tech:** `clientRequestId` pe tx din CSV/OCR pentru idempotency cross-device; allocation history ca event log append-only (deja parțial).
- **Produs:** „De ce poți folosi X” (SafeSpendSheet) ca *singura* cifră de decizie — aliniat colapsului Astăzi de pe `29b683d`.

---

### 6. QA / reliability engineer (tests, quota, hydrate races)

**Cine e:** Vitest + device lab; vânează curse și „works on my machine”.

**30–90s review lens:** `docs/testing.md`, ~44 fișiere `*.test.ts` (family-crypto, app-storage hydrate, critical-flows, finance-data, i18n-coverage…); `safeSetItem` + UI notice pe quota; `PLAY_CHECKLIST` hardware; Lighthouse doc.

**Ce găsesc greșit**
- **Hydrate race:** dual-lens P0 e **atenuat** pe `d33bacf` (`chooseFresherAppData`, `resolveHydrateMerge`, teste în `app-storage.test.ts` + `critical-flows`). Rămâne risc de regresie dacă cineva scrie din nou `if (idb) setData(idb)` fără merge.
- **Quota:** LS poate pierde snapshot; IDB e primar — bine. Lipsește test de stres „100 bonuri cu imageKeys” pe WebView real (IDB + Filesystem).
- **Gap device:** widget / dală / WorkManager / App Check metrics — **zero automatizare**; checklist manual nebifat = blind spot release.
- **i18n-coverage test** există; texte hardcodate pe Home încă pot scăpa dacă nu trec prin `t()`.

**Ce sugerează**
- Gate de release: `pnpm test && pnpm check` + **PLAY_CHECKLIST semnat** (screenshot/log) înainte de tag Play.
- Test de cursă: editează înainte de `storageReady` (deja în critical-flows) + kill app la 100–280ms după tap (manual).
- Quota chaos: mock `QuotaExceededError` pe LS în CI (dacă nu e deja complet).

**Ce și-ar mai dori**
- **Tech:** smoke Playwright pe Pages (captură + Astăzi un număr); Android instrumentation pe QuickAction intent.
- **Produs:** empty-states + recovery UI pe „stocare plină” / „sync unavailable” — copy deja parțial.

---

### 7. Staff frontend / design systems (a11y, CSS debt, i18n)

**Cine e:** Design system lead; se uită la contrast, ținte tactile, densitate, tokeni, `t()`.

**30–90s review lens:** teme slim white/dark/aurora/navy/cyber; `contrast-fix.css` ultimul; commit `d33bacf` (filtre Mișcări ≥48dp, wrap TodayBrief); dual-lens densitate Astăzi / Mai mult; i18n.

**Ce găsesc greșit**
- **CSS debt:** multe passe istorice (`atelier-*`, `ledger-*`, `workbench-*`) încă pe critical path — conflict de specificitate; fix în `index.css` moare sub `!important`.
- **a11y:** ≥48dp pe filtre e progres; grafice pe culoare+înălțime; ritm `3k` fără „lei” pe unele locuri; contrast filled pe Aurora/Navy/Cyber încă pe lista dual-lens (Alb reparat istoric).
- **i18n:** `t()` + test coverage; stringuri UI rămase fără cheie = „app neterminată” pentru RO-only users când EN e parțial.
- **Densitate Mai mult (~13 taburi):** problemă de IA informațională, nu doar CSS.

**Ce sugerează**
- Token audit: o scară de spațiu/tip pe `household-os-*`; șterge CSS mort (2-line files).
- Contrast 4,5:1 pe filled pentru toate cele 5 teme; focus visible pe dock + sheets.
- Glosar „plic / sursă / reper” la first paint (mod simplu pe lanțul `cbd7777`).

**Ce și-ar mai dori**
- **Tech:** Storybook sau pagină `/dev/themes` cu matrice contrast; lint `no-hardcoded-ui-strings` pe `pages/`.
- **Produs:** Mod Simplu = 3 ecrane; dock neschimbat (5 taburi e solid).

---

### 8. Firebase / backend engineer (rules, App Check Enforce) — opțional

**Cine e:** Firebase admin; rules unit tests; App Check metrics; cost/abuse.

**30–90s review lens:** `firestore.rules` (roomId size 64; keysOnly envelope; no list/delete), `realtime-sync.ts` (`ReCaptchaEnterpriseProvider`, sync fără cheie tot merge), `app-check-enforce-prep.md`.

**Ce găsesc greșit**
- **Rules fără Auth:** cameră = secret. Acceptabil cu ciphertext + no list; abuse = write spam pe roomId cunoscut sau probe pe hash space (scump).
- **Enforce oprit:** corect operațional; metrics checklist nebifat.
- **setDoc full document:** cost/latency OK la envelope mic; la 2MB limit rules — aproape de plafon dacă cineva bagă prea mult în shareable din greșeală.
- **Fără rules tests automate** în CI (emulator) — regresie pe `salt.size()==24` ar rupe toate sync-urile (family-crypto.test menționează potrivirea — bine).

**Ce sugerează**
- Emulator rules test: get/create/update allow; list/delete deny; payload invalid deny.
- Metrics 7 zile pe build store → apoi Enforce.
- Alert pe dimensiune envelope (client-side) înainte de push.

**Ce și-ar mai dori**
- **Tech:** Play Integrity pe Android app în Firebase App Check; buget cost Firestore pe proiect.
- **Produs:** zero impact user la Enforce când metrics sunt verzi — sync „pur și simplu merge”.

---

## Top 10 probleme comune (tech × product)

Scor relativ din overlap persona-uri + dual-lens + cod la `d33bacf` (nu din survey).

| # | Problemă | De ce doare (tech × product) | F × G |
|---|---|---|---|
| 1 | **PLAY_CHECKLIST / hardware nebifat** (widget, dală, WorkManager, pairing pe device) | APK „gata de magazin” fără probe → review 1★ pe captură | ★★★★★ |
| 2 | **CSS critical path + !important debt** | Mid-range WebView lent; contrast greu de reparat | ★★★★★ |
| 3 | **Sync = full-document ciphertext, nu CRDT** + așteptări „totul e comun” | Cuplu crede că poze/De verificat/șabloane sunt pe ambele telefoane | ★★★★★ |
| 4 | **Knowledge-of-password = write** (rules fără Auth) + App Check încă Monitor | Abuse/cota; Enforce prematur = outage | ★★★★☆ |
| 5 | **Home monolitic + setData global** | Perf + cost de schimbare; bug-uri de efecte în cascade | ★★★★☆ |
| 6 | **Ledger single-entry + plic=limită** (corect) vs mental model „mută bani” | Support load; neîncredere în cifre | ★★★★☆ |
| 7 | **Hydrate/quota** — atenuat, dar regresie ușoară | Pierdere date = moarte produs local-first | ★★★★☆ |
| 8 | **FX / merchantRules / templates out of sync** | Solduri sau reguli diverg pe 2 telefoane | ★★★☆☆ |
| 9 | **a11y/i18n resturi** (teme dark filled, stringuri fără `t()`) | Accesibilitate + senzație „neterminat” | ★★★☆☆ |
| 10 | **WorkManager orizont 14z + reprogramare la open** | Facturi lunare fără reminder dacă app nu se deschide | ★★☆☆☆ |

**Notă vs dual-lens:** skip-tur=skip-setup și hydrate „IDB if any” erau P0; pe `d33bacf` + commits recente (trust/Sync/Astăzi/hydrate tests) multe sunt **atenuări** — nu le redeschide ca bug-uri active fără a re-verifica codul.

---

## Top 10 dorințe / îmbunătățiri

| # | Dorință | Surse (persona) | Potrivire |
|---|---|---|---|
| 1 | **Închide PLAY_CHECKLIST pe telefon real** | Mobile, QA, Firebase | Blocant magazin, nu feature |
| 2 | **CSS core + lazy pe ecran** | React/PWA, Staff FE | Perf Play |
| 3 | **App Check metrics → Enforce când verde** | Security, Firebase | Anti-abuz fără a bloca familiile |
| 4 | **Fetch+merge înainte de push + conflict pe Astăzi** | Sync, Fintech | Încredere cuplu |
| 5 | **Invariant / money2 tests pe mutatori** | Fintech, QA | Regresie zero pe bani |
| 6 | **Split Home (sync/persist/theme)** | React/PWA | Viteza de livrare |
| 7 | **Contrast filled pe Aurora/Navy/Cyber + ținte ≥48dp peste tot** | Staff FE | a11y |
| 8 | **Rules emulator tests în CI** | Firebase, Security | Regresie sync |
| 9 | **Telemetrie debug nativă (opt-in) pentru widget/reminder** | Mobile, QA | Diagnostic fără a expune sume |
| 10 | **Mod offline care nu încarcă Firebase** | Security, PWA | Promisiune local-first |

**Explicit OUT acum:** Open Banking, Notification Listener, Play Billing live, CRDT full rewrite, double-entry accounting UI.

---

## Ce e deja solid (nu strica)

1. **Local-first + AES-GCM** (PBKDF2 250k, parolă nepersistată, shareable fără imagini/pendingReview) — `family-crypto.ts`.
2. **Conflict UI pe sumă plic și pe mișcări materiale** — nu LWW tăcut pe bani; undo pe alegere.
3. **firestore.rules** stricte: `get`≠`list`, `create/update`≠`delete`, shape envelope + lungimi salt/iv.
4. **Hydrate merge** `chooseFresherAppData` / `resolveHydrateMerge` + teste — IDB primar, LS cache, quota → meta.
5. **Widget fără sume** + șabloane etichetă; `allowBackup=false`.
6. **De verificat** (bon/CSV → confirm → registru) + dedupe — diferențiator încredere.
7. **Model plic = limită pe ciclu salarial** + SafeSpendSheet / ritm — adâncime peste media Play.
8. **App Check wired, Enforce oprit** + doc de pregătire — operațional corect.
9. **Dock 5 taburi**; abonamente amânate; backup nativ Filesystem+Share cu outcome onest.
10. **Suita Vitest** pe crypto, storage, critical flows, finance — păstrează gate-ul `pnpm test`.

---

## Recomandare: fix vs feature vs Play / monetizare

### A) Fix acum (înainte de feature și paywall)

1. **Execută și bifează `PLAY_CHECKLIST.md`** pe device (widget, dală, intent background, WorkManager, pairing, conflict).  
2. **Nu regresă hydrate/quota** — orice touch pe `app-storage` / persist Home cere teste `chooseFresher` / `resolveHydrateMerge`.  
3. **Taie CSS critical** + lazy pe ecrane; păstrează `contrast-fix` ultimul.  
4. **Copy sync onest** (ce nu se sync) vizibil la pairing — deja pe lanț; verifică că FirstRun Familie deschide Sync.  
5. **Contrast filled** pe temele de noapte; ținte tactile pe controalele rămase.  
6. **App Check metrics** pe build release; **nu** Enforce.  
7. **Invariant money** pe mutatori cheie + o singură politică de rotunjire la 2 zecimale în ledger.

### B) Feature (după fix-uri de fiabilitate / claritate)

- Feed conflict + activitate familie pe Astăzi.  
- Fetch+merge hardening / envelope `updatedAt` client.  
- Reminder re-schedule strategy documentată; opțional periodic refresh când OS permite.  
- Mod offline fără chunk Firebase.  
- Rules tests în emulator CI.

### C) Play / monetizare — **nu acum**

**Play:** AAB abia după checklist hardware + Data safety aliniat + listing = teme/realitate.  
**Monetizare:** la fel ca în evaluarea user — după Astăzi clar, Sync găsibil, captură măsurată, zero incidente „am pierdut datele”. Freemium fără ads pe ecrane financiare; **nu** paywall pe jurnalul local.

**Semnal „gata” pentru ingineri:** PLAY_CHECKLIST semnat; metrics App Check verzi; sync 2 device 14 zile fără pierdere; LCP/captură acceptabile pe mid-range; `pnpm test` verde pe hydrate+crypto+finance.

---

## Anexă — fișiere citite (ancoră)

| Zonă | Fișiere |
|---|---|
| Crypto / merge | `client/src/lib/family-crypto.ts`, `family-crypto.test.ts` |
| Sync transport | `client/src/lib/realtime-sync.ts` |
| Storage / hydrate | `client/src/lib/app-storage.ts`, `Home.tsx` (effect hydrate/persist), `app-storage.test.ts`, `critical-flows.test.ts` |
| Rules / App Check | `firestore.rules`, `client/src/lib/firebase-config.ts`, `docs/app-check-enforce-prep.md` |
| Ledger | `client/src/lib/finance-data.ts` |
| Android | `MainActivity.java`, `QuickAddWidgetProvider.java`, `ReminderScheduler.java`, `PLAY_CHECKLIST.md` |
| Continuity | `docs/user-multi-perspective-2026-09-12.md`, `docs/audit-dual-lens-2026-09-12.md` |

---

## Disclaimer final

Acest document este **evaluare expert-sintetică** (persona-uri de ingineri specialiști), **nu** rezultatul unui sondaj sau al unui audit de firmă externă. Afirmațiile sunt ancorate în codebase-ul de la data/commit-ul de mai sus. Pentru validare: device lab pe PLAY_CHECKLIST + 1 review extern pe rules/App Check înainte de Enforce.
