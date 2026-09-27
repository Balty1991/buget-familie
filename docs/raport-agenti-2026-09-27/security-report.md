# Buget Familie: audit de securitate și confidențialitate, runda a treia (27.09.2026)

Commit auditat: `5b63e2a` (v1.1.96). Metodă: am citit codul (client, `functions/src/index.ts`, cele trei fișiere de reguli, Android, `sw.js`, workflow-uri, politica și Data safety). Am rulat `pnpm audit` și `npm audit` (în `functions/`).

Pe **emulator** (`firebase.e2e.json`, reguli `firestore.chain.rules`) am rulat 50 de sonde de reguli. Scriptul și rezultatul sunt în `scratchpad/agenti3/security/rules-probe.mjs` și `rules-probe.out`. O demonstrație WebCrypto (Node) e în `nonextractable-demo.mjs` / `.out`.

**Nu am atins Firebase de producție**, nu am apelat funcțiile publicate și nu am modificat nimic în repo în afară de acest fișier. Instalarea Chromium pentru o probă în browser a fost blocată de proxy, deci otrăvirea cache-ului (S1) e argumentată din cod și din specificația Cache API, nu rulată.

---

## 1. Pe scurt

Aproape tot ce am cerut pe 26.09 s-a făcut, și bine:
- CSP-ul are acum căi exacte;
- regulile au tipuri, `request.time` și 950 KB;
- `familyRecovery` e doar `create`;
- `playRtdn` cere contul exact;
- ghidul AI scrie doar la „da”;
- `FLAG_SECURE` pe Android vechi;
- invitația-capcană întreabă;
- politica numește jsDelivr și Open Food Facts.

Toate cele 13 sonde vechi pe lanț dau același rezultat corect, iar sondele noi pe tipuri și mărime (B1–B6) refuză ce trebuie.

Ce rămâne sunt trei probleme de fond (P2), care nu se văd din interfață:
1. **Pe web, reparația S5 e doar cosmetică.** Codul invitației nu mai stă în IndexedDB, dar `CryptoKey`-ul „neexportabil” de acolo se poate folosi de orice pagină de pe `balty1991.github.io` ca să derive o cheie **exportabilă** (demonstrat). În plus, service worker-ul servește fișierele JS din Cache Storage, pe care orice pagină de pe aceeași origine le poate înlocui.
2. **Revocarea se poate anula de cel revocat.** Pe emulator, un telefon cu cheia veche rescrie camera veche peste pachetul „s-a mutat” și continuă nelimitat (D1–D3). Telefoanele familiei care n-au apucat să primească invitația nouă se întorc la reluare în camera veche, cu el.
3. **CI-ul de producție** rulează `npx firebase-tools@15.31.0`: versiunea e fixă, dar cele câteva sute de dependențe tranzitive nu sunt legate de lockfile. În jobul de reguli, `pnpm install` și testele rulează în același job cu credențialul de admin.

**Notă globală: 8/10** (față de 7,5/10 pe 26.09). Nimic P0/P1; lansarea testării închise nu e blocată. Cele trei P2 trebuie închise înainte de producție, iar S1 înainte să promovați varianta web.

Pe priorități: **P0: 0 · P1: 0 · P2: 3 · P3: 11.**

---

## 2. Ce s-a confirmat reparat (S1–S16 din 26.09)

