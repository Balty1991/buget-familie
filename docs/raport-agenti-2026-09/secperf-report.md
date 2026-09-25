# Buget Familie: audit de securitate, confidențialitate și performanță

Commit auditat: `867bb12` (versiunea 1.1.96 / versionCode 98). Data: 25.09.2026.
Metodă: am citit codul (client, `functions/`, reguli, Android) și am măsurat build-ul de producție `vite preview` și serverul de dev cu Playwright + CDP. Tot traficul spre alte gazde decât 127.0.0.1 a fost blocat. **Nu am trimis nicio cerere la Firebase sau la vreun endpoint de producție.** Nu am modificat nimic în repo.

---

## 1. Rezumat

**Ce e bine făcut.** Criptografia de bază e corectă: AES-GCM-256, salt și IV aleatoare la fiecare pachet, PBKDF2-SHA256. Camerele noi au ID și cheie aleatoare de 256 de biți, iar codul de recuperare are 80 de biți luați din CSPRNG. Regulile Firestore nu permit `list` și `delete`. Înainte să intri într-o cameră din invitație apare o confirmare explicită. Manifestul e restrâns (`allowBackup=false`, PendingIntent-uri `FLAG_IMMUTABLE`, receiverele widget neexportate). La pornire aplicația nu face nicio cerere externă (verificat). `pnpm audit --prod` și `npm audit --omit=dev` în `functions/` nu raportează nimic.

**Cele mai importante probleme:**

1. **[Ridicat, fiabilitate + date] Sincronizarea familiei se blochează definitiv pe la ~3.000 de mișcări.** Tot registrul pleacă într-un singur document Firestore. Peste ~3.100 de mișcări pachetul criptat depășește limita fixă de 1 MiB a unui document. Am măsurat: 3.000 de mișcări dau 1,02 MB, 4.000 dau 1,36 MB. Codul nu tratează cazul.
2. **[Ridicat, conformitate] Politica de confidențialitate și răspunsurile Data safety nu spun ce pleacă efectiv la AI:**
   - rezerva **Groq (SUA)** nu apare nicăieri;
   - pleacă **textul OCR brut al bonului** (magazin, produse, uneori ultimele cifre ale cardului);
   - pleacă **numele membrilor** și **veniturile pe persoană**;
   - pleacă **ultimele 20 de mesaje** ale conversației. Politica spune că „conversația rămâne pe telefon”.
3. **[Mediu] Serverul se poate abuza pe costuri.** Limita pe oră a `aiGuide` se ocolește: App Check e doar opțional, contul anonim se creează gratuit, IP-ul probabil se poate falsifica din `X-Forwarded-For`, iar la o eroare Firestore cererea trece. Separat, regulile Firestore permit oricui are o identitate anonimă să creeze oricâte documente de 1 MiB.
4. **[Mediu] Copiile de siguranță automate stau în clar în Descărcări publice.** Nu se rotesc și rămân după dezinstalare sau resetare. Politica spune însă că datele dispar la dezinstalare.
5. **[Mediu] Aplicația web rulează pe originea comună `balty1991.github.io`.** Orice alt site GitHub Pages al aceluiași cont poate citi `localStorage` și IndexedDB, adică registrul în clar și sesiunea de familie.
6. **[Mediu] Noul mod „Telefonul lui X” (copil sau bunic).** Telefonul copilului primește cheia și tot registrul familiei, iar din mod se iese fără PIN. Politica spune în același timp că aplicația „nu este destinată copiilor sub 13 ani”, ceea ce contează pentru declarația de public țintă din Play.
7. **[Performanță] Cu 5.000 de mișcări, pe CPU încetinit de 6×:**
   - pornire: TBT 7,1 s, cel mai lung task 2,4 s, conținut vizibil la 4,4 s, TTI 10,7 s;
   - comutarea pe Astăzi durează ~2 s, pe Plan până la 1,5 s.

   Cauza principală e `isoToday()`: construiește un `Intl.DateTimeFormat` nou la fiecare apel (0,9 ms pe apel la 6×, de 180× mai lent decât fără fus orar) și e chemat în bucle. La asta se adaugă recalculări de tipul O(săptămâni × mișcări) care nu sunt memoizate.

---

## 2. Vulnerabilități și riscuri

Severitate: Ridicat / Mediu / Scăzut / Info. Numerele de linie sunt la commitul `867bb12`.

### R1. [Ridicat] Pachetul familiei depășește limita de 1 MiB a unui document Firestore
- **Unde:** `client/src/lib/family-crypto.ts:57-87` (`encryptFamilyData` serializează tot `AppData`), `client/src/lib/realtime-sync.ts:152-160` (`setDoc` al întregului pachet), `firestore.auth.rules:24` (`ciphertext.size() < 2000000`, mai mult decât limita reală de 1.048.576 B).
- **Măsurat** (base64, fără imagini):

  | mișcări | caractere ciphertext | peste 1 MiB? |
  |---|---|---|
  | 1.000 | 340.876 | nu |
  | 2.000 | 679.968 | nu |
  | 3.000 | 1.018.896 | nu, la limită |
  | 4.000 | 1.357.672 | **da** |
  | 5.000 | 1.696.640 | **da** |

