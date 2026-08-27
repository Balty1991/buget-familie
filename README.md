# Buget Familie

**Buget Familie** este o aplicație PWA pentru administrarea banilor proprii sau ai unei gospodării. Interfața este publicată prin GitHub Pages, iar sincronizarea protejată, complet opțională, salvează doar un pachet financiar criptat într-un repo GitHub privat separat.

## Funcții implementate

| Domeniu | Funcție disponibilă |
|---|---|
| Spațiu de lucru mobil | Navigație primară pe cinci trasee: **Astăzi**, **Mișcări**, **Plan**, **Obligații** și **Analiză**, reproiectată ca Ledger Flow: situația curentă, instrumentul de lucru și decizia următoare au niveluri vizuale distincte. Utilitarele rare rămân în zona separată de instrumente, astfel încât bara telefonului servește activitatea zilnică. |
| Astăzi și bilanț | Bandă de marjă până la venit, următoarea decizie, măsurători de surse/obligații/plicuri și activitate recentă, toate calculate din registrul real. |
| Mișcări | Adăugare, editare și ștergere de venituri și cheltuieli într-o cronologie grupată pe zile, cu totaluri zilnice. Căutarea locală găsește titlul, categoria, sursa, membrul, notița ori suma, iar intervalul „De la / Până la” se combină cu toate filtrele și arată numărul de rezultate. Poți salva maximum opt filtre locale, le poți aplica, redenumi sau șterge și poți descărca în CSV numai rândurile vizibile; filtrarea și exportul rămân locale. |
| Captură rapidă și săptămână | Foaia „Înregistrare rapidă” salvează o mișcare reală cu suma, categoria, membrul și sursa. Combinațiile frecvente pot fi memorate, actualizate, arhivate pe lună, restaurate sau șterse definitiv ca șabloane numai pe telefonul curent; nu afectează tranzacțiile deja confirmate. Jurnalul arată recapitularea curentă luni–duminică, cu perspectivă Familie/Membru, venituri, cheltuieli, diferență și categorii principale. |
| Profil, membri și surse | Poate fi folosită de o singură persoană de la prima deschidere sau cu membri configurabili, carduri nominale, cash, bonuri de masă, transferuri și categorii precum Taxi. |
| Plan până la venit | Data estimată a următorului venit, prima dată posibilă opțională, limită totală, limită săptămânală calculată, zile rămase și alocări. Calculatorul „Împarte perioada pe săptămâni reale” permite alegerea manuală a începutului, sfârșitului și sumei, apoi arată săptămânile complete și tranșa finală parțială înainte de aplicare. Când există un interval, toate calculele folosesc prudent prima dată posibilă. Regulile de venit pot propune sume fixe sau procente către plicuri compatibile; utilizatorul previzualizează, confirmă și poate anula aplicarea, fără ca aplicația să transfere bani ori să modifice registrul. |
| Plicuri de categorie | O categorie precum Transport/Taxi poate avea un buget, o sursă, un membru opțional și un detaliu. De exemplu, Transport poate fi împărțit în Soție 430 RON și Eu 70 RON; fiecare cheltuială compatibilă consumă plicul exact, iar tabloul plicurilor se poate filtra după Familie sau fiecare membru. |
| Puls, alerte și realocări | Fiecare plic are un prag de atenție configurabil de la 50% la 95%; depășirea rămâne la 100%. Plicurile au bare interactive, selectare de detaliu, bandă vizuală locală în ecranul Astăzi, istoric filtrabil al realocărilor și transfer doar între categorii finanțate din aceeași sursă. Alertele nu trimit bani, nu cer acces bancar și nu rulează când aplicația este închisă. |
| Analiză, alerte și PDF | Comparație cu luna precedentă, evoluție lunară în anul curent, grafic interactiv de distribuție pe categorii, poziție financiară și plicuri la prag de atenție ori depășite. Bilanțul poate fi descărcat ca PDF pentru o lună și perspectiva Familie/Membru, generat local în browser. |
| Scadențe recurente | Chirie, abonamente, facturi, rate și contribuții pot rămâne pe confirmare manuală sau pot fi adăugate automat o singură dată la prima deschidere din ziua scadenței; ziua 31 se adaptează la ultima zi din lunile scurte. |
| Datorii și economii | Adăugare, editare, ștergere protejată, proprietar opțional (familie sau membru) și calcule de progres. O rată poate fi confirmată dintr-o sursă reală: creează cheltuiala în Jurnal, reduce automat soldul aceleiași datorii și păstrează istoricul „plată parțială” sau „achitată integral”. |
| Bonuri mobile | Maximum două fotografii comprimate local, OCR local pentru produse și prețuri individuale, categorii sugerate și repartizare editabilă; liniile trebuie să egaleze totalul înainte de salvare. |
| Asistent de decizie | Analiză locală explicabilă pentru cheltuieli, datorii, obiective, limite și alocări; include ritm zilnic, proiecție până la venit, întrebări rapide și calcule directe, de exemplu buget săptămânal împărțit pe zi. Se încarcă numai când este deschis. |
| Simulator conversațional | Interpretează local formulări precum „Dacă plătesc 120 lei pe taxi mâine”, previzualizează suma, categoria și momentul, apoi estimează marja până la venit fără să creeze sau modifice vreo mișcare. |
| Economisire explicabilă | Evidențiază ritmul, categoria dominantă, rezervele pentru scadențe și marja pentru obiective, exclusiv din registrul și planul curent. |
| Aspect și control | Selector persistent cu Porcelain Studio (zi editorială), Aurora Moss (seară organică), Ultraviolet Grid (noapte digitală) și Ember Ledger (cald tactil). Include previzualizare mare, program local evaluat cât aplicația rămâne deschisă și contrast extra-ridicat. Fiecare temă schimbă fundalul, geometria suprafețelor, accentele și navigația, iar semnificația veniturilor, cheltuielilor și alertelor rămâne aceeași. Include monogramă B/F cu relief și favicon aferent, resetare controlată și export/import de rezervă. |
| Familie conectată | Pachet AES-GCM criptat local într-un repo privat, actualizat prudent între telefoane cât aplicația rămâne deschisă. |