| # (26.09) | Verdict | Dovada |
|---|---|---|
| S1 CSP jsDelivr | **Reparat** | `vite.config.ts:85-104`: `script-src` doar `tesseract.js@v<ver>/` și `tesseract.js-core@v<ver>/`, `img-src` fără `https:`, `connect-src` pe domenii exacte. Rămân `frame-src https://*.firebaseapp.com` (orice proiect Firebase) și `connect-src https://firestore.googleapis.com` (orice proiect): la un XSS, un canal de exfiltrare. Inerent, P3, nu mai revin |
| S2 cod de pe CDN, destinatari | **Reparat (declarat)** | privacy §10, DS §4; Open Food Facts doar la buton (`ProductCatalogPanel.tsx:252`). OCR-ul tot de pe jsDelivr, fără SRI, și în APK fără CSP. Autogăzduirea rămâne recomandată |
| S3 plafon AI | **Parțial** | IPv6 /64 (`index.ts:563-567`), shard-uri, plafon separat pentru cererile fără App Check (`:653-655`). Vezi S4 nou |
| S4 revocare | **Parțial** | Revocarea propune „Mută familia” (`useFamilySync.ts:665`), iar „mutat” nu mai șterge sesiunea (`:211-225`). Cel revocat poate anula mutarea: S2 nou |
| S5 origine comună | **Neînchis** | Codul invitației nu se mai păstrează pe web (`:54`, `:400`), dar cheia rămâne folosibilă: S1 nou |
| S6 CI | **Parțial** | Acțiunile sunt fixate pe SHA, Dependabot e activ, `packageManager: pnpm@10.34.5`, `npm ci --ignore-scripts` în functions. Rămân `npx` fără lockfile și jobul comun: S3 nou |
| S7 AI scrie fără confirmare | **Reparat**, cu un rest | `AICompanion.tsx:703-706`. Rest: S10 nou |
| S8 `familyRecovery` suprascris | **Reparat pe reguli** | Sondele F2/F3/F4 dau DENY. Codul tot nu se poate roti pe camerele cu invitație: S7 nou |
| S9 reguli, tipuri | **Reparat** | B1–B6 corecte. Abuzul de stocare rămâne: S6 nou |
| S10 camere cu parolă | **Parțial** | Îndemn la fiecare intrare (`useFamilySync.ts:353-356`). Ocuparea camerei fără lanț, pe emulator: S8 nou |
| S11 `playRtdn` | **Reparat** | `index.ts:856-861`: fără `PLAY_RTDN_SERVICE_ACCOUNT` cererea e refuzată; plafonul se consumă doar după autentificare |
| S12 `verifyPlayPurchase` | **Reparat**, cu un rest | `appAccountToken = sha256("bf-room:"+room)` (`billing.ts:46,66`) verificat pe server (`index.ts:781-783`). Rest: S11 nou |
| S13 ecran, notificări | **Reparat** | `MainActivity.java:185-204` (`FLAG_SECURE` în `onPause` sub API 33); `ReminderWorker.java:80-81` (`VISIBILITY_PRIVATE` + `setPublicVersion`) |
| S14 invitație-capcană | **Reparat** | `useFamilySync.ts:437-440` acoperă scadențe, venituri, evenimente, membri, solduri |
| S15 server de dezvoltare, dependențe | **Parțial** | `host: "127.0.0.1"`, fără `allowedHosts`, `preview` pe 127.0.0.1. Dependențele de dezvoltare sunt neschimbate: S12 nou |
| S16 politică / DS | **Reparat** | Cheia împachetată cu codul de recuperare e declarată (privacy §2, DS §3); `appFeedbackQuota` și cozile noi au TTL (`deploy-firebase-functions.yml:122`); fluxul „Revocă + Mută” e în DS |

Fără schimbări, în continuare corecte:
- `pnpm audit --prod`: 0;
- `functions` `npm audit --omit=dev`: 0;
- nicio sursă `dangerouslySetInnerHTML`, `innerHTML` sau `eval`;
- `intent://…;package=ro.balty1991.bugetfamilie` la „Deschide în aplicație”, deci invitația nu poate fi interceptată de altă aplicație cu aceeași schemă;
- colecțiile de server sunt închise pentru client (G3: 14/14 DENY).

---

## 3. Constatări (runda 27.09)

### S1. [P2] Web: cheia camerei rămâne la îndemâna oricărei pagini de pe `balty1991.github.io` (S5 rămas deschis)