- **Scenariu:** o familie cu ~150 de mișcări pe lună ajunge la prag în aproximativ 18–24 de luni.
  - Din acel moment `pushFamilyEnvelope` aruncă „Actualizarea nu a putut fi trimisă” la fiecare modificare. Telefoanele nu mai converg.
  - Telefonul nou nu poate intra în familie, fiindcă pachetul nu mai poate fi scris.
  - Până la prag, fiecare modificare urcă tot registrul (~1–1,7 MB) după un debounce de 800 ms. Asta costă date mobile și scrieri Firestore.
- **Remediere:**
  1. Comprimă înainte de criptare (`CompressionStream('gzip')`). JSON-ul de registru se comprimă de 5–10×.
  2. Pe termen lung, împarte pachetul pe bucăți, de exemplu un document criptat pe lună (`familySync/{room}/chunks/{yyyy-mm}`), plus un document „head” mic.
  3. Adaugă o verificare de mărime înainte de `setDoc`, cu un mesaj clar în UI.
  4. Coboară limita din reguli sub 1 MiB, ca să reflecte realitatea.

### R2. [Mediu] Limita pe oră a `aiGuide` se poate ocoli; costul și cota modelului pot fi epuizate pentru toți
- **Unde:** `functions/src/index.ts` (numerotare din fișierul original)
  - App Check lipsă e acceptat: `appCheckTrusted` întoarce `"absent"` și cererea merge mai departe (~l. 499-507 și ~596-601);
  - `takeQuota` lasă cererea să treacă la orice eroare Firestore (`return true`, ~l. 538-541);
  - IP-ul se ia din `request.ip || x-forwarded-for` (~l. 602).
- **Scenariu:**
  - Un script fără App Check are 12 cereri pe oră per uid anonim. Conturile anonime se creează gratuit prin Identity Toolkit, cu cheia API publică din `firebase-config.ts:22`. Plafonul pe IP e de 60 pe oră.
  - Firebase Functions v2 rulează peste functions-framework, care activează `trust proxy`. Asta **trebuie verificat**, dar dacă e așa, `request.ip` e prima valoare din `X-Forwarded-For`, pe care o controlează clientul. Rotind antetul, plafonul pe IP dispare.
  - Rezultat: cheia Gemini/Groq, comună pentru toți utilizatorii, își epuizează cota zilnică (DoS pentru ghidul online) sau generează factură dacă e pe plan plătit.
- **Remediere:**
  1. Cere App Check (Play Integrity pe Android, reCAPTCHA Enterprise pe web) și respinge `absent` după o perioadă de tranziție.
  2. Ia IP-ul din ultima valoare `X-Forwarded-For` adăugată de GFE, sau folosește doar uid-ul.
  3. Fă „fail-closed” când Firestore cade.
  4. Pune un plafon global pe zi (buget).
  5. Restricționează cheia API Firebase în GCP la aplicația Android și la referrer-ul web.

### R3. [Mediu] Regulile Firestore nu leagă scrierile de membri; abuz de stocare și suprascriere
- **Unde:** `firestore.auth.rules:35-48`.
- **Ce se întâmplă:**
  - `signedIn()` cere doar o identitate anonimă, pe care o poate obține oricine.
  - Nu există rate limit și nici App Check enforced (`realtime-sync.ts:35-48`: fără cheie, Enforce e intenționat oprit).
- **Scenarii:**
  - **Abuz de cost:** un atacator creează oricâte documente `familySync/<64 hex aleator>` de ~1 MiB, care cresc factura de stocare.
  - **Distrugere de conținut:** un fost membru, un telefon revocat dar nemutat sau oricine a văzut invitația poate suprascrie pachetul cu gunoi sau cu o versiune plină de „pietre funerare”. Ștergerile se propagă la toată familia.
  - Revocarea (`sync-devices.ts`) e doar un semnal între clienți onești, iar UI-ul o spune. Doar „Mută familia” taie accesul real.
- **Remediere:**
  1. App Check Enforce pe Firestore după ce build-ul publicat trimite token.
  2. Pe termen mediu: un document `members` cu uid-urile permise, scris la intrarea cu invitație (de exemplu printr-o funcție care verifică o dovadă de posesie a cheii, gen HMAC(roomKey, uid)), și reguli `allow update: if request.auth.uid in get(...).data.uids`.
  3. Buget sau alertă de facturare, plus TTL pe camerele abandonate.

