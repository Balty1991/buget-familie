# Buget Familie: audit de securitate și confidențialitate (26.09.2026)

Commit auditat: `1935b14` (v1.1.96 / versionCode 98). Metodă: am citit codul (client, `functions/src/index.ts`, reguli, Android, workflow-uri, documente de politică). Am rulat `pnpm audit` și `npm audit`. Pe **emulator** (`firebase.e2e.json`, reguli `firestore.chain.rules`) am rulat 24 de sonde de reguli. **Nu am atins Firebase de producție** și nu am apelat funcțiile publicate. Nu am modificat nimic în repo în afară de acest fișier.
Scriptul și rezultatul sondelor sunt în `scratchpad/agenti/security/rules-probe.mjs` și `rules-probe.out`.

---

## 1. Pe scurt

Nucleul criptografic e solid și s-a întărit mult față de auditul din 25.09:
- camerele noi au ID și cheie aleatoare de 256 de biți;
- pachetul e comprimat, apoi criptat cu AES-GCM, cu limită de mărime și avertizare la 70%;
- lanțul de scriere HMAC/commit/reveal e publicat. Pe emulator am verificat că un uid care cunoaște ID-ul camerei, dar nu are cheia, nu mai poate scrie, reseta sau rescrie lanțul (toate cele 13 cazuri de pe `familySync` s-au comportat corect);
- PIN-ul are backoff, iar modul „Telefonul lui X” are cod de ieșire;
- notificările și widgetul nu mai arată sume când PIN-ul e activ, există opțiunea `FLAG_SECURE`, `dataExtractionRules` e pus;
- `playRtdn` are verificare OIDC, iar ghidul AI are plafon global și e fail-closed;
- există CSP pe web;
- politica numește acum Groq, conversația, numele membrilor și OCR-ul.

Ce rămâne sau e nou:
- **P2:** CSP-ul permite orice script de pe `cdn.jsdelivr.net`, deci nu protejează la XSS. Cititorul de bonuri descarcă cod și date de pe jsDelivr la rulare, inclusiv în APK. Căutarea de produse trimite ce tastezi la Open Food Facts, iar nici jsDelivr, nici Open Food Facts nu apar în politică.
- **P2:** plafonul global al ghidului AI (3.000 pe zi) se poate epuiza de un singur atacator cu 2–3 IP-uri sau cu IPv6, deci ghidul cade pentru toți.
- **P2:** revocarea unui telefon rămâne doar un semnal. Un telefon revocat, sau cine are o invitație veche, poate încă scrie orice în cameră (lanțul nu-l oprește, fiindcă are cheia), inclusiv un pachet „s-a mutat” care deconectează toată familia. Codul nu mută automat familia la revocare.
- **P2:** aplicația web stă tot pe originea comună `balty1991.github.io`. Invitația (cheia camerei) stă **în clar** în IndexedDB.
- **P2:** workflow-urile care au credențialul de producție rulează `firebase-tools@latest` nefixat și actions terțe fixate doar pe etichete.
- **P3:** mai multe inexactități în `PLAY_CONSOLE_DATA_SAFETY.md` și în politică.

**Notă globală pentru rol: 7,5/10.** Nimic nu e blocant (P0/P1) pentru lansarea testării închise. Punctele P2 trebuie închise înainte de producție.

---

## 2. Constatări

### S1. [P2] CSP-ul nu limitează scripturile: `script-src https://cdn.jsdelivr.net` permite orice pachet npm
- **Ce am observat.** `vite.config.ts:67` pune `https://cdn.jsdelivr.net` întreg în `script-src`, iar `connect-src` are la fel.
  - jsDelivr servește orice pachet publicat pe npm (`https://cdn.jsdelivr.net/npm/<orice>/x.js`). Cu o injecție HTML, un atacator își încarcă propriul script, deci CSP-ul nu oprește XSS-ul, deși asta era motivul lui (R10 din auditul trecut).
  - La exfiltrare, `img-src https:` și `connect-src https://*.googleapis.com` (inclusiv Firestore-ul unui proiect străin) lasă și ele datele să iasă.