- **Scenariul.** Utilizatorul a intrat în familie din browser (linkul de invitație deschide chiar varianta web). Mai târziu deschide o pagină de pe aceeași origine: alt proiect GitHub Pages al proprietarului, o dependență compromisă a unuia dintre ele sau un PR publicat. Proprietarul are încă 8 depozite publice (VEYRA, BETPREDICT, Predictii-Pro, New, Lumin-Culler, BETPREDICT-LAB, BetAnalyticsPro, RoBet); oricare are Pages pornit servește pe aceeași origine. Pagina poate face oricare din atacurile de mai jos.
  1. **Citește și exportă cheia.** Deschide IndexedDB `buget-familie-sync`, ia `{roomId, material}` (`family-session.ts:61-66`) și derivă din `material`, cu PBKDF2, o cheie AES și cheia HMAC a lanțului, ambele cu `extractable: true`. Apoi le exportă. `material.extractable = false` nu oprește asta, fiindcă limitează doar exportul materialului, nu al cheilor derivate. **Demonstrat:** `nonextractable-demo.out`:
     ```
     material.extractable = false
     export material: refuzat ( NotSupportedError )
     cheie AES derivată, extractable = true → export: e49841be9603f6c2…
     cheie HMAC a lanțului, extractable = true → export: 9911b2db3cc85442…
     ```
     Cheia HMAC a lanțului are sare fixă (`family-crypto.ts:76`). Odată exportată, atacatorul **scrie** în cameră de oriunde, până la „Mută familia”. Cheile AES pentru sările văzute îi dau și citirea.
  2. **Citește registrul în clar** din `localStorage` (a fost mereu așa).
  3. **Otrăvește aplicația, persistent.** `sw.js:68-75` servește fișierele `assets/*-<hash>.js` **întâi din cache** (`caches.match`), iar Cache Storage e comun întregii origini. Pagina străină face `caches.open("buget-familie-shell-v91")` și `cache.put("/buget-familie/assets/index-XXXX.js", new Response(codulMeu))`. Codul ei rulează apoi în aplicație la fiecare deschidere, până la build-ul următor. Politica CSP nu-l oprește, fiindcă URL-ul e `'self'`.
- **Dovada.** `family-session.ts:18,61-66`; `useFamilySync.ts:54,400` (doar `invite` e scos); `sw.js:68-75`; demonstrația de mai sus.
- **Reparare.**
  1. **Domeniu propriu** pentru varianta web (`app.<domeniu>`), CORS-ul funcțiilor restrâns la el și linkul de invitație mutat acolo. Singura reparație completă.
  2. Până atunci: pe web, **nu păstra sesiunea** (cere invitația la fiecare deschidere, cu opțiunea „ține minte pe acest calculator”, explicată). Sau păstrează `material` doar în memorie.
  3. În `sw.js`, verifică integritatea fișierelor din cache: `precache.json` cu SHA-256 pe fișier, comparat la `match`. Alternativ, cache-uiește doar ce ai pus tu la `install` și refuză intrările necunoscute.
  4. Verifică în consolă (secțiunea 5) ce depozite au Pages pornit.
- **Efort:** M (domeniu), S (fără sesiune pe web).

### S2. [P2] Telefonul revocat anulează „Mută familia” și ține familia în camera veche

- **Scenariul.** Soțul revocat (fost partener, telefon furat, APK modificat) are cheia camerei vechi. Soția îl revocă, apasă „Mută familia”, iar camera veche primește pachetul „s-a mutat”.
  - Clientul modificat al celui revocat scrie imediat un pachet normal peste el. Lanțul îl lasă, fiindcă are cheia.
  - Telefoanele care erau offline la mutare, sau care se repornesc până primesc invitația nouă, fac la reluare `syncOpenRoom` pe camera veche. Nu mai văd „mutat”, unesc și **trimit tot registrul în camera citită de cel revocat**.
  - Invers, cel revocat (sau oricine are cheia) poate scrie un „mutat” fals. Toate telefoanele se opresc, iar „Mută familia” nu mai e disponibil, fiindcă cere `syncConnected` (`useFamilySync.ts:456`) și reluarea se oprește la „mutat” (`:300-303`). Mesajul le spune să ceară invitația de la „telefonul care a mutat-o”, care nu există.