### R4. [Mediu] Camerele vechi, cu parolă: ID-ul camerei e SHA-256 nesărat al parolei
- **Unde:** `client/src/lib/family-crypto.ts:467-470` (`deriveFamilyRoomId`), `client/src/hooks/useFamilySync.ts:308`.
- **Scenariu:** oricine vede ID-urile documentelor poate face brute-force offline pe parolă cu viteza unui SHA-256 simplu (miliarde de încercări pe secundă pe GPU), ocolind complet PBKDF2. Asta include dezvoltatorul, pe cineva cu acces la consolă sau la un export, și loguri. Parolele alese de oameni, chiar de 12+ caractere, cad la atacuri de dicționar. Contrazice afirmația „dezvoltatorul nu poate citi sumele”.
- `generateFamilyPassword()` (`family-password.ts:101-119`) folosește `Math.random` și 16 cuvinte, deci ~16·15·14·89 ≈ 300.000 de combinații (~18 biți). Acum nu mai e chemată (doar în teste), dar nu trebuie refolosită.
- **Remediere:**
  1. Forțează migrarea camerelor vechi pe invitație („Mută familia”) și refuză conectarea nouă cu parolă, de exemplu după o dată limită.
  2. Șterge `generateFamilyPassword`.
  3. Crește PBKDF2 la ≥600k (recomandarea OWASP 2023) pentru ce rămâne pe parolă.

### R5. [Mediu] Copii de siguranță automate în clar în Descărcări publice
- **Unde:** `android/.../BugetFamilieNativePlugin.java:63-103` (MediaStore Downloads), `client/src/lib/auto-backup.ts`, `client/src/components/AutoBackupCard.tsx:34`.
- **Ce e bine:** pornește doar cu acordul explicit al utilizatorului, iar textul spune că fișierul are sumele în clar.
- **Riscuri:**
  - Fișierele pot fi citite de:
    - Android ≤9: orice aplicație cu `READ_EXTERNAL_STORAGE`;
    - Android 10: aplicații cu stocare legacy;
    - managere de fișiere cu „All files access”;
    - PC prin USB/MTP;
    - aplicații de sincronizare cloud care urcă Descărcările.
  - Fișierele se adună săptămânal, fără rotație (numele au dată).
  - Supraviețuiesc dezinstalării și „Resetează datele locale”, deci contrazic `privacy.html` §6.
- **Remediere:**
  1. Criptează backup-ul automat (AES-GCM cu o frază sau cu codul de recuperare) sau scrie-l în `getExternalFilesDir` (se șterge la dezinstalare) și exportă doar la cerere.
  2. Rotește la ultimele N fișiere (MediaStore permite ștergerea fișierelor proprii).
  3. Actualizează politica (vezi secțiunea 3).

### R6. [Mediu] Aplicația web pe originea comună `https://balty1991.github.io`
- **Unde:** `client/src/lib/family-invite.ts:12` (`PUBLIC_SITE_URL`) și `functions/src/index.ts:16` (CORS acceptă toată originea).
- **Scenariu:** `localStorage`/IndexedDB sunt per origine, nu per cale. Orice alt repo GitHub Pages al contului `balty1991` (`balty1991.github.io/altceva/`) rulează pe aceeași origine. Poate citi:
  - `buget-familie:app-data-v6`, adică registrul complet în clar;
  - baza `buget-familie-sync`, adică cheia de familie (`CryptoKey`, utilizabilă direct) și codul invitației în clar.

  Un repo vechi compromis, un PR malițios sau o dependență din alt proiect ajunge la datele financiare ale tuturor utilizatorilor web. Linkurile de invitație deschid tocmai varianta web.
- **Remediere:** un domeniu propriu sau un subdomeniu dedicat (de exemplu `app.bugetfamilie.ro`) și o listă CORS limitată la el.

### R7. [Mediu] „Telefonul lui X”: telefonul copilului are tot registrul și cheia familiei
- **Unde:** `client/src/components/MemberModeScreen.tsx:18-21` (ieșirea cere doar o confirmare), `client/src/lib/member-mode.ts`.
- **Scenariu:** ca să sincronizeze, telefonul copilului intră în camera familiei, deci are cheia completă. Modul doar ascunde interfața. Copilul apasă „Ieși din modul acesta” → „Ieși” și vede tot bugetul, datoriile, invitația (Sync → invitație/QR) și poate face backup în Descărcări.
- **Remediere:** ieșirea să ceară PIN-ul părintelui (există deja `app-lock.ts`), iar Sync/Backup/Invitație să fie ascunse cât modul e activ. Pe termen lung: o cheie separată sau un pachet redus pentru membrii-copil. Vezi și punctul despre public țintă la secțiunea 3.

### R8. [Scăzut] Blocarea cu PIN
- **Unde:** `client/src/lib/app-lock.ts`, `client/src/components/AppLockGate.tsx:39-58`.
- **Probleme:**
  - Nu există limită de încercări sau întârziere crescătoare: 10.000 de combinații, ~0,15–0,3 s fiecare.
  - Widgetul „Poți cheltui azi” (`SpendTodayWidgetProvider.java`) și notificările locale cu sume (`ReminderWorker.java:69-78`, fără `setVisibility`/`setPublicVersion`) afișează sume și când PIN-ul e activ.
  - Lipsește `FLAG_SECURE`, deci miniatura din Recente arată registrul.
  - Relocarea are loc abia după 30 s în fundal.
