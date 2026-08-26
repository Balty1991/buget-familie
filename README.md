# Buget Familie

**Buget Familie** este o aplicație PWA pentru administrarea banilor unei familii. Interfața este publicată prin GitHub Pages, iar sincronizarea protejată salvează doar un pachet financiar criptat într-un repo GitHub privat separat.

## Funcții implementate

| Domeniu | Funcție disponibilă |
|---|---|
| Panou financiar | Indicatori calculați din registrul real; o stare depășită este semnalată explicit, fără a fi mascată ca disponibil. |
| Mișcări | Adăugare, editare și ștergere de venituri și cheltuieli. Fiecare intrare are dată ISO, membru, sursă de plată și categorie. |
| Membri și surse | Membri configurabili, carduri nominale, cash, bonuri de masă, transferuri și categorii precum Taxi. |
| Plan până la salariu | Data următorului venit, limită totală, limită săptămânală calculată, zile rămase și alocări pe membri sau categorii. |
| Statistici | Venituri, cheltuieli și diferență pentru anul curent; evoluție lunară și categorii extrase din registru. |
| Scadențe recurente | Facturi, rate și contribuții rezervate până la salariu; apăsarea „Plătită” creează cheltuiala reală din sursa aleasă. |
| Datorii și economii | Adăugare, editare, ștergere și calcule de progres. |
| Bonuri mobile | Maximum două fotografii comprimate local, OCR local pentru produse și prețuri individuale, categorii sugerate și repartizare editabilă; liniile trebuie să egaleze totalul înainte de salvare. |
| Asistent | Analiză locală explicabilă pentru cheltuieli, datorii, obiective, limite și alocări. |
| Aspect și control | Temă întunecată, resetare controlată și export/import de rezervă. |
| Familie conectată | Pachet AES-GCM criptat local într-un repo privat, actualizat prudent între telefoane cât aplicația rămâne deschisă. |

> Aplicația începe fără date demo. Datele sunt locale până când alegi explicit exportul sau sincronizarea.

## Modelul de calcul v8

Aplicația păstrează un singur registru drept sursă de adevăr. Soldul afișat pentru o sursă de plată este **soldul inițial plus venituri minus cheltuieli** atribuite acelei surse. Planul include numai cheltuielile cu dată din intervalul ales; alocările personale sau pe categorii sunt consumate din aceleași intrări, nu dintr-un total separat. O scadență recurentă activă se rezervă separat în plan până când este confirmată; confirmarea creează o singură cheltuială legată, pentru a evita dubla numărare.

> Soldul inițial reprezintă punctul de pornire introdus de familie. În versiunea actuală nu este un extras bancar reconciliat pe o dată istorică; de aceea, utilizați-l ca bază de pornire la configurare și actualizați-l atent după importuri vechi.

## Familie conectată și sincronizare GitHub protejată

Aplicația publică este `Balty1991/buget-familie`. Repo-ul separat `Balty1991/buget-familie-date` este privat și stochează numai un pachet deja criptat în browser. Tokenul GitHub și parola de criptare nu sunt păstrate în local storage sau în repo-ul public.

| Pas | Acțiune |
|---|---|
| 1 | Creează un **fine-grained personal access token** limitat strict la repo-ul `buget-familie-date`. |
| 2 | Acordă numai permisiunea **Contents: Read and write**. |
| 3 | În aplicație, deschide **Mai mult → Sincronizare** și introdu tokenul doar pentru sesiunea curentă. |
| 4 | Alege o parolă de familie de cel puțin 12 caractere; ea criptează datele prin AES-GCM înainte de upload. |
| 5 | Pe fiecare telefon, introdu un token limitat separat și aceeași parolă, apoi apasă **Conectează acest telefon**. |

După conectare, aplicația verifică actualizări aproximativ la 30 de secunde cât rămâne deschisă, unește intrările prin ID și marcaj de actualizare și păstrează ștergerile pentru a evita reapariția datelor eliminate. GitHub Contents API oferă controlul de conflict prin SHA, dar această soluție rămâne o actualizare periodică, nu un canal instantaneu în fundal. Fotografiile bonurilor sunt excluse intenționat din pachetul remote și rămân locale. Manualul pas cu pas este în **Mai mult → Ghid**.

## Limite importante

| Cerință | Această versiune GitHub-only |
|---|---|
| CRUD financiar, planificare, temă și analize | Da, local în browser. |
| Copie între telefoane | Da, prin export/import sau pachet criptat în repo privat. |
| Sincronizare automată în timp real | Actualizare periodică aproximativ la 30 s cât aplicația este deschisă; nu există actualizare garantată în fundal. |
| Fotografii ale bonurilor | Maximum două pe bon, comprimate local; fotografiile rămân locale și nu intră în pachetul GitHub. |
| Asistent LLM extern | Nu; GitHub Models a fost retras. Asistentul actual este local și explicabil. |

Datele financiare necriptate, bonurile și cheile nu trebuie comise în repo-ul public sau incluse în artefactele GitHub Pages. GitHub avertizează că Pages este public și nu trebuie utilizat pentru tranzacții sensibile.[^pages]

## Rulare locală

```bash
pnpm install
pnpm dev
pnpm check
pnpm build
pnpm exec vitest run client/src/lib/finance-data.test.ts
```

Testele de regresie verifică parserul românesc pentru sume, migrarea defensivă a datelor vechi, calculul soldului derivat, consumul alocărilor, scadențele recurente și merge-ul defensiv dintre două copii familiale.

## Android APK

Aplicația păstrează GitHub Pages pentru acces web și este pregătită separat pentru Android cu **Capacitor**. În GitHub, deschide **Actions → Build Android APK → Run workflow**. După rularea verde, descarcă artefactul `buget-familie-debug-apk` și instalează fișierul `app-debug.apk` pe un telefon Android. Pachetul debug este pentru testare privată; nu necesită chei de semnare și nu este pentru Google Play.

| Comandă | Utilizare |
|---|---|
| `pnpm run cap:sync` | Construiește React/Vite și copiază bundle-ul în proiectul Android. |
| `pnpm run cap:android` | Sincronizează și deschide proiectul Android în Android Studio. |
| `cd android && ./gradlew assembleDebug` | Generează local un APK debug după instalarea Android SDK. |

Un pachet pentru Google Play va necesita ulterior un AAB semnat și un keystore păstrat doar în GitHub Secrets. Nu introduce parole de sincronizare, tokenuri GitHub sau date financiare în setările de build.

[^pages]: [GitHub Docs — GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