- **Dovada (emulator):**
  ```
  OK   ALLOW   · D1 familia scrie pachetul „mutat” în camera veche (seq=4)
  OK   ALLOW   · D2 telefonul revocat (cu cheia) rescrie camera veche peste „mutat” (seq=5)
  OK   ALLOW   · D3 …și continuă nelimitat (seq=6)
  ```
- **Reparare.**
  1. **Camera sigilată în reguli.** Pachetul „mutat” scrie în clar un câmp `sealedAt == request.time`. Regula de update devine `... && !('sealedAt' in resource.data)`. O cameră sigilată nu mai poate fi scrisă de nimeni, deci „mutat” devine ireversibil. Adaugă sonda în `e2e/`.
  2. **„Mutat” autentificat.** Pachetul „mutat” poartă `HMAC(cheia veche, "moved:" + sha256(noua cameră))`. Un telefon care primește „mutat” fără invitația nouă arată „Creează o cameră nouă cu datele de aici și trimite invitația celorlalți”, nu doar „cere invitația”.
  3. Ca text: „Mută familia” trebuie făcut **înainte** ca cel revocat să afle, de pe un telefon online, iar invitația nouă trimisă imediat. Merită spus în dialogul de revocare.
- **Efort:** S (regula plus sonda), S–M (fluxul „mutat” fals).

### S3. [P2] CI de producție: dependențe tranzitive nefixate și cod terț în același job cu credențialul

- **Ce am observat.**
  - `deploy-firebase-functions.yml:130` și `deploy-firestore-rules.yml:77` rulează `npx --yes firebase-tools@15.31.0`. `npx` rezolvă singur, de pe npm, **cele câteva sute de dependențe tranzitive** ale lui `firebase-tools`, pe intervale `^`, fără lockfile și fără integritate. O versiune compromisă a oricăreia (tipul de incident npm din 2025, care fura exact credențiale de CI) rulează cu `FIREBASE_SERVICE_ACCOUNT` (cheie JSON de admin, cu viață lungă) încărcat. Aceeași versiune e deja în `pnpm-lock.yaml`.
  - În `deploy-firestore-rules.yml`, `pnpm install` (l. 47-48), instalarea Chromium și `pnpm test:sync` (l. 62, care rulează Vite, emulatorul și aplicația, adică tot arborele de dependențe) sunt **în același job** cu `google-github-actions/auth` (l. 64-68). Orice cod rulat în pașii de dinainte poate scrie în `$GITHUB_ENV`, de exemplu `NODE_OPTIONS=--require /tmp/x.js`, și astfel se injectează în pașii cu credențial.
  - Secretele keystore sunt încă interpolate în `run:` (`build-android-apk.yml:57-66`, `release-android-aab.yml:39-48`).
- **Reparare.**
  1. `pnpm exec firebase deploy …` (versiunea și integritatea din lockfile), după `pnpm install --frozen-lockfile`. Sau un `package.json` mic în `.github/deploy/` cu lockfile propriu și `npm ci --ignore-scripts`.
  2. Împarte jobul de reguli în `test` (fără secrete) și `deploy` (`needs: test`), fără `pnpm install` complet și fără cod de test.
  3. Workload Identity Federation (consolă, secțiunea 5) în loc de cheie JSON.
  4. Secretele keystore prin `env:` și `printf '%s' "$KEYSTORE_B64"`.
- **Efort:** S.

### S4. [P3] Ghidul AI: plafonul fără App Check se golește dintr-un singur IP; tokenul App Check se refolosește

- **Ce am observat** (`functions/src/index.ts:639-660`).
  - Fără App Check, cu uid anonim (gratuit): 60 de cereri pe oră pe IP (12 × 5). Plafonul zilnic „neverificat” e de 600 (3.000 / 5). **Un IP îl golește în 10 ore, zece IP-uri într-o oră.**
  - Cererile reale de pe Android intră probabil tot aici. Android folosește reCAPTCHA Enterprise în WebView (`realtime-sync.ts:35-49`), cu originea `https://localhost`. Dacă `localhost` nu e în lista de domenii a cheii, tokenul lipsește, iar utilizatorii reali împart cele 600 cu atacatorul.
  - `verifyToken(token)` fără `consume` (`:512`): un token reCAPTCHA obținut o dată (valabil ~1 h) dă „ok”, deci 300 pe oră pe IP pe plafonul de 3.000.
  - Costul rămâne plafonat și totul e fail-closed, iar ghidul local merge mai departe. De aceea am coborât la P3.