- **Remediere:**
  1. Backoff exponențial după 5 greșeli.
  2. Cu PIN activ, widgetul să arate „—” și notificările să aibă `VISIBILITY_PRIVATE` cu `setPublicVersion` fără sume.
  3. `FLAG_SECURE` opțional („ascunde în Recente”).

### R9. [Scăzut] `verifyPlayPurchase` și `playRtdn` fără autentificare sau limită
- **Unde:** `functions/src/index.ts` ~l. 728-755 și ~761-775.
- **Detalii:**
  - `playRtdn` nu verifică tokenul OIDC al abonamentului Pub/Sub.
  - `verifyPlayPurchase` nu are App Check, nici rate limit, nici verificare de origine.
  - Tokenul e reverificat la Google, deci nu se pot da beneficii false. Rămân însă spam-ul care consumă cota Android Publisher API (DoS pe verificare) și mutarea unui abonament legitim între camere, dacă tokenul e cunoscut.
- **Remediere:**
  1. Verifică antetul `Authorization` OIDC pe `playRtdn` (sau `invoker` privat plus un cont de serviciu Pub/Sub).
  2. Pe `verifyPlayPurchase`: App Check, `allowPerCaller`, și verificarea `obfuscatedExternalAccountId` față de uid.

### R10. [Scăzut] Stratul web și WebView-ul
- `client/index.html` nu are **Content-Security-Policy**. Nu am găsit `innerHTML`, `eval` sau `dangerouslySetInnerHTML`, iar React escapează conținutul, așa că riscul de XSS e mic. Totuși, o CSP `default-src 'self'` cu `connect-src` limitat (cloudfunctions, firestore, identitytoolkit, securetoken, recaptcha) ar limita exfiltrarea dacă apare vreodată un XSS (conținut sincronizat, backup importat, nume de plic).
- `android/app/src/main/res/xml/file_paths.xml` e prea larg: `external-path "."` și `files-path "."`. Providerul nu e exportat, deci riscul e mic. Merită restrâns la `cache-path` pentru backup-uri.
- `res/xml/config.xml`: `<access origin="*" />` e o moștenire Cordova. Punțile `addJavascriptInterface` (`MainActivity.java:104-106`) sunt vizibile oricărei pagini încărcate în WebView. Acum se încarcă doar conținut local, dar merită un test că navigarea externă se deschide în browser, nu în WebView.
- Lipsesc `android:dataExtractionRules`. Pe Android 12+, `allowBackup=false` nu oprește transferul dispozitiv-la-dispozitiv, deci registrul, cheia de familie și hash-ul PIN migrează. Documentația spune că backup-ul e dezactivat fără această nuanță.
- **Parola familiei stă de fapt pe disc.** Cheia PBKDF2 „neexportabilă” din IndexedDB (`family-session.ts`) e serializată de Chromium cu materialul brut, iar la PBKDF2 materialul brut *este* parola. Nu e exportabilă din JS, dar se poate citi cu acces root sau forensic. Afirmația „Parola nu se salvează” e deci doar parțial adevărată.
- `release { minifyEnabled false }`: nu e o vulnerabilitate, doar un APK mai mare și mai ușor de inspectat.

### R11. [Info] Invitația e o credențială permanentă
Codul `bf1.<room>.<key>` circulă prin WhatsApp. Backup-urile WhatsApp în Google Drive nu sunt E2E implicit. Codul nu expiră: cine îl găsește oricând mai târziu intră în cameră până se face „Mută familia”. Recomandare:
- invitații de unică folosință (un „join token” separat de cheia camerei, rotit după prima utilizare);
- sau, cel puțin, afișarea în Sync a datei ultimei mutări și un îndemn periodic la rotire.

### R12. [Info] Dependențe
- `pnpm audit --prod`: fără vulnerabilități. `functions`: `npm audit --omit=dev`: 0.
- `pnpm audit` complet (inclusiv dev): 80 de vulnerabilități (2 critice, 38 ridicate). Toate sunt în unelte de dezvoltare: `vite`/`rollup` (`server.fs.deny` bypass), `vitest` UI, `tar` (via tailwind oxide), `pnpm` ca devDependency, `lighthouse`/`puppeteer`, `firebase-tools`. Nu ajung în APK.
- Scriptul `dev` folosește `vite --host`, adică expune serverul de dev în LAN, unde bug-urile `server.fs.deny` permit citirea de fișiere. Recomandare: `--host 127.0.0.1` și `pnpm up vite vitest postcss`.