- **Cum se reproduce.** Citește meta-ul CSP din `dist/public/index.html` după `pnpm build:pages`. Orice `<script src="https://cdn.jsdelivr.net/npm/<pachet-public>/...">` trece de politică.
- **Reparare.**
  1. Autogăzduiește workerul, nucleul WASM și `ron/eng.traineddata` Tesseract în `public/tesseract/` și setează `workerPath`, `corePath` și `langPath` în `createWorker` (`client/src/lib/receipt-utils.ts:996-1006`). Apoi scoate jsDelivr din CSP.
  2. Dacă rămâne pe CDN, restrânge la căi exacte cu versiune (`https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js`, `https://cdn.jsdelivr.net/npm/tesseract.js-core@<v>/`).
  3. `img-src 'self' data: blob:` (pozele de bon sunt locale).
  4. Restrânge `connect-src` la `firestore.googleapis.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firebaseappcheck.googleapis.com`, `content-firebaseappcheck.googleapis.com` și `europe-central2-buget-familie-a6a0d.cloudfunctions.net`.
- **Efort:** S–M.

### S2. [P2] Cod terț descărcat la rulare și două destinatare nedeclarate (jsDelivr, Open Food Facts)
- **Ce am observat.**
  - `tesseract.js` folosește implicit `https://cdn.jsdelivr.net/npm/tesseract.js@v…/dist/worker.min.js` (`node_modules/tesseract.js/src/worker/browser/defaultOptions.js:11`), nucleul WASM (`worker-script/browser/getCore.js:14`) și datele de limbă, tot de pe CDN. `receipt-utils.ts:996` nu suprascrie nicio cale.
    - Asta se întâmplă și în APK, unde nu există CSP (e dezactivat intenționat pentru Android, `vite.config.ts:56-59`). Nu există SRI.
    - Workerul primește **fotografia bonului**. Un pachet CDN compromis ar putea-o trimite oriunde, deși politica spune „Fotografiile bonurilor nu pleacă niciodată de pe telefon”.
    - Pe lângă asta, jsDelivr primește IP-ul și momentul fiecărei citiri de bon.
  - `ProductCatalogPanel.tsx:94-113` caută **în timp ce scrii** (debounce 380 ms) la `search.openfoodfacts.org`, `world.openfoodfacts.org` și `world.openproductsfacts.org` (`product-catalog.ts:492-506`).
  - Nici jsDelivr, nici Open Food Facts nu apar în `privacy.html` §10 („Destinatari”) sau în Data safety.
- **Reparare.**
  1. Autogăzduiește Tesseract (vezi S1). OCR-ul devine cu adevărat local și funcționează offline.
  2. Pentru Open Food Facts: căutare doar la apăsarea unui buton „Caută online”, plus o frază în politică („denumirea căutată pleacă la Open Food Facts, fără alte date”).
- **Efort:** M.

### S3. [P2] Ghidul AI: plafonul global se poate epuiza ieftin, deci DoS pentru toți
- **Ce am observat** (`functions/src/index.ts:631-641`, `560-575`).
  - Un uid anonim (gratuit, cu cheia API publică) primește 12 cereri pe oră. IP-ul primește 60 pe oră fără App Check și 300 cu App Check. Plafonul global e de 3.000 pe zi (`AI_GUIDE_DAILY_CAP`).
  - Un singur IPv4 dă 60 × 24 = 1.440 de cereri pe zi, deci **două IP-uri golesc ghidul pentru toată lumea**.
  - Cu IPv6, cheia e adresa întreagă (`clientIp`, l. 555-558). Un atacator rotește adrese din propriul /64, deci plafonul pe IP dispare.
  - Pool-ul „anonymous” (30 pe oră, fără uid și fără App Check) e comun, deci un script îl ține permanent plin.
  - Rămâne de verificat că ultima valoare din `X-Forwarded-For` e cea pusă de GFE pe Cloud Run (e corect pentru Cloud Run direct, dar nu în spatele unui LB).
