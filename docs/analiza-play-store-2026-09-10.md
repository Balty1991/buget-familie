# Analiza concurenței din Google Play și direcții de dezvoltare

**Data:** 10 septembrie 2026
**Continuă:** `docs/analiza-concurenta-roadmap-2026-09.md`, care compară produsele de buget la nivel de funcții. Documentul de față privește aceleași produse din perspectiva **magazinului Play**: ce așteaptă un utilizator Android, ce apare în recenzii și ce se poate împrumuta fără a pierde poziționarea de confidențialitate.

## Metodă și limite

Paginile `play.google.com` nu sunt accesibile din mediul în care a fost făcută analiza, așa că funcțiile și pozițiile de mai jos provin din paginile oficiale ale producătorilor și din comparative independente publicate în 2026, nu din listările Play citite direct. Notele, numărul de descărcări și prețurile variază pe țară și pe plan și **trebuie reverificate în magazin înainte de orice decizie de produs**. Ce este afirmat despre Buget Familie provine din citirea codului acestui depozit.

## Concluzie executivă

Pe Play, competiția se împarte în două tabere care aproape nu se ating:

1. **Viteza de introducere.** Monefy și 1Money câștigă recenzii pentru că o cheltuială se adaugă în două atingeri, offline, fără cont. Profunzimea bugetului este mică; asta nu îi împiedică să fie printre cele mai recomandate.
2. **Automatizarea.** Wallet by BudgetBakers conectează bănci europene; o categorie întreagă de aplicații mai mici citește notificările bancare direct pe telefon și propune cheltuiala fără nicio conexiune la bancă.

Buget Familie nu concurează astăzi în niciuna dintre ele. Are profunzime peste medie — plicuri pe ciclu salarial, surse, membri, obligații, bonuri cu OCR local, sincronizare criptată — dar introducerea unei cheltuieli cere deschiderea aplicației, iar nimic nu se completează singur.

**Recomandarea:** nu adăugăm funcții noi de analiză. Următoarele două tranșe ar trebui să reducă *frecarea la introducere* și să crească *acuratețea automată*, adică exact terenul pe care aplicația pierde azi. Diferențierea reală rămâne pe bonuri, unde datele colectate deja permit lucruri pe care niciun concurent din listă nu le face.

## Cine sunt concurenții pe Play

| Produs | Poziționare pe Play | Ce câștigă | Ce ne lipsește față de el |
|---|---|---|---|
| **Monefy** | Cel mai rapid de folosit | Roată de categorii pentru adăugare într-o atingere, tile pe ecranul de blocare, funcționează integral offline [1][2] | Adăugare fără deschiderea aplicației |
| **Wallet by BudgetBakers** | Cel mai complet pe Android | Conexiuni bancare europene, import Google Pay, widgets, scanare bonuri, împărțirea tranzacțiilor [3] | Widget, import, umplere automată |
| **1Money** | Monefy cu mai mult buget | Bugete separate pe categorie, sincronizare și export contra plată [1] | — (avem echivalentul) |
| **Goodbudget** | Metoda plicurilor | Plicuri explicite, partajare în gospodărie, notificare când altcineva ia din plic [4] | Notificare către ceilalți membri la consumul unui plic |
| **YNAB** | Disciplină zero-based | Import bancar, partajare pentru până la șase persoane, obiective, datorii [5] | Import bancar |
| **Monarch Money** | Gospodărie fără limită de membri | Membri nelimitați, revizuire în doi a tranzacțiilor, rapoarte lunare [6] | Flux de revizuire în doi |
| **Money in Motion (RO)** | Open Banking local | Rapoarte personalizate, cheltuieli comune de familie, educație financiară, gratuit [7] | Concurent direct pe piața românească |
| **Categoria „SMS/notificări”** | Automat, fără bancă | Citesc alertele bancare de pe telefon și creează mișcarea singure [8][9] | Cea mai mare diferență de efort zilnic |

## Ce merită împrumutat

Ordinea este dată de raportul dintre efectul asupra folosirii zilnice și efortul de implementare.

### 1. Adăugare fără a deschide aplicația — widget și tile

Aceasta este singura lecție pe care o dau *toate* aplicațiile rapide din magazin. Un widget pe ecranul principal cu ultimele trei șabloane rapide și un buton „Adaugă cheltuială”, plus un tile în Setări rapide, scot cel mai mare obstacol zilnic: aplicația trebuie deschisă, iar ecranul Astăzi trebuie încărcat, înainte ca utilizatorul să poată nota 12 lei la pâine.

Componenta `QuickEntryPanel` și șabloanele rapide există deja; lipsește doar suprafața Android. Necesită cod nativ (`AppWidgetProvider` și `TileService`) lângă proiectul Capacitor, nu doar web.

**Efect:** foarte mare. **Efort:** mediu spre mare, primul cod nativ propriu al proiectului. **Risc:** mic.

### 2. Citirea locală a notificărilor bancare