### R13. [Info] Alte observații
- Colecțiile `aiGuideQuota`/`appFeedbackQuota` păstrează `sha256(ora|ip)`. Pentru IPv4 hash-ul e reversibil (2³² încercări), deci e date personale. Nu am găsit TTL: configurează o politică TTL pe câmpul `at` (de exemplu 48 h).
- Metadate vizibile serverului: momentele de activitate ale familiei (`updatedAt`, `createdAt` în clar) și mărimea pachetului, care arată cam câte mișcări sunt. Sunt acceptabile, dar merită menționate.

---

## 3. Confidențialitate și Data safety: inexactități

Documentele verificate: `docs/PLAY_CONSOLE_DATA_SAFETY.md` și `client/public/privacy.html`. În APK există și o copie în `android/app/src/main/assets/public/privacy.html`, care trebuie actualizată la fel.

| # | Afirmație actuală | Realitatea din cod | Ce trebuie schimbat |
|---|---|---|---|
| P1 | privacy §1 și DS §4: rezerva online trimite doar „un rezumat scurt către Google Gemini” | `functions/src/index.ts`, `generateGuide`/`callGroq`: dacă Gemini cade, **același conținut pleacă la Groq (api.groq.com, SUA)**, cu modelele `openai/gpt-oss-*`, `qwen` | Numește Groq ca procesator, cu transfer în afara SEE (clauze contractuale standard). În DS rămâne „nepartajat” doar dacă Groq e procesator în numele tău. |
| P2 | privacy §1: „conversația rămâne pe telefon” | `AICompanion.tsx:622-626`: pleacă **ultimele 20 de mesaje** (serverul păstrează 12), plus mesajul curent | „Când folosești ghidul online, ultimele mesaje ale conversației…” |
| P3 | „niciodată… pozele de bonuri” | Imaginea nu pleacă, dar pleacă **textul OCR brut, până la 5.000 de caractere** (tăiat la 2.000 pe server), plus magazin, dată, produse (`AICompanion.tsx:566-608`). Bonul poate conține ultimele 4 cifre ale cardului, CUI, adresă. | Declară. În DS: *Informații financiare → Istoric de achiziții* colectat opțional. Mai bine, trimite doar total, magazin și categorii. |
| P4 | „Rezumat scurt, nu registrul” | `understand.ts:1166-1204` (`compactGuideContext`): **nume de membri**, solduri pe surse, datorii (nume, sold, rată), venituri așteptate **pe persoană** (`who`), plătitorul fiecărei nevoi | DS: *Informații personale → Nume* (opțional) și *Informații financiare → Alte informații financiare*. |
| P5 | DS §1: informațiile financiare sunt „colectate” fiindcă stau pe dispozitiv | În sensul Play, datele doar locale **nu sunt colectate**. Sync-ul E2E e exceptat. Informațiile financiare **sunt însă colectate** prin ghidul online (P3/P4). | Motivul: ghidul online. Opțional. Scop: funcționalitate. „Procesare efemeră” = Da, doar dacă furnizorii nu păstrează datele; altfel Nu. |
| P6 | DS §2: fotografii „Colectat: Da” | Pozele nu pleacă de pe telefon, deci **nu sunt colectate** în sensul Play | „Nu”, cu o notă că rămân locale. Supradeclararea e acceptată, dar e inexactă. |
| P7 | Nimic despre reCAPTCHA | `realtime-sync.ts:35-48`: App Check cu **reCAPTCHA Enterprise** se inițializează la sync și la ghidul online. Scriptul Google colectează semnale de dispozitiv și de interacțiune. | Menționează în privacy (Google, antifraudă). În DS: *Identificatori de dispozitiv / Interacțiuni* pentru „Prevenirea fraudei”. |
| P8 | privacy §5: „Poți exporta un fișier JSON local” | Există **copie automată săptămânală**, în clar, în Descărcări publice, care rămâne după dezinstalare | Descrie copia automată, locul ei, cine o poate citi și cum se șterge. |
| P9 | privacy §6: „Datele locale rămân până… dezinstalezi” | Backup-urile din Descărcări rămân după dezinstalare și resetare | Corectează și adaugă pasul „șterge fișierele buget-familie-copie-*.json”. |
| P10 | privacy §9: „nu este destinată copiilor sub 13 ani” | Commitul `867bb12` introduce un ecran pentru **telefonul copilului** („Bani de buzunar”) | Decide: fie declari în Play că aplicația nu e pentru copii (ecranul e folosit de părinte pentru copil, fără date colectate de la copil), fie intri sub politica Families. Acum e o contradicție care poate duce la respingere. |
| P11 | privacy §4: `SCHEDULE_EXACT_ALARM` | Scos din manifest (`tools:node="remove"`) | Scoate-l din listă. Adaugă `READ/WRITE_EXTERNAL_STORAGE` (≤ API 32/28) folosite pentru backup. |
| P12 | privacy §3: Umami | Nu există cod Umami în client | Scoate paragraful sau păstrează-l ca „nu folosim”. |
| P13 | DS §3: la sync ajunge un „ID cameră aleator” | Camerele vechi au ID = SHA-256(parolă) (privacy §1 o spune corect, DS nu) | Aliniază textul. |
| P14 | DS §D și §E: „Schimbați parola (≥12 caractere)” | Fluxul actual e „Revocă” plus „Mută familia” pe invitație | Actualizează. |
| P15 | Nimic despre IP | Funcțiile procesează IP-ul pentru limite (`aiGuideQuota`, `appFeedbackQuota`, hash reversibil) | Menționează: IP folosit pentru securitate, păstrat X ore. |
| P16 | Nimic despre ce apare pe ecran | Widgetul arată suma zilei, iar notificările arată sume și cheltuielile partenerului | O frază în privacy (vizibilitate pe ecranul principal și de blocare). Nu e „colectare”. |
| P17 | DS: backup Android dezactivat | Pe Android 12+ transferul dispozitiv-la-dispozitiv rămâne activ fără `dataExtractionRules` | Adaugă `dataExtractionRules` sau nuanțează textul. |
| P18 | Partajarea pe WhatsApp a rezumatului săptămânal | E inițiată de utilizator, deci nu e „partajare” în sensul Play | O frază în privacy. |
| P19 | Gemini | Dacă `GEMINI_API_KEY` e pe nivelul gratuit, termenii Google pentru serviciile neplătite permit folosirea conținutului pentru îmbunătățirea produselor și revizuire umană (verifică dacă se aplică excepția SEE pentru contul tău). | Folosește un plan plătit sau Vertex AI în UE (`europe-central2`/`europe-west`) și menționează-l. |