- **Reparare.**
  1. Normalizează IPv6 la /64 (sau /56) în `clientIp`.
  2. Plafoane globale separate: de exemplu 80% din buget rezervat cererilor cu `trust === "ok"`, ca cererile fără App Check să nu-l consume pe tot.
  3. Pe Android, App Check cu **Play Integrity** în loc de reCAPTCHA în WebView (azi Android folosește tot site key-ul web, `realtime-sync.ts:35-48`).
  4. După o perioadă, respinge `absent`.
  5. Alertă de facturare și restricționarea cheii API Firebase (referrer și pachet Android).
- **Efort:** S (1, 2), M (3–4).

### S4. [P2] Revocarea nu taie accesul; un telefon revocat poate deconecta toată familia
- **Ce am observat.**
  - `sync-devices.ts` și `onRevokeDevice` (`useFamilySync.ts:581-596`) doar marchează `revokedAt` în pachet. Telefonul revocat păstrează cheia, inclusiv codul invitației în clar în IndexedDB (S5), deci poate calcula tokenii lanțului. Lanțul oprește doar pe cine **nu** are cheia.
  - Cu un client modificat, cel revocat poate:
    - (a) să rescrie tot registrul, inclusiv cu pietre funerare;
    - (b) să-și șteargă semnul de revocare (`mergeSyncDevices`: câștigă `lastSeenAt` mai nou, `crypto.ts:215-230`);
    - (c) să scrie un pachet cu `settings.syncRoomMovedAt`. Atunci **fiecare** telefon cheamă `syncStopMovedRoom()` → `clearFamilySession()` (`useFamilySync.ts:187-199, 204-206, 468-470`), iar sesiunile și invitațiile salvate se șterg. Familia rămâne fără cameră, iar dacă nimeni nu are codul invitației sau codul de recuperare, trebuie să facă o cameră nouă.
  - UI-ul spune corect „revocă, apoi Mută familia” (`SyncPanel.tsx:347`), dar mesajele din `useFamilySync.ts:218, 272, 584` spun încă „schimbați parola familiei”. Fluxul cu parolă nu mai există pentru camerele noi.
- **Reparare.**
  1. La revocarea altui telefon, oferă direct (sau fă automat, cu confirmare) „Mută familia” pe invitație nouă.
  2. `syncStopMovedRoom` să nu șteargă sesiunea până nu confirmă omul. Pachetul „mutat” să fie semnat cu un token de lanț special, de exemplu HMAC(k, „moved”), verificat de client.
  3. Actualizează textele.
- **Efort:** M.

### S5. [P2] Origine web comună `balty1991.github.io` și invitația în clar în IndexedDB (R6 din auditul trecut, încă deschis)
- **Ce am observat.**
  - `family-invite.ts:13` și CORS-ul funcțiilor (`functions/src/index.ts:13-22`) folosesc tot `https://balty1991.github.io`.
  - `family-session.ts:61-65` salvează `invite` (formatul `bf1.<room>.<key>`, adică **cheia camerei**) în clar în IndexedDB-ul originii.
  - Orice pagină de pe `balty1991.github.io/*` (alt repo, un PR interceptat, o dependență compromisă a altui proiect) citește registrul în clar din `localStorage` și invitația, deci are acces permanent la cameră până la „Mută familia”.
  - Comentariile din cod și `privacy.html` §2 („cheia stă doar pe telefoanele familiei”) sunt corecte, dar „neexportabil” nu mai are sens când codul invitației stă alături.
- **Reparare.**
  1. Domeniu propriu (`app.bugetfamilie.ro`) și CORS restrâns la el.
  2. Până atunci, pe web păstrează doar `CryptoKey` neexportabil și cere reintroducerea invitației când omul vrea să invite pe altcineva. Pe Android riscul e mic (sandbox), deci acolo se poate păstra.
- **Efort:** M (domeniu), S (fără invitație pe web).