- **Reparare.**
  1. App Check cu **Play Integrity** pe Android (plugin nativ) și verificare cu `consume: true` pentru tokenuri de unică folosință (`limitedUseAppCheckTokens`).
  2. Plafon pe uid pe **zi** (de exemplu 40), nu doar pe oră.
  3. Când Android trimite token, refuză `absent`.
- **Efort:** M.

### S5. [P3] Web Worker-ul (P2-9) anulează cache-ul de chei: PBKDF2 la fiecare criptare și decriptare

- **Ce am observat.**
  - `sync-worker-client.ts:58,69` trimite `secret` (un `CryptoKey`) la fiecare mesaj. `postMessage` îl clonează, iar clona e **alt obiect** (demonstrat: `structuredClone(material) === material → false`).
  - `keyCacheFor` (`family-crypto.ts:157-163`) e un `WeakMap` pe obiect, deci în worker nu găsește niciodată nimic.
  - Fiecare trimitere face deci PBKDF2 250k la decriptarea camerei plus PBKDF2 250k cu **sare nouă** la criptare. D8 („PBKDF2 la fiecare criptare”) s-a întors, acum pe alt fir: baterie și ~1–2 s pe un telefon slab la fiecare schimbare.
  - Criptografic e neutru (o sare nouă la fiecare scriere nu strică nimic), dar comentariul din `sync.worker.ts:5` („cheile rămân în memoria worker-ului”) nu e adevărat.
- **Reparare.** Trimite secretul o singură dată (`op: "init", sessionId`) și păstrează-l în worker, iar mesajele următoare poartă doar `sessionId`. Sau păstrează în worker un `Map` pe `roomId`. Adaugă un test care numără derivările.
- **Efort:** S. (De transmis și rolului de dezvoltare/performanță.)

### S6. [P3] Reguli: `reveal` nevalidat la prima scriere și stocare-gunoi fără plafon

- **Pe emulator:**
  ```
  OK   ALLOW   · C1 create seq=1 cu reveal = hartă arbitrară
  OK   ALLOW   · C2 create seq=1: ciphertext 950 KB + reveal 60 KB
  OK   ALLOW   · F6 familyRecovery create 950 KB de un străin (gunoi)
  OK   ALLOW   · H1 camere-gunoi de 950 KB create de un uid în 2338 ms: 20/20 (~19 MB)
  OK   ALLOW   · G2 familyEntitlements citire de oricine știe ID-ul
  ```
- **Ce înseamnă:**
  - `roomWriteOk` permite cheia `reveal`, dar `chainStarts()` nu-i verifică tipul sau mărimea (`firestore.chain.rules:60-63`). Un document poate depăși deci limita gândită.
  - Un singur uid anonim scrie ~8 MB pe secundă în documente noi, în ambele colecții. Asta înseamnă cost de stocare și factură.
  - Oricine știe ID-ul camerei află dacă familia plătește. Informație minoră.
- **Reparare.**
  1. În `chainStarts()`: `!('reveal' in request.resource.data)`.
  2. App Check Enforce pe Firestore (după Play Integrity, S4).
  3. Alertă de buget și o curățare (Cloud Scheduler) pentru camerele cu `updatedAt` mai vechi de 12 luni. Pentru `familyRecovery`, un TTL pe `expireAt` ar șterge codurile, deci aici doar alertă.
- **Efort:** S.

### S7. [P3] Invitația e permanentă, se poate refolosi, iar cititorul nu se vede; codul de recuperare nu se poate roti

