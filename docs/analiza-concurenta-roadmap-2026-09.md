# Analiza competitivă și roadmap pentru Buget Familie

**Data analizei:** 10 septembrie 2026  
**Produs analizat:** Buget Familie  
**Scop:** identificarea funcțiilor care cresc acuratețea, utilitatea zilnică și diferențierea locală a aplicației.

## Concluzie executivă

Buget Familie are deja o fundație mai distinctă decât un simplu tracker de cheltuieli: plicuri pe perioade, surse separate, membri ai familiei, sincronizare între telefoane, obligații, scadențe recurente, export CSV, rapoarte și un ghid conversațional. Concurenții internaționali validează însă patru direcții care merită consolidate: **reconciliere automată**, **împărțirea unei tranzacții pe categorii**, **check-in-uri familiale structurate** și **prognoze explicabile**.

Recomandarea este să nu copiem sincronizarea bancară internațională ca primă prioritate. Aceasta este costisitoare, dependentă de furnizori externi și mai puțin potrivită pentru diferențierea locală. Prioritatea ar trebui să fie un flux excelent pentru bonuri românești: citire exactă, confirmare vizibilă, linii de produse, împărțire pe plicuri și posibilitatea de corectare fără pierderea fotografiei.

## Ce oferă aplicația astăzi

Auditul codului arată că aplicația include deja următoarele capacități: bugete pe plicuri și săptămâni, surse de bani, membri și sincronizare familială, jurnal cu filtre salvabile, export CSV, scadențe recurente, rapoarte, sugestii financiare, gestionarea datoriilor, fotografii și OCR local pentru bonuri, plus ghid AI online și ghid local de rezervă.

Acest nivel de funcționalitate reduce riscul de a construi duplicate. Cele mai bune îmbunătățiri sunt cele care leagă modulele existente într-un flux mai coerent.

## Comparație competitivă

| Produs | Puncte forte observate | Lecția pentru Buget Familie |
|---|---|---|
| YNAB | Import bancar, sincronizare multi-device și offline, partajare pentru grupuri de până la șase persoane, obiective și management de datorii [1]. | Păstrează modelul de plicuri, dar fă starea fiecărui plic și următorul pas mai ușor de verificat împreună în familie. |
| Goodbudget | Metodă explicită de plicuri, sincronizare și partajare a bugetului gospodăriei, economisire pentru cheltuieli mari și progres pentru datorii [2]. | Diferențierea locală poate veni din perioadele dintre salarii, bonurile românești și sursele cash/card/bonuri de masă. |
| Wallet by BudgetBakers | Scanare și stocare bonuri, tranzacții împărțite, categorisire AI, plăți programate, prognoze, detectarea anomaliilor, export și partajare de familie [3]. | Împărțirea pe linii de bon și explicația motivului pentru alegerea plicului sunt funcții cu impact direct. |
| Spendee | Conturi bancare, portofele comune, bugete, multiple valute, alerte și backup/sincronizare [4]. | Un mod simplu de „check-in” familial și alerte utile pot crește retenția fără a cere bancă conectată. |
| Monarch Money | Dashboard de gospodărie, conturi separate și comune, etichetarea partenerului pentru revizuirea tranzacțiilor, rapoarte lunare interactive și obiective comune [5]. | Adaugă un flux de revizuire: „de verificat”, „aprobat”, „întreabă partenerul”, fără a transforma aplicația într-un sistem social complicat. |

## Oportunități prioritizate

### Prioritatea 1: Bon verificabil și împărțit pe produse

Aceasta este cea mai importantă direcție deoarece răspunde unei nevoi deja exprimate și este o zonă în care aplicația poate fi mai bună local decât instrumentele generale. Fiecare linie citită ar trebui să aibă nume, cantitate, sumă, categorie și plic propus. Totalul trebuie reconciliat cu suma liniilor. Utilizatorul trebuie să poată corecta o linie, muta linia în alt plic și vedea diferența rămasă până la total.

**Impact:** foarte mare.  
**Încredere:** mare, deoarece formularul de bon și OCR-ul există deja.  
**Efort:** mediu.