### S6. [P2] Lanțul de aprovizionare în CI-ul de producție
- **Ce am observat.**
  - `deploy-firebase-functions.yml` și `deploy-firestore-rules.yml` rulează `npx --yes firebase-tools@latest deploy …` cu credențialul `FIREBASE_SERVICE_ACCOUNT` (cheie JSON cu viață lungă) încărcat. Versiunea e nefixată: o versiune compromisă de pe npm primește acces de admin la proiect.
  - În `deploy-firestore-rules.yml`, `pnpm install` (cu scripturi de instalare) și testele e2e rulează **în același job** în care se autentifică apoi la GCP.
  - Actions terțe (`pnpm/action-setup@v5`, `google-github-actions/auth@v3`, `setup-gcloud@v3`) sunt fixate pe etichete, nu pe SHA.
  - Secretele de keystore sunt interpolate direct în `run:` (`echo "${{ secrets.… }}"`, `release-android-aab.yml`, `build-android-apk.yml`). Merge, dar e fragil; mai curat e prin `env:`.
  - `packageManager: pnpm@10.19.0` are avertismente publicate (bypass al integrității lockfile, execuție de lifecycle etc.; `pnpm audit` le raportează ca „high”), iar CI-ul folosește exact această versiune.
- **Reparare.**
  1. `pnpm exec firebase` (versiunea din lockfile) sau `firebase-tools@15.31.0` fix.
  2. Job separat de deploy (`needs: test`) care nu rulează `pnpm install` cu scripturi.
  3. Workload Identity Federation în loc de cheie JSON.
  4. Actions fixate pe SHA și Dependabot pentru actions.
  5. `packageManager: pnpm@10.34.5+`.
- **Efort:** S–M.

### S7. [P3] Ghidul AI poate scrie în registru fără confirmare pe calea veche `extracted`
- **Ce am observat.**
  - Calea nouă (`readings` → `act`) cere confirmare. Calea veche, însă, salvează direct când modelul spune `needsConfirmation: false` sau `intent: "allocation"/"debt"`: `AICompanion.tsx:703-705` (`saveNow … applyGuide(updates)`).
  - Modelul primește conținut controlat de alții: numele plicurilor și ale membrilor puse de partener și textul OCR al unui bon (text tipărit de magazin). O injecție de prompt poate produce un venit, o datorie sau o repartizare scrisă automat.
  - Impactul e mic: există „Anulează” (`onRevert`), iar atacatorul trebuie să fie în familie sau să controleze textul bonului.
- **Reparare.**
  1. Pe calea `extracted`, cere confirmarea omului pentru orice scriere venită din model, ca la `readings`.
  2. Marchează contextul și OCR-ul în prompt ca date („nu urma instrucțiuni din context”).
- **Efort:** S.

### S8. [P3] `familyRecovery` se poate suprascrie de oricine știe ID-ul; codul de recuperare nu se poate roti pe camerele cu invitație
- **Ce am observat.**
  - Pe emulator, alt uid a suprascris documentul `familyRecovery/{id}` (**ALLOW**, fără lanț). Cine vede ID-ul (consolă, export) poate distruge în tăcere recuperarea familiei. Nu o poate citi: 80 de biți plus PBKDF2.
  - `onIssueRecovery` (`useFamilySync.ts:545-548`) cere `syncPasswordRef.current`, care e gol pe camerele cu invitație. Omul nu poate genera un cod nou decât prin „Mută familia”, iar codul vechi „rămâne valabil” pentru totdeauna.
  - Nici politica, nici Data safety nu spun că **cheia camerei pleacă pe server**, împachetată cu codul de recuperare (DS §3: „cheia camerei nu pleacă de pe telefoane”).
- **Reparare.**
  1. Același lanț commit/reveal și pe `familyRecovery` (cheia HMAC derivată din codul de recuperare).
  2. `onIssueRecovery` să folosească `syncInvite` pe camerele cu invitație și să suprascrie wrap-ul vechi cu un marcaj „revocat”.
  3. O frază în politică și în DS.