Ce rămâne corect: fără reclame, fără vânzare de date, feedback opțional (text, contact opțional, date tehnice, uid anonim), ID anonim Firebase, criptare în tranzit (HTTPS peste tot), ștergere la cerere prin email.

---

## 4. Performanță

### 4.1 Cum am măsurat
- Build de producție `GITHUB_PAGES=true vite build`, servit cu `vite preview` pe portul 5190. Serverul a fost oprit după măsurători.
- Chromium headless, viewport mobil 390×844, CPU încetinit de 6× (CDP), rețea „slow 4G” (150 ms RTT, 1,6 Mbps down / 750 kbps up), cache dezactivat, service worker blocat, gazdele externe blocate.
- Date: 5.000 de mișcări pe 18 luni, 8 plicuri, 2 scadențe, o datorie (1,24 MB JSON), puse direct în `localStorage` și IndexedDB.
- Profilare CPU pe serverul de dev (nume neminificate), plus micro-benchmark-uri pe modulele reale.
- **Rezervă:** e un desktop încetinit, nu un telefon Android real. În APK activele se încarcă local, deci partea de rețea contează doar pentru web.

### 4.2 Pornire

| Scenariu | FCP | „LCP”* | Titlu vizibil (`#root h1`) | Splash dispărut | TTI** | TBT | Long tasks (nr / max / Σ) | JS pornire (transfer / decodat) | CSS decodat | Heap |
|---|---|---|---|---|---|---|---|---|---|---|
| Prima pornire (onboarding) | 1,36 s | 1,36 s | 2,56 s | 2,67 s | 3,55 s | 558 ms | 5 / 207 / 858 ms | 191 / 595 KB | 671 KB | 2,4 MB |
| Setup făcut, registru gol | 1,34 s | 1,34 s | 2,44 s | 2,45 s | 3,90 s | 766 ms | 5 / 535 / 1.066 ms | 182 / 568 KB | 671 KB | 2,6 MB |
| **Setup + 5.000 mișcări** | 1,44 s | 1,44 s | **4,38 s** | 4,45 s | **10,7 s** | **7.137 ms** | **16 / 2.428 / 7.949 ms** | 182 / 568 KB | 671 KB | 7,1 MB (9,1 MB după navigare) |

\* LCP-ul raportat e imaginea de splash `#bf-boot img`, deci **înșelător**: Lighthouse va raporta tot splash-ul. Momentul real în care apare conținutul e coloana „Titlu vizibil”.
\** TTI aproximat: sfârșitul ultimului long task (fereastră de liniște de 15 s).

- JS la pornire: `index` 357 KB + `react-runtime` 195 KB + `local-notifications` 16 KB (decodat). `family-sync` (649 KB), `jspdf` (390 KB), `html2canvas` și `i18n-en` (270 KB) se încarcă leneș. Bine.
- CSS: `index` 265 KB blochează randarea, iar `deferred-styles` are încă 422 KB. E mult pentru o singură pagină și costă la style recalc la fiecare schimbare de temă sau ecran.
- Memoria e mică și stabilă (7–9 MB heap JS cu 5.000 de mișcări). Nu am văzut scurgeri pe navigările repetate.

### 4.3 Navigare cu 5.000 de mișcări (CPU 6×, fără limitare de rețea)