- **Ce am observat.**
  - Codul `bf1.<cameră>.<cheie>` e cheia camerei, fără expirare. Rămâne în istoricul WhatsApp și în backup-ul lui (Google Drive, necriptat dacă omul n-a pornit backup-ul criptat).
  - Oricine îl găsește peste un an poate citi camera cu un client propriu, doar cu `get` și decriptare, fără să scrie. Nu apare în lista de telefoane, care e scrisă de clienți.
  - `onIssueRecovery` cere parola (`useFamilySync.ts:614-616`), care nu există pe camerele cu invitație. Singura rotire e „Mută familia”, iar codul vechi „rămâne valabil” (`:620`).
- **Reparare.**
  1. Invitație în două părți: linkul poartă un **token de intrare de unică folosință**, iar cheia camerei vine criptată pentru telefonul nou, de la un telefon deja în cameră (ECDH), sau printr-o funcție care consumă tokenul.
  2. Până atunci: „Schimbă invitația” la 30 de zile ca îndemn, plus textul „invitația deschide tot registrul; șterge mesajul după ce partenerul a intrat”.
  3. `onIssueRecovery` să folosească `syncInvite` (Android) sau să ceară reintroducerea invitației (web).
- **Efort:** S (texte, rotire), L (unică folosință).

### S8. [P3] Camerele vechi fără lanț pot fi „ocupate” de cine le află ID-ul

- **Pe emulator:** o cameră scrisă sub etapa 2 (fără `commit`, seed prin ocolirea regulilor, posibilă doar pe emulator):
  ```
  OK   ALLOW   · E1 străin pornește lanțul pe camera veche (seq=1, commit al lui)
  OK   DENY    · E2 familia (cu parola) nu mai poate scrie după ocupare
  ```
- Riscul e mic: ID-ul e `SHA-256("buget-familie-room:"+parolă)`, iar cine ghicește parola are oricum cheia. Rămâne însă o blocare definitivă pentru o familie al cărei ID a scăpat (loguri, consolă), fără ieșire în aplicație (mesajul de la `realtime-sync.ts:176`).
- **Reparare.** După `LEGACY_PASSWORD_UNTIL`: un script admin, rulat o dată, care marchează `sealedAt` (S2) pe camerele fără `commit` și cu `updatedAt` vechi. În aplicație, la acest mesaj: „Creează camera nouă cu datele de aici”.
- **Efort:** S.

### S9. [P3] Regulile „de urgență” redeschid găurile închise

- `firestore.auth.rules:24-49` și `firestore.rules` au încă `ciphertext < 2000000`, `familyRecovery` cu `create, update` și câmpuri fără tip. Revenirea de urgență documentată (`firebase.json → firestore.auth.rules`) redeschide S8 și S9 din 26.09 fără ca cineva să observe.
- **Reparare.** Aplică aceleași tipuri și `create`-only pe `familyRecovery` și în etapa 2. Sau păstrează doar o variantă de revenire, testată în CI (`test:sync:current` o rulează deja).
- **Efort:** S.

### S10. [P3] Ghidul AI: „da” aplică extragerea din răspunsul nou, nu propunerea arătată; promptul cere „am înregistrat” fără confirmare

- `AICompanion.tsx:702-706`: la „da”, `updates` vin din `payload.extracted` al **cererii de acum**. Modelul poate întoarce la „da” alte sume decât cele arătate în mesajul anterior, de exemplu după o injecție din numele unui plic pus de partener sau din textul unui bon. Omul confirmă ce a văzut, iar aplicația scrie ce a primit acum.
- `functions/src/index.ts:97` îi spune încă modelului să răspundă „că ai înregistrat datele, fără să ceri «Da»” la datorii și venituri. Clientul nu mai scrie fără „da”, deci modelul afirmă o salvare care n-a avut loc (fals „am salvat”).
- **Reparare.** La „da”, aplică exact `updates` ale ultimului mesaj al asistentului care le-a propus (sunt deja în `message.updates`), nu extragerea nouă. Scoate fraza din prompt.
- **Efort:** S.

### S11. [P3] Abonamentul Familia se pierde la „Mută familia” (la pornirea Billing)