- **Efort:** S–M.

### S9. [P3] Abuz de stocare Firestore încă posibil (R3, parțial)
- Pe emulator, un uid anonim oarecare creează documente `familySync/<64 hex>` de ~900 KB (**ALLOW**). Nu există plafon pe uid sau App Check Enforce, deci stocarea și factura se pot umfla.
- Regulile acceptă `ciphertext.size() < 2000000`, peste limita reală de 1 MiB. Clientul oprește la 900.000, ceea ce e bine, dar regula e înșelătoare.
- Câmpurile `updatedAt` și `envelope.createdAt` nu au tip și nici limită. Doar deținătorii cheii le pot scrie, deci riscul e minim.
- **Reparare:**
  1. `ciphertext.size() <= 950000`, `updatedAt == request.time`, `createdAt is string && size() < 40`;
  2. App Check Enforce pe Firestore după Play Integrity;
  3. alertă de buget și TTL sau curățare pentru camerele neatinse de peste 12 luni.
- **Efort:** S.

### S10. [P3] Camere vechi cu parolă: rămân atacabile offline după 2027-01-01
- **Ce e reparat:** `generateFamilyPassword` e șters, iar intrarea nouă cu parolă se închide la `LEGACY_PASSWORD_UNTIL = 2027-01-01`.
- **Ce rămâne:** telefoanele deja conectate merg mai departe pe camera cu ID = SHA-256(parolă) (`family-crypto.ts:550`). ID-ul rămâne o țintă de brute-force offline fără PBKDF2, iar PBKDF2 are tot 250k iterații.
- În plus, o cameră veche care n-a fost scrisă de la publicarea regulilor etapei 3 nu are lanț. Primul care scrie cu ID-ul (`chainStarts`) o „ocupă”, iar familia primește „Camera familiei a fost scrisă de un telefon fără cheia familiei”.
- **Reparare:** după data limită, clientul să mute automat (cu confirmare) orice cameră cu parolă pe invitație. Un banner persistent până atunci.
- **Efort:** S.

### S11. [P3] `playRtdn`: verificarea OIDC acceptă orice cont de serviciu Google
- **Ce am observat.** `functions/src/index.ts:828-839`: fără `PLAY_RTDN_SERVICE_ACCOUNT`, trece orice e-mail `*.gserviceaccount.com`.
  - Oricine își face un proiect GCP poate emite un ID token pentru audiența funcției (`gcloud auth print-identity-token --audiences=…`), deci verificarea e aproape nulă.
  - Tokenul Play e reverificat la Google, deci nu se poate da Familia. Un atacator poate însă epuiza plafonul `playRtdnQuota` de 5.000 pe zi, iar notificările reale de anulare sau rambursare din acea zi sunt ignorate: abonamente rambursate rămân active până la reverificare.
  - `docs/BILLING_PLAY_PREP.md` numește variabila „opțional”.
- **Reparare:** fă `PLAY_RTDN_SERVICE_ACCOUNT` obligatorie (refuză dacă lipsește) și plafon pe e-mailul emitentului.
- **Efort:** S.

### S12. [P3] `verifyPlayPurchase` leagă o achiziție Google de o cameră, fără legătură cu apelantul
- **Ce am observat.** Fără App Check și fără uid. `roomId` vine din corpul cererii, iar `obfuscatedExternalAccountId` nu e verificat (`index.ts:720-740`). Cine are un token valid mută Familia în orice cameră. Limita e de 30 pe oră pe IP (aceeași problemă IPv6 ca la S3).
- **Confidențialitate:** `playPurchases` păstrează `roomId` lângă tokenul Play. Serverul poate lega o cameră „anonimă” de contul Google care a plătit.
- **Reparare:** când `BILLING_LIVE` devine `true`, trimite `obfuscatedAccountId = sha256(uid)` la cumpărare și verifică-l pe server. Declară în DS *Istoric de achiziții* și leagă-l în politică §14.
- **Efort:** S.