Este cea mai mare diferență de efort între noi și categoria automată. Bănci precum BT, ING, BCR sau Revolut trimit notificări cu suma și comerciantul. Un `NotificationListenerService` le poate citi **pe telefon**, fără nicio conexiune la bancă, fără PSD2, fără costuri per utilizator, iar rezultatul este o propunere de cheltuială care așteaptă confirmarea — nu o mișcare salvată automat.

Se potrivește exact cu poziționarea produsului: nimic nu pleacă de pe telefon, iar utilizatorul rămâne cel care confirmă. Alimentează direct „Centrul de revizuire” propus ca prioritatea 2 în analiza anterioară.

> **Verificat la 10 septembrie 2026 — rezultatul schimbă recomandarea.** Google
> tratează `NOTIFICATION_LISTENER` în **aceeași categorie de risc ridicat** cu `READ_SMS`,
> `RECEIVE_SMS` și accesibilitatea, pentru că sunt permisiunile abuzate cel mai des în
> fraude financiare. Play Protect **blochează automat instalarea** aplicațiilor care le
> declară, atunci când instalarea vine din afara magazinului — browser, aplicație de
> mesagerie sau manager de fișiere [10][11].
>
> Buget Familie se distribuie astăzi și ca APK descărcat direct. O versiune cu
> `NotificationListenerService` **nu s-ar mai putea instala așa**, iar pe Play ar intra
> într-o verificare suplimentară, cu declarație de funcție principală.
>
> **Concluzie: nu construim funcția acum.** Condițiile care ar schimba decizia sunt două,
> ambele necesare: distribuția să se mute integral în Play, și cineva să accepte munca de
> declarare și de menținere a formularului de permisiuni sensibile. Până atunci, punctul 3
> (import CSV) acoperă aceeași nevoie fără niciun risc de magazin. Efortul planificat
> pentru tranșa 4 este mai bine cheltuit pe acuratețea bonurilor.

Dacă totuși se ajunge acolo, al doilea avertisment rămâne valabil: **textul notificărilor
se schimbă fără preaviz**. Regulile de citire trebuie să fie date, nu cod — un tabel
editabil de tipare per bancă, cu posibilitatea utilizatorului de a corecta o citire
greșită și cu ignorare tăcută când nimic nu se potrivește.

**Efect:** foarte mare. **Efort:** mare. **Risc:** ridicat, confirmat — vezi caseta de mai sus.

### 3. Import de extras de cont (CSV/OFX)

Alternativa ieftină la conexiunea bancară, deja menționată în analiza anterioară ca pas premergător. Băncile românești oferă export CSV. Un import cu previzualizare, potrivire de coloane și detectarea mișcărilor deja existente acoperă o bună parte din valoarea sincronizării bancare, la o fracțiune din cost și fără dependență de un furnizor.

Se leagă de aceeași stare „de verificat” ca punctul 2.

**Efect:** mare. **Efort:** mediu. **Risc:** mic.

### 4. Alertă către ceilalți membri când un plic este consumat

Goodbudget notifică membrii gospodăriei când cineva ia din plic; este funcția pe care recenziile o citează cel mai des ca motiv de a rămâne. Avem plicuri, membri și sincronizare criptată — lipsește doar semnalul. Poate fi o notificare locală declanșată la primirea unei actualizări de la celălalt telefon, cu prag configurabil, fără serviciu de mesaje.

**Efect:** mare pentru gospodării. **Efort:** mic. **Risc:** mic.

### 5. Mai multe valute

Spendee și Wallet o au; pentru familiile cu un venit în euro sau cu un membru plecat, absența ei este un motiv de dezinstalare. Nu este nevoie de curs în timp real: o valută per sursă și un curs introdus manual, cu data lui, acoperă cazul real fără a aduce un serviciu extern.

**Efect:** mediu, mare pentru un segment îngust. **Efort:** mediu spre mare, atinge tot registrul. **Risc:** mediu.

### 6. Ce nu mai trebuie împrumutat

Detectarea abonamentelor recurente există deja în `household-insights.ts` și nu creează scadențe fără confirmare. Bugetele pe categorie, exportul și partajarea de familie sunt de asemenea acoperite. Nu trebuie construite a doua oară.

## Ce merită dezvoltat original

Punctele de mai sus ne aduc la nivelul concurenței. Următoarele ne-ar duce în față, și toate se sprijină pe date pe care aplicația **deja le colectează** — liniile de produs de pe bonuri.

### A. Istoricul prețului pe produs, între magazine

Bonurile sunt citite pe linii, cu etichetă și sumă. Nimic nu împiedică păstrarea unui istoric: *„Lapte Zuzu 1,5 l — 7,49 la Lidl pe 2 septembrie, 8,20 la Kaufland pe 28 august”*. Este o funcție pe care nicio aplicație din tabelul de mai sus nu o oferă, are sens exclusiv local și crește cu fiecare bon fotografiat.

Condiția este normalizarea etichetelor OCR, care sunt scurte și inconsecvente. Începutul rezonabil este potrivirea doar în interiorul aceluiași magazin, unde eticheta se repetă identic.

**Efect:** mare, și vizibil în listarea din magazin. **Efort:** mediu. **Încredere:** medie, depinde de calitatea OCR.

### B. Coșul etalon — inflația proprie a gospodăriei