### Prioritatea 2: Centru de revizuire pentru tranzacții

Tranzacțiile importate, adăugate de AI sau citite din bonuri ar putea avea starea `de verificat`. Un centru compact ar lista suma, magazinul, categoria, plicul și motivul propunerii. Acțiunile rapide ar fi: confirmă, schimbă plicul, editează, ignoră.

**Impact:** mare.  
**Încredere:** mare.  
**Efort:** mediu.

### Prioritatea 3: Check-in familial săptămânal

Aplicația are deja bilanț săptămânal și sincronizare. Următorul pas este un flux de două minute: ce a mers bine, ce plic a fost depășit, ce sumă trebuie mutată, ce mesaj se trimite familiei. Check-in-ul trebuie să fie local și opțional, fără notificări agresive.

**Impact:** mare pentru gospodării.  
**Încredere:** medie.  
**Efort:** mic spre mediu.

### Prioritatea 4: Reguli locale pentru categorisire

Wallet și Monarch folosesc categorisire automată și reguli. Buget Familie poate introduce reguli explicabile precum „dacă titlul conține `LIDL`, propune Alimente” sau „dacă bonul conține `detergent`, propune Casă & facturi”. Regulile trebuie să fie editabile și să nu salveze automat fără confirmare.

**Impact:** mediu spre mare.  
**Încredere:** mare.  
**Efort:** mediu.

### Prioritatea 5: Prognoză explicabilă până la următorul venit

Aplicația are deja ritm zilnic și perioade salariale. Ar fi util un card care explică: sold disponibil, cheltuieli fixe rămase, plicuri rezervate, zile rămase și suma prudentă pe zi. Orice prognoză trebuie să arate formula, nu doar un scor.

**Impact:** mediu.  
**Încredere:** mare.  
**Efort:** mic.

## Ce aș evita momentan

Importul bancar nu ar trebui să fie primul proiect. Necesită conectare la furnizori, tratarea tokenurilor, reconcilieri și suport pentru instituții. Funcția poate fi planificată ulterior prin import CSV/OFX controlat, înaintea unei integrări bancare directe.

Un marketplace de produse financiare sau reclame ar contrazice poziționarea de control și confidențialitate. Funcțiile sociale extinse ar adăuga complexitate fără să rezolve problema principală a acurateții și organizării cheltuielilor.

## Plan recomandat pentru următoarea tranșă

| Etapă | Livrare | Criteriu de acceptare |
|---|---|---|
| 1 | Parser OCR pentru `15`, `15,5`, `15,50`, `15.5` și separatori românești | Totalul este păstrat exact cu maximum două zecimale. |
| 2 | Reconciliere bon | Totalul, liniile și reducerile sunt comparate; diferența este vizibilă. |
| 3 | Împărțire pe plicuri | Fiecare produs poate primi categorie și plic; suma liniilor trebuie să egaleze totalul. |
| 4 | Revizuire | Nicio cheltuială AI/OCR nu se salvează fără confirmare explicită. |
| 5 | Check-in | Familia poate revizui săptămâna și trimite un rezumat fără a expune date inutile. |

## Observație asupra implementării curente

În cursul acestei tranșe am întărit parserul local pentru totaluri cu o singură zecimală. Anterior, expresia de recunoaștere accepta în principal două zecimale. Acum `TOTAL 15,5` și `TOTAL 15.5` sunt interpretate ca `15.5`, fără rotunjire la `16`. Am adăugat și test de regresie pentru aceste cazuri.

## Referințe

[1]: https://www.ynab.com/features "YNAB Features"

[2]: https://goodbudget.com/what-you-get/ "Goodbudget What You Get"

[3]: https://budgetbakers.com/en/features/ "BudgetBakers Wallet Features"

[4]: https://www.spendee.com/ "Spendee Money Management Features"

[5]: https://www.monarch.com/for-couples "Monarch Money for Couples"

---

**Notă:** Funcțiile și poziționările concurenților au fost verificate pe paginile oficiale accesibile la 10 septembrie 2026. Disponibilitatea poate varia în funcție de țară, plan și platformă.