### S13. [P3] Stocare locală și ecran
- `setRecentsScreenshotEnabled(false)` e doar pe Android 13+ (`MainActivity.java:79-81`); `minSdk` e 24. Pe Android 7–12, Recente arată registrul dacă omul nu a pornit „Ascunde ecranul în capturi”. **Reparare:** când PIN-ul e activ, pornește automat `FLAG_SECURE`, sau pune `FLAG_SECURE` în `onPause` și scoate-l în `onResume` pe API < 33.
- Notificările nu au `setVisibility(VISIBILITY_PRIVATE)` sau `setPublicVersion` (`ReminderWorker.java:60-72`). Cu PIN, corpul e deja înlocuit (`local-notifications.ts:26`), dar **titlurile** pot conține sume sau nume; verifică „Ritm peste plan”, „Rată în N zile”. Adaugă `setPublicVersion` fără detalii.
- Codul de blocare și codul „Telefonul lui X” sunt PBKDF2 pe 4 cifre, cu backoff. E corect pentru rolul lor de ecran, fiindcă registrul e oricum în clar în WebView. Merită spus asta clar în Setări („PIN-ul ascunde ecranul, nu criptează datele”).
- Conversația cu ghidul (ultimele 30 de mesaje) stă în clar în `localStorage` (`AICompanion.tsx:98`) și **nu e ștearsă** de „Telefonul lui X”. E în regulă, dar menționeaz-o în politica §1.
- `READ_EXTERNAL_STORAGE maxSdkVersion="32"`: rotația copiilor pe API 29–32 merge prin MediaStore fără permisiune, deci ajunge `maxSdkVersion="28"`. Politica §7 spune oricum „doar Android 9 și mai vechi”.
- **Efort:** S.

### S14. [P3] Invitație „capcană”: confirmarea nu acoperă toate datele
- `useFamilySync.ts:382`: `hasLocalData` verifică mișcări, datorii, economii, plicuri și solduri. Un telefon cu doar **membri, scadențe recurente, venituri așteptate sau evenimente** intră fără întrebare într-o cameră străină, iar aceste date pleacă la cel care a trimis invitația.
- Pe web, linkul `#alatura=` sare și onboarding-ul (`Home.tsx:259-266`).
- **Reparare:** întreabă mereu înainte de o intrare pe invitație dacă registrul nu e literalmente gol (`recurring`, `members.length > 1`, `plannedEvents`, `incomes`).
- **Efort:** S.

### S15. [P3] Server de dezvoltare și dependențe
- `vite.config.ts:130-137`: `server.host: true` și **`allowedHosts: true`**. Scriptul `dev` pune `--host 127.0.0.1`, dar `allowedHosts: true` dezactivează protecția la DNS rebinding: o pagină web poate citi sursele de pe serverul local al dezvoltatorului. `preview` are încă `--host` (LAN). **Reparare:** scoate `allowedHosts: true` și `host: true` și folosește `vite preview --host 127.0.0.1`.
- `pnpm audit --prod`: 0. `functions`: `npm audit --omit=dev`: 0.
- `pnpm audit` complet: 50 (1 critică, 20 ridicate, 26 medii, 3 scăzute). Toate sunt în unelte de dev:
  - `vitest <3.2.6` (critic, doar cu UI pornit);
  - `pnpm` devDependency (multe);
  - `vite/rollup`, `lighthouse` → `extract-zip`/`lodash-es`, `firebase-tools` → `picomatch`.
  
  Nu ajung în APK sau pe Pages. **Reparare:** `pnpm up vitest@^3 vite rollup lighthouse` și scoate `pnpm` din devDependencies.
- **Secrete:** în arbore și în istoric (218 commituri) am găsit doar cheia publică Firebase web (normal) și site key-ul reCAPTCHA (public). Nu există keystore, `.env`, `google-services.json` sau chei Gemini/Groq. **Bine.**
- **Efort:** S.

### S16. [P3] Politica de confidențialitate și Data safety față de cod