| Pas | clic → cadru pictat | cel mai lung eveniment (Event Timing) | long tasks în 2,5 s |
|---|---|---|---|
| Astăzi → Plan (prima dată) | 372 ms | 248 ms | 108, **819**, 368, 191 |
| Plan → Mișcări | 692 ms | 56 ms | 50, 386, **1.300**, 69 |
| Mișcări → Astăzi | **2.160 ms** | 144 ms | 80, **1.491**, 460, **1.938** |
| Astăzi → Plan (a doua oară) | 1.269 ms | **1.496 ms** | 881, 205, 79 |
| Plan → Mișcări | 469 ms | 72 ms | 250, **1.013**, 451 |
| Mișcări → Astăzi | **2.052 ms** | 88 ms | **1.022**, 298, 148 |

Concluzie: cu un registru mare, **Astăzi și Plan nu mai sunt receptive**. Au blocaje de 1–2 s la fiecare intrare, deci INP „poor” (peste 500 ms). Mișcările e acceptabil la randare fiindcă paginează 30 de zile, dar are 1–1,3 s de lucru în urma fiecărei navigări.

### 4.4 Unde se duce timpul

Micro-benchmark-uri pe 5.000 de mișcări, CPU 6×, pe modulele reale:

| Operație | ms |
|---|---|
| `isoToday()` **cu** fus de familie setat (implicit la toți: `Home.tsx:109`) | **0,89 ms/apel** (894 ms / 1.000 de apeluri) |
| `isoToday()` fără fus | 0,005 ms/apel |
| `buildTodaySummary` | **580** |
| `detectSubscriptions` | 167 |
| `todayBrief` | 151 |
| `normalizeAppData(JSON.parse)` | 182 (+54 parse) |
| `allocationWeeksStatus` pe toate cele 8 plicuri | 56 |
| `allocationStatus` pe 8 plicuri | 6 |
| `localStorage.setItem` 1,2 MB | 109 |
| `structuredClone` (scrierea IDB) | 93 |
| `JSON.stringify` registru | 46 |
| `encryptFamilyData` (sync) | 776 |
| `decryptFamilyData` | 1.300 |
| `mergeFamilyData` | 215 |

Profilul CPU (timp inclusiv, fără încetinire, dev) confirmă aceleași zone fierbinți:
- **Pornire:** `TodayView` 866 ms, `todayBrief` 565, `allocationWeeksStatus` 540, `buildTodaySummary` 338, `detectSubscriptions`/`subscriptionKey` 335/268, `weeklyEnvelopeDailyRhythm` 198, `weekTooFast`/`weekDayCap` 180, `planCycle` 172, `advisorSignals` 147, `statementMerchant` 137.
- **Revenirea pe Astăzi:** aceleași funcții, plus `isoToday`/`isoDateInZone` ~60 ms doar pe ele.

**Blocaje și remedieri, în ordinea câștigului:**

1. **`isoDateInZone` creează un `Intl.DateTimeFormat` la fiecare apel** (`finance-data.ts:238-243`), iar `isoToday()` apare ca valoare implicită de parametru în funcțiile chemate în bucle (`allocationWeekStatus`, `envelopeDecisionStatus`, 26 de apeluri în `household-insights.ts`, 21 în `finance-data.ts`).
   Remediere:
   - un `Map<zone, Intl.DateTimeFormat>` în cache;
   - `isoToday` memoizat pe minut (sau calculat o dată pe randare și dat mai departe).

   Câștig estimat: **sute de ms per randare** la 6×. Efortul e de câteva linii.
2. **`allocationWeeksStatus` e O(săptămâni × N)**: `data.transactions.filter` pentru fiecare săptămână (`finance-data.ts:1025-1060`). În plus, `allocationWeekStatus` recalculează toate săptămânile ca să întoarcă una, iar funcția e chemată de mai multe ori pe plic și pe randare (`todayBrief`, `weekDayCap`, `weekTooFast`, `weeklyEnvelopeDailyRhythm`, `envelopeDecisionStatus`).
   Remediere: o singură trecere prin mișcările din perioada planului (filtrare o dată pe `periodStart…cover`), împărțită pe săptămâni cu căutare binară pe index, plus un cache `WeakMap<AppData, …>` pe randare.
3. **Analizele de pe Astăzi nu sunt memoizate** (`TodayView.tsx:241-247`, `TodayBrief.tsx:22`, `advisorSignals`, `detectSubscriptions`). Se recalculează la orice randare a lui Home, inclusiv la schimbarea ecranului.
   Remediere:
   - `useMemo([data, today])` pe fiecare;
   - `detectSubscriptions` și `todayBrief` amânate după primul cadru (`requestIdleCallback`/`startTransition`) sau mutate într-un Web Worker;
   - `subscriptionKey`/`statementMerchant` precalculate o dată pe mișcare (cache pe `id + title`).

   Comentariul din `finance-data.ts:866-874` spune că registrul „este modificat pe loc pe alocuri”, deci memoizarea pe identitate nu e sigură. Merită eliminate mutațiile ca să devină posibilă.