Pornind de la același istoric: utilizatorul marchează zece–cincisprezece produse pe care le cumpără constant, iar aplicația arată cât costa coșul acum trei luni și cât costă azi. Este un indice de inflație personal, calculat din bonurile proprii, nu din statistici naționale.

Pentru piața românească este un subiect cu greutate reală și este un argument de comunicare pe care niciun concurent internațional nu îl poate copia local.

**Efect:** mare ca diferențiere. **Efort:** mic, odată ce A există. **Încredere:** depinde de A.

### C. Alocația copilului

Segmentul familial din magazin are un gol între aplicațiile de buget și cele de bani de buzunar pentru copii (Crew, Greenlight), care în plus sunt legate de bănci americane. Un membru marcat drept copil, cu un plic propriu, o sumă recurentă și un ecran simplificat, ar acoperi nevoia fără cont bancar și fără card. Se construiește aproape integral din membri, plicuri și scadențe recurente — toate existente.

**Efect:** mediu spre mare, deschide un segment. **Efort:** mic spre mediu. **Risc:** mic.

### D. Check-in familial săptămânal

Reluat din analiza anterioară fiindcă se leagă direct de punctul 4 de mai sus: după alerta pe plic, pasul firesc este un rezumat de două minute la sfârșitul săptămânii. Rămâne local și opțional.

## Ce evităm în continuare

- **Conexiune bancară directă.** Cost per utilizator, dependență de furnizor și o suprafață de date care contrazice poziționarea. Punctele 2 și 3 acoperă cea mai mare parte a valorii.
- **Reclame sau produse financiare recomandate.** Ar anula argumentul principal al produsului.
- **Funcții sociale dincolo de familie.** Nu rezolvă nicio problemă a utilizatorului nostru.
- **Un scor unic fără explicație.** Scorul de sănătate arată deja factorii; regula rămâne: nicio cifră fără formula din spate.

## Plan pe tranșe

| Tranșă | Conținut | Criteriu de acceptare |
|---|---|---|
| 1 | Alertă pe plic către ceilalți membri; centrul de revizuire „de verificat” | Nicio mișcare propusă nu se salvează fără confirmare explicită |
| 2 | Widget pe ecranul principal și tile în Setări rapide | O cheltuială se adaugă fără deschiderea aplicației, offline |
| 3 | Import CSV cu previzualizare și detectarea dublurilor | Un extras importat de două ori nu dublează nicio mișcare |
| 4 | ~~Citirea notificărilor bancare~~ — **oprită după verificarea politicii** | Se reia doar dacă distribuția se mută integral în Play (vezi punctul 2) |
| 5 | Istoricul prețului pe produs, apoi coșul etalon | Prețurile se potrivesc corect în interiorul aceluiași magazin |

Ordinea pune înaintea automatizării lucrurile mici și sigure, pentru că tranșele 1 și 2 se pot livra fără risc de politică de magazin, iar tranșa 4 are nevoie de o verificare externă înainte de a consuma efort.

## Stare la 10 septembrie 2026

Din planul de mai sus au fost livrate în această tranșă: alerta pe plic către ceilalți
membri și centrul de revizuire (tranșa 1), widgetul și dala din Setări rapide (tranșa 2),
importul CSV (tranșa 3), și istoricul prețului pe produs împreună cu coșul etalon
(tranșa 5). Tranșa 4 a fost oprită după verificarea politicii, din motivele de mai sus.

Rămân de dezvoltat, în ordinea recomandată: check-in-ul familial săptămânal, alocația
copilului și mai multe valute.

## Referințe

[1]: https://portofelo.com/blog/monefy-alternatives "Monefy Alternatives — Portofelo, 2026"
[2]: https://www.slant.co/versus/2887/2901/~monefy-money-manager_vs_wallet-by-budgetbakers "Monefy vs Wallet by BudgetBakers — Slant, 2026"
[3]: https://budgetbakers.com/en/features/ "BudgetBakers Wallet Features"
[4]: https://goodbudget.com/what-you-get/ "Goodbudget — What You Get"
[5]: https://www.ynab.com/features "YNAB Features"
[6]: https://www.monarch.com/for-couples "Monarch Money for Couples"
[7]: https://iancuguda.ro/mim/ "Money in Motion — aplicație românească de buget familial"
[8]: https://getfinny.app/blog/sms-expense-tracking-app "SMS Expense Tracking Apps, 2026"
[9]: https://pocketclear.app/blog/best-budget-app-android-2026.html "Best Budget Apps for Android, 2026"

[10]: https://developers.google.com/android/play-protect/warning-dev-guidance "Developer Guidance for Google Play Protect Warnings"

[11]: https://www.bleepingcomputer.com/news/security/google-tests-blocking-side-loaded-android-apps-with-risky-permissions/ "Google blochează aplicațiile instalate din afara magazinului care cer permisiuni riscante"

---

**Notă.** Datele de mai sus au fost culese la 10 septembrie 2026 din surse publice, fără acces direct la listările Play. Înainte de a porni oricare dintre tranșe, verifică în magazin funcțiile și prețurile concurentului relevant — se schimbă des și diferă pe țară.