| # | Document | Afirmația | Realitatea | Ce trebuie schimbat |
|---|---|---|---|---|
| D1 | privacy §10, DS §C | Destinatari: Google, Groq, GitHub | Lipsesc **jsDelivr** (IP la fiecare citire de bon, cod executat) și **Open Food Facts** (termenii căutați) | Adaugă-le sau elimină dependența (S2) |
| D2 | privacy §1 | „Fotografiile bonurilor nu pleacă niciodată” | Adevărat, dar sunt procesate de cod descărcat de pe CDN | Autogăzduiește Tesseract |
| D3 | DS §3, privacy §2 | „Cheia camerei nu pleacă de pe telefoane” | Pleacă, împachetată cu codul de recuperare, în `familyRecovery` | „…pleacă doar criptată cu codul de recuperare, pe care serverul nu îl are” |
| D4 | DS §D | „Schimbați parola (≥12 caractere)” | Fluxul e „Revocă” plus „Mută familia” (P14 din auditul trecut, **încă deschis**) | Actualizează |
| D5 | DS §B.1 | Informații financiare „colectate” fiindcă stau pe dispozitiv; „Prelucrat efemer: Nu” | Datele doar locale nu sunt „colectate” în sensul Play; colectarea reală e prin ghid (§4) | Motivul: ghidul online, opțional (P5, parțial deschis) |
| D6 | DS §4 | „Prelucrat efemer: Da” | Gemini și Groq pot păstra cereri pentru monitorizarea abuzului; pe nivelul gratuit Gemini, Google poate folosi conținutul (P19, **neverificat**: nu se vede în cod ce plan are cheia) | Confirmă planul plătit sau Vertex AI UE; altfel „efemer: Nu” |
| D7 | privacy §9 | „Contoarele de limită se suprascriu singure” | Depind de politica TTL pe `expireAt`, pornită cu `continue-on-error` în CI; `appFeedbackQuota` **nu** e în lista TTL (`deploy-firebase-functions.yml`, bucla `for group in …`) | Adaugă `appFeedbackQuota` și verifică în consolă |
| D8 | DS §G | Public țintă 18+ | Există modul „Telefonul lui X” pentru copil, cu notare de cheltuieli sincronizată | Poziția din privacy §12 e rezonabilă; păstrează capturile ecranului în Play fără „Bani de buzunar” ca funcție principală și pregătește răspunsul pentru Families |
| D9 | privacy §14 | „Nu activează plăți” | `verifyPlayPurchase`/RTDN sunt publicate, `BILLING_LIVE=false` | La activare: *Istoric de achiziții*, legătura cameră–cont Google (S12) |

---

## 3. Stadiul constatărilor din auditul anterior (`docs/raport-agenti-2026-09/secperf-report.md`)