> Aplicația începe fără date demo. Datele sunt locale până când alegi explicit exportul sau sincronizarea.

## Modelul de calcul v11

Aplicația păstrează un singur registru drept sursă de adevăr. Soldul afișat pentru o sursă de plată este **soldul inițial plus venituri minus cheltuieli** atribuite acelei surse. Planul include numai cheltuielile cu dată din intervalul ales; alocările personale sau pe categorii sunt consumate din aceleași intrări, nu dintr-un total separat. O scadență recurentă activă se rezervă separat în plan până când este confirmată; confirmarea creează o singură cheltuială legată, pentru a evita dubla numărare.

> Un **plic de categorie** nu mută bani într-un sold separat. El definește o limită verificabilă pe o categorie și, opțional, pe o sursă, de exemplu „Transport, 500 RON, Card debit”. La salvarea unei cheltuieli compatibile, aceeași intrare din registru scade atât soldul Cardului debit, cât și suma rămasă în plic.

> O **realocare** între plicuri modifică numai limitele interne ale celor două categorii. Ea nu creează o cheltuială, nu mișcă bani între card și cash și nu schimbă soldul unei surse. Pentru claritate, sunt permise doar între plicuri de categorii finanțate din aceeași sursă.

> **Prognoza nu schimbă bugetul.** Ea folosește cheltuielile deja înregistrate până azi, zilele rămase, limita planului și rezervele recurente pentru a arăta ritmul zilnic curent, ritmul sigur și suma proiectată până la următorul venit. Este o estimare explicabilă, nu o garanție și nu o recomandare de investiții.

> Când venitul intră de regulă într-o zi, dar poate veni mai devreme, se salvează atât data estimată, cât și **prima dată posibilă**. Planul, plicurile, scadențele rezervate și prognoza se opresc la prima dată posibilă pentru a nu considera bani care ar putea să nu fie încă disponibili.

> **Bilanțul nu dublează valorile.** Fluxul perioadei este venit minus cheltuieli înregistrate; ratele sunt obligații declarate, datoria rămasă este o valoare de pasiv, iar economiile sunt expuse separat. Poziția lichidă netă este soldurile utilizabile minus datoria rămasă.

> O **plată de rată** se confirmă manual cu suma, data, membrul și sursa de plată. Aplicația creează o cheltuială reală în categoria „Rate produse” și reduce soldul acelei datorii cu exact aceeași sumă; nu poate depăși soldul rămas și nu inițiază plăți bancare.

> Soldul inițial reprezintă punctul de pornire introdus de familie. În versiunea actuală nu este un extras bancar reconciliat pe o dată istorică; de aceea, utilizați-l ca bază de pornire la configurare și actualizați-l atent după importuri vechi.

> **Automatizarea recurentă rulează când aplicația este deschisă.** Pentru fiecare cheltuială activată, aplicația creează local o singură mișcare cu ID stabil pentru luna și data scadentă. Nu rulează în fundal când browserul sau aplicația este închisă și nu poate efectua plăți bancare.

## Performanță mobilă

Componentele de Plan, Analiză, scadențe, OCR, asistent și captura rapidă sunt încărcate la cerere. Generatorul PDF este încărcat numai după apăsarea exportului, nu la prima deschidere a aplicației. Runtime-ul React și iconițele sunt separate în fișiere cacheabile; Planul, rapoartele și asistentul rămân în module separate. Bundle-ul principal rămâne monitorizat pentru următoarele separări funcționale.

## Teme memorate

Butonul de paletă din antet deschide alegerea temei și păstrează opțiunea local pe dispozitiv. **Porcelain Studio** combină porțelanul rece cu grilă de cobalt; **Aurora Moss** folosește reflexe organice în verde; **Ultraviolet Grid** combină indigo, violet și cyan, iar **Ember Ledger** folosește cărbune fumuriu și cupru ars. Textul, controalele și graficele sunt proiectate pentru contrast, iar coralul rămâne rezervat situațiilor de atenție.