4. **Pornirea face de două ori tot lucrul greu** (`usePersistAppData.ts:18-89`):
   - parse și normalizare sincrone din LS înainte de primul cadru;
   - apoi citire IDB, normalizare din nou și `adoptOutsideExpenses`;
   - apoi efectul de salvare rescrie tot registrul (LS `setItem` 109 ms + `structuredClone` 93 ms + două `JSON.stringify`), deși nu s-a schimbat nimic;
   - apoi `autoPostDueRecurring` mai declanșează o scriere.

   Remediere:
   - compară hash-ul și nu rescrie când e același;
   - normalizează o singură dată;
   - păstrează în LS doar un „head” mic (Astăzi, sold, plicuri) pentru primul cadru, iar registrul complet doar în IDB;
   - la pornire, randează Astăzi din head și hidratează restul după primul cadru.
5. **Sync-ul la fiecare modificare**: `syncPortable` (stringify complet) de 2–3 ori, PBKDF2 250k plus criptarea întregului registru (776 ms la 6×) și upload de 1–1,7 MB. La primire: decriptare de 1,3 s și merge de 215 ms.
   Remediere:
   - derivează cheia AES o dată pe sesiune (salt stabil per cameră, păstrat în pachet) în loc de PBKDF2 la fiecare push;
   - comprimă;
   - bucăți pe lună (vezi R1).
6. **CSS de 687 KB** (265 blocant + 422 amânat): elimină regulile moarte (PurgeCSS sau Tailwind content) și împarte pe ecran.
7. **LCP pe splash**: splash-ul HTML e LCP-ul, deci metricile Lighthouse din `scripts/lighthouse.mjs` arată mai bine decât realitatea. Urmărește în CI o metrică proprie (`performance.mark('bf-today-painted')`).

---

## 5. Recomandări prioritizate

**Înainte de lansarea în Play (blocante):**
1. Corectează politica de confidențialitate (și copia din APK) și Data safety: P1–P5, P7–P10, P19. Mai ales Groq, textul OCR, numele membrilor, conversația, backup-urile automate și contradicția cu copiii.
2. Decide poziția față de copii (P10/R7): PIN la ieșirea din „Telefonul lui X” și ascunderea Sync/Backup/Invitație în acest mod.
3. Pune o limită de mărime și compresie pe pachetul de sync (R1). Altfel, familiile active pierd sincronizarea în primul an sau al doilea, fără mesaj clar.
4. Repară limitele `aiGuide` (R2): IP-ul din XFF, fail-closed, plafon global. Restricționează cheia API Firebase în GCP.

**Imediat după lansare:**

5. App Check Enforce pe Firestore și Functions (Play Integrity pe Android), plus alerte de buget GCP (R2, R3).
6. Backup automat criptat sau în `getExternalFilesDir`, cu rotație (R5).
7. `isoToday`/`Intl.DateTimeFormat` în cache, apoi `allocationWeeksStatus` într-o singură trecere, apoi memoizare sau amânare pentru analizele de pe Astăzi (4.4 punctele 1–3). Câștig estimat: Astăzi de la ~2 s la sub 300 ms cu 5.000 de mișcări pe un telefon slab.
8. Pornire fără rescriere și fără dublă normalizare (4.4 punctul 4).
9. Migrare forțată a camerelor cu parolă pe invitație; ștergerea `generateFamilyPassword` (R4).

**Pe termen mediu:**

10. Domeniu propriu pentru aplicația web și CORS restrâns (R6).
11. Membri legați de uid în regulile Firestore (R3); invitații de unică folosință (R11).
12. PIN cu backoff; widget și notificări fără sume când PIN-ul e activ; `FLAG_SECURE` opțional (R8).
13. CSP în `index.html`, `file_paths.xml` restrâns, `dataExtractionRules`, OIDC pe `playRtdn` (R9, R10).
14. TTL pe colecțiile de cotă; actualizarea dependențelor de dev (vite, vitest, postcss); `vite --host 127.0.0.1` (R12, R13).
15. CSS redus; metrică proprie „Astăzi pictat” în CI.

---

### Anexă: fișiere de lucru (scratch)
Toate sunt în `/tmp/claude-0/-home-user-buget-familie/6251941a-2f52-5fdd-bb21-2d9641b66e0b/scratchpad/agents/secperf/`:

| Fișier | Ce conține |
|---|---|
| `measure.mjs` | script de măsurare a pornirii și navigării |
| `results-*.json` | rezultatele măsurătorilor |
| `profile.mjs`, `profile-dev.json` | profilul CPU |
| `bench.mjs`, `bench.json` | micro-benchmark-uri |
| `envsize.mjs` | mărimea pachetului de sync |
| `seed.mjs`, `seed-5000.json` | datele de test |
| `net.mjs` | verificarea că la pornire nu există trafic extern |
| `dist/` | build-ul de producție |