- `index.ts:781-783`: dacă achiziția are `obfuscatedExternalAccountId`, se acceptă doar camera cu acel hash. După „Mută familia” (reacția corectă la S2), camera nouă nu mai poate primi abonamentul, deci **gestul de securitate e penalizat**.
- `!boundTo ||` acceptă orice cameră pentru achizițiile fără amprentă.
- **Reparare.** Leagă achiziția de uid (`sha256(uid)`), nu de cameră, și permite mutarea abonamentului în camera în care e telefonul care l-a cumpărat. Sau acceptă mutarea când cererea vine cu tokenul lanțului camerei vechi (dovada că e aceeași familie).
- **Efort:** S–M, înainte de `BILLING_LIVE = true`.

### S12. [P3] Dependențe de dezvoltare neschimbate față de 26.09

- `pnpm audit`: **50** (1 critică, 20 ridicate, 26 medii, 3 scăzute), identic cu ieri:
  - `vitest ^2.1.9` (critică, doar cu UI pornit; path traversal în `@vitest/mocker`);
  - `pnpm ^10.15.1` ca devDependency (în total 30 de avertismente, printre ele ocolirea integrității lockfile și execuția de scripturi);
  - `rollup` și `vite` din vitest;
  - `lighthouse` → `lodash-es`, `extract-zip`;
  - `firebase-tools` → `qs`, `picomatch`.
- Nu ajung în APK sau pe Pages (`--prod`: 0). S15 din STATUS e marcat „reparat”, dar partea de dependențe nu s-a făcut.
- **Reparare.** Scoate `pnpm` din `devDependencies` (versiunea vine din `packageManager`), `pnpm up vitest@^4 @vitest/* lighthouse` și un `pnpm audit --audit-level high` în CI, informativ.
- **Efort:** S.

### S13. [P3] Licența nouă: titular, notificările terților, versiunile vechi

- `LICENSE` numește ca titular „Buget Familie”, care nu e o persoană sau o firmă. Pune numele tău (sau al firmei).
- Aplicația redistribuie cod și fonturi sub licențe care cer textul lor în copie:
  - fonturile IBM Plex și Fraunces (SIL OFL 1.1) din `client/src/assets/fonts`;
  - Firebase, Capacitor și `tesseract.js` (Apache-2.0, cu cerință de NOTICE);
  - React și multe altele (MIT).

  APK-ul și site-ul nu conțin nicio listă de licențe. Adaugă `licenses.html` generat la build (de exemplu `pnpm licenses list --prod --json`) și un link în Setări → Despre.
- Până la `5b63e2a`, `package.json` declara `"license": "MIT"`. Copiile luate până atunci pot invoca MIT, iar schimbarea nu e retroactivă. Nu e o problemă de securitate, doar de așteptări.
- `README.md:32` descrie încă „o parolă de familie identică pe fiecare telefon”.
- **Efort:** S.

### S14. [P3] Mărunțișuri de confidențialitate și platformă

- Copiile automate din Descărcări sunt tot **necriptate** (declarat corect în privacy §8). Ideea de backup criptat cu codul de recuperare rămâne valabilă.
- `android/app/src/main/res/xml/config.xml:3` are încă `<access origin="*" />`. Inofensiv sub Capacitor, dar de șters.
- `addJavascriptInterface` (`MainActivity.java:110-112`) expune punțile și în cadrele străine (iframe-ul reCAPTCHA). Punțile fac doar lucruri locale (reamintiri, splash); de ținut minte să nu primească niciodată date din registru.
- DS §1 declară informațiile financiare „colectate, nu efemere” pentru datele doar locale. E o supra-declarare, inofensivă. Colectarea reală e prin ghid (DS §4).
- Google vede din traficul Firestore ce uid-uri și IP-uri accesează aceeași cameră, deci poate lega telefoanele unei familii. O frază în privacy §10 ar fi completă.
- **Efort:** S.

---

## 4. Rezultatul sondelor pe emulator (rezumat)