## Familie conectată și sincronizare GitHub protejată

Aplicația publică este `Balty1991/buget-familie`. Repo-ul separat `Balty1991/buget-familie-date` este privat și stochează numai un pachet deja criptat în browser. Tokenul GitHub și parola de criptare nu sunt păstrate în local storage sau în repo-ul public.

| Pas | Acțiune |
|---|---|
| 1 | Creează un **fine-grained personal access token** limitat strict la repo-ul `buget-familie-date`. |
| 2 | Acordă numai permisiunea **Contents: Read and write**. |
| 3 | În aplicație, deschide **Mai mult → Sincronizare** și introdu tokenul doar pentru sesiunea curentă. |
| 4 | Alege o parolă de familie de cel puțin 12 caractere; ea criptează datele prin AES-GCM înainte de upload. |
| 5 | Pe fiecare telefon, introdu un token limitat separat și aceeași parolă, apoi apasă **Conectează acest telefon**. |

După conectare, aplicația verifică actualizări aproximativ la 30 de secunde cât rămâne deschisă, unește intrările prin ID și marcaj de actualizare și păstrează ștergerile — inclusiv scadențele recurente — pentru a evita reapariția datelor eliminate. GitHub Contents API oferă controlul de conflict prin SHA, dar această soluție rămâne o actualizare periodică, nu un canal instantaneu în fundal. Fotografiile bonurilor, filtrele salvate și șabloanele active/arhivate sunt excluse intenționat din pachetul remote și rămân locale. Manualul pas cu pas este în **Mai mult → Ghid**.

## Limite importante

| Cerință | Această versiune GitHub-only |
|---|---|
| CRUD financiar, planificare, temă și analize | Da, local în browser. |
| Copie între telefoane | Da, prin export/import sau pachet criptat în repo privat. |
| Sincronizare automată în timp real | Actualizare periodică aproximativ la 30 s cât aplicația este deschisă; nu există actualizare garantată în fundal. |
| Modificări simultane ale aceluiași plan | Plicurile și realocările sunt salvate împreună cu planul; pentru a evita pierderea unei modificări, sincronizează înainte de a modifica același plan pe alt telefon. |
| Fotografii ale bonurilor | Maximum două pe bon, comprimate local; fotografiile rămân locale și nu intră în pachetul GitHub. |
| Asistent LLM extern | Nu; GitHub Models a fost retras. Asistentul actual este local și explicabil. |
| Plata unei rate | Confirmare manuală în aplicație; actualizează registrul și soldul datoriei, păstrând suma, sursa, data și statutul parțial/integral în istoric; nu trimite bani și nu poate accesa banca. |
| Export PDF | Generat și descărcat local la cerere, pentru luna și perspectiva selectate; datele nu sunt trimise unui serviciu extern. |

Datele financiare necriptate, bonurile și cheile nu trebuie comise în repo-ul public sau incluse în artefactele GitHub Pages. GitHub avertizează că Pages este public și nu trebuie utilizat pentru tranzacții sensibile.[^pages]

## Rulare locală

```bash
pnpm install
pnpm dev
pnpm check
pnpm build
pnpm exec vitest run client/src/lib/finance-data.test.ts
```

Testele de regresie verifică parserul românesc pentru sume, plata parțială și finală a unei rate, legătura ratei cu datoria și soldul rămas, filtrul de bilanț pe membru, migrarea defensivă a datelor vechi, șabloanele active și arhivate, filtrele locale salvate, exportul CSV sigur, recapitularea săptămânală Familie/Membru, plicurile pe surse și membri, realocarea limitelor, regulile reversibile de repartizare a veniturilor, împărțirea calendaristică exactă pe 4 și 4½ săptămâni, pragurile configurabile de alertă, prima dată posibilă a venitului, scadențele recurente automate și ștergerea lor sincronizabilă, proiecția de ritm, interpretarea locală a unui scenariu natural, sugestiile explicabile și merge-ul defensiv dintre două copii familiale.

## Android APK

Aplicația păstrează GitHub Pages pentru acces web și este pregătită separat pentru Android cu **Capacitor**. În GitHub, deschide **Actions → Build Android APK → Run workflow**. După rularea verde, descarcă artefactul `buget-familie-debug-apk` și instalează fișierul `app-debug.apk` pe un telefon Android. Pachetul debug este pentru testare privată; nu necesită chei de semnare și nu este pentru Google Play.

| Comandă | Utilizare |
|---|---|
| `pnpm run cap:sync` | Construiește React/Vite și copiază bundle-ul în proiectul Android. |
| `pnpm run cap:android` | Sincronizează și deschide proiectul Android în Android Studio. |
| `cd android && ./gradlew assembleDebug` | Generează local un APK debug după instalarea Android SDK. |

Un pachet pentru Google Play va necesita ulterior un AAB semnat și un keystore păstrat doar în GitHub Secrets. Nu introduce parole de sincronizare, tokenuri GitHub sau date financiare în setările de build.

[^pages]: [GitHub Docs — GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