| ID | Stare | Dovada |
|---|---|---|
| R1 pachet >1 MiB | **Închis** | gzip înainte de criptare, `SYNC_ENVELOPE_LIMIT=900000`, avertizare la 70% (`family-crypto.ts:105-113`, `useFamilySync.ts:490-493`). Regula e încă `< 2000000` (S9) |
| R2 cotă AI | **Parțial** | fail-closed, XFF ultima valoare, plafon global. Rămân App Check opțional, IPv6 și DoS pe plafon (S3) |
| R3 reguli, scrieri | **Parțial** | Lanțul HMAC oprește scrierile fără cheie (verificat pe emulator). Rămân revocarea (S4), stocarea (S9) și `familyRecovery` (S8) |
| R4 camere cu parolă | **Parțial** | `generateFamilyPassword` șters, dată de închidere; PBKDF2 tot 250k; camerele conectate rămân (S10) |
| R5 backup în Descărcări | **Parțial** | rotație la 4 fișiere și declarare în politică; tot necriptat |
| R6 origine comună | **Deschis** | S5 |
| R7 „Telefonul lui X” | **Închis** în UI (cod de ieșire cu backoff, Sync/Ghid/Setări ascunse). Cheia rămâne pe telefonul copilului (inerent) |
| R8 PIN | **Aproape închis** | backoff, widget „—”, corp de notificare ascuns, `FLAG_SECURE` opțional, Recente doar pe API 33+ (S13) |
| R9 RTDN/verify | **Parțial** | OIDC prezent, dar acceptă orice SA (S11); verify cu plafon pe IP, fără legare de uid (S12) |
| R10 CSP / WebView | **Parțial** | CSP există, dar cu jsDelivr (S1); `file_paths.xml` restrâns; `dataExtractionRules` pus; `<access origin="*">` rămâne în `config.xml` (inofensiv, dar de șters) |
| R11 invitație permanentă | **Parțial** | „Schimbă invitația” există; invitația rămâne fără expirare, fără token de unică folosință |
| R12 dependențe | **Parțial** | prod 0; dev 50 (S15); `dev` pe 127.0.0.1, dar `allowedHosts: true` |
| R13 TTL contoare | **Parțial** | `expireAt` + TTL în CI; lipsește `appFeedbackQuota` (D7) |
| P1–P3, P7, P8, P11, P12, P15, P16 | **Închise** | Groq numit, 8 mesaje, OCR, reCAPTCHA, backup, permisiuni, Umami scos, IP, widget |
| P5, P14, P19 | **Deschise** | D4–D6 |

---

## 4. Idei de dezvoltare (securitate), prioritizate

1. **Tesseract autogăzduit** (S1 + S2 dintr-o mișcare): OCR offline real, CSP strâns, două destinatare mai puțin. Efort M, câștig mare.
2. **„Revocă = mută”**: la revocarea unui telefon, cameră nouă automat și invitația nouă distribuită doar telefoanelor rămase. Opțional, la fiecare telefon păstrat, un „cod de telefon” (pereche de chei ECDH) ca invitația nouă să ajungă criptată direct la ele, fără WhatsApp.
3. **App Check cu Play Integrity pe Android** și Enforce pe Firestore și Functions. Închide S3 și S9 în bună parte.
4. **Invitații de unică folosință**: codul QR sau link conține un token de intrare separat, iar primul telefon care intră îl consumă (verificat de o funcție) și primește cheia criptată.
5. **Backup automat criptat** cu codul de recuperare (AES-GCM, același format `EncryptedEnvelope`), cu import care cere codul.
6. **Domeniu propriu** pentru varianta web și CORS strâns.
7. **Jurnal de securitate în Sync**: ultima scriere din cameră cu `seq`, telefonul care a scris-o (id-ul device din pachet) și avertizare când `seq` sare fără o scriere cunoscută.

---

## 5. Ce e deja foarte bine

- Lanțul commit/reveal e corect ca design și implementare: tranzacție, verificare locală a commit-ului, fallback pentru regulile vechi. Regulile refuză reset, salt de `seq`, replay și scoaterea lanțului (verificat pe emulator).
- CI-ul publică regulile doar după testul e2e pe emulator și verifică regula publicată.
- Criptarea e compresie + AES-GCM-256 cu IV și sare aleatoare. Invitația și codul de recuperare vin din CSPRNG. Parsarea invitației e strictă (regex), iar intrarea cere o acțiune a omului și confirmare.
- `get` fără `list`, fără `delete`. Colecțiile de server au `if false`.
- Funcțiile validează intrarea: mesaje ≤12 × 2.000 de caractere, context ≤12 KB, 8 readings, atașamentele ignorate. Plafonul global e fail-closed, iar erorile furnizorilor nu ajung la client.
- Android: `allowBackup=false` + `dataExtractionRules`, componente neexportate (în afară de dala QS, protejată de permisiune), `PendingIntent` imutabile, `FileProvider` restrâns, fără `usesCleartextTraffic`, cache WebView oprit.
- Nicio sursă `dangerouslySetInnerHTML`, `innerHTML` sau `eval` în client. Fără secrete în repo.
- Politica de confidențialitate e mult mai exactă decât acum o zi.