50 de cazuri, toate cu rezultatul așteptat (fișierul complet: `rules-probe.out`):
- **A1–A13**, lanțul: 13/13, ca pe 26.09. Străinul nu poate scrie, reseta, rescrie, șterge sau lista, iar `updateDoc` parțial e refuzat.
- **B1–B6**, tipuri și mărime: `updatedAt` text sau o dată aleasă de client, `createdAt` de 900 KB, `ciphertext` 950.001 și câmpuri în plus sunt toate refuzate, iar 950.000 trece.
- **C1–C2**, `reveal` la prima scriere: permis (S6).
- **D1–D3**, cel revocat anulează mutarea: permis (S2).
- **E1–E2**, ocuparea camerei vechi: permisă (S8).
- **F1–F6**, `familyRecovery`: suprascrierea, ștergerea și listarea sunt refuzate, iar gunoiul e permis (S6).
- **G1–G3**, colecțiile de server: închise; `familyEntitlements` se poate citi cu ID-ul.
- **H1**, stocarea: 20 × 950 KB în 2,3 s de la un uid.

---

## 5. Ce ține de consolă (proprietar)

1. **GitHub → Pages** pe celelalte depozite (VEYRA, BETPREDICT, Predictii-Pro, New, Lumin-Culler, BETPREDICT-LAB, BetAnalyticsPro, RoBet). Oricare cu Pages pornit împarte originea cu aplicația (S1). Soluția de fond e un **domeniu propriu** pentru Buget Familie; restrânge apoi CORS-ul în `functions/src/index.ts:13-22`.
2. **App Check:** furnizorul **Play Integrity** pentru aplicația Android. Verifică dacă cheia reCAPTCHA Enterprise are `localhost` în domenii (altfel Android e „absent”, S4). Apoi Enforce pe Firestore și pe funcții.
3. **Workload Identity Federation** pentru GitHub Actions, iar cheia JSON `FIREBASE_SERVICE_ACCOUNT` ștearsă (S3).
4. **Alertă de buget** pe proiect (Firestore stocare și scrieri, Functions, Gemini) și **restricționarea cheii API** Firebase (referreri web și pachet Android plus SHA-1).
5. **Gemini:** confirmă că cheia e pe nivel plătit (sau pe Vertex AI UE). Pe nivelul gratuit, Google poate folosi conținutul, iar „prelucrat efemer: Da” din DS §4 nu mai e adevărat.
6. **Authentication → Settings:** limita de conturi anonime pe IP (implicit 100 pe oră) poate fi coborâtă.
7. **Firestore → TTL:** verifică că politicile pentru `aiGuideQuota`, `aiGuideQuotaUnverified`, `playVerifyQuota`, `playRtdnQuota` și `appFeedbackQuota` sunt **active** (pasul din CI are `continue-on-error`).
8. **La pornirea Billing:** `PLAY_RTDN_SERVICE_ACCOUNT` setată (altfel toate notificările Play sunt refuzate, corect), iar S11 rezolvat înainte.

---

## 6. Top 5

1. **S1:** domeniu propriu pentru web, iar până atunci fără sesiune păstrată pe web și cu verificarea integrității în `sw.js`. Închide furtul cheii și otrăvirea aplicației de pe `balty1991.github.io`.
2. **S2:** câmpul `sealedAt` în reguli, ca pachetul „s-a mutat” să fie ireversibil, plus un „mutat” autentificat. Fără el, revocarea se poate anula de cel revocat.
3. **S3:** `pnpm exec firebase` în loc de `npx`, jobul de publicare separat de teste, apoi Workload Identity. Credențialul de admin nu mai stă lângă cod terț nefixat.
4. **S4 + S6:** Play Integrity și Enforce (App Check), tokenuri de unică folosință, plafon zilnic pe uid, `reveal` interzis la `seq = 1`. Închide golirea ghidului și umflarea stocării.
5. **S5 + S10:** worker-ul cu cheia păstrată (fără PBKDF2 la fiecare trimitere), „da” legat de propunerea arătată și fraza din prompt scoasă. Două reparații mici, cu efect direct pe baterie și pe corectitudinea registrului.
