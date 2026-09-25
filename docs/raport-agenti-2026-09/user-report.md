# Buget Familie — raport de utilizator real (părinte, 2 salarii, 1 copil la grădiniță)

Folder capturi: `/tmp/claude-0/-home-user-buget-familie/6251941a-2f52-5fdd-bb21-2d9641b66e0b/scratchpad/agents/user/` (mai jos îl scriu scurt `U/`).
Am testat pe telefon (390×844), cu ceasul setat în octombrie 2026, ca să trăiesc un ciclu real: instalare pe 9 oct, salariul meu pe 10, al Anei pe 12, o săptămână de cheltuieli (12–17 oct). Am testat și cazul „am instalat aplicația pe 25 septembrie, la mijlocul lunii”. Totul a rulat offline, fără sync.

---

## Rezumat

Ideea aplicației e exact ce-mi trebuie: îi spun o dată ce venituri avem și ce plătim, iar la fiecare salariu îmi propune cât merge în fiecare plic. Pașii de pornire sunt scurți și clari. Propunerea de împărțire e ușor de înțeles, iar „Notează” alege aproape mereu plicul corect (Lidl → Mâncare, Bolt → Taxi, Enel → Lumină, grădiniță → Grădiniță, rata → Rate bancă). Asta e partea cea mai bună.

Problema mare e că, după ce aplici împărțirea, aplicația **se sperie de facturile plătite**. Am plătit rata de 1.400 lei, exact cât era planificat. Mi-a apărut un banner roșu „APROAPE DE LIMITĂ – Rate bancă” care a stat pe ecran zile întregi. Plicul a fost marcat „DEPĂȘIT”, iar „Bilanțul săptămânii” mi-a spus că sunt „1.094 lei peste plan”. La Lumină mi-a spus „cel mult 0,25 RON pe zi”. Un om obișnuit crede că a greșit ceva sau că aplicația e stricată.

Pe locul doi: **cifre diferite pentru același lucru**. „Cât pot cheltui azi” apare ca 85,71, 80, 68,57 sau 352,84 lei/zi, după ecranul pe care ești (Astăzi, Plan, Ghid).

Pe locul trei: **am introdus „cât am acum pe card” și aplicația mi-a dublat banii** (5.200 → 9.942 lei).

În plus, aplicația e **foarte lungă și foarte „vorbăreață”**. Plan are ~8.000 px, cam 10 ecrane de telefon, iar Setări are ~9.300 px. Are mulți termeni noi: plic, categorie, tranșă, S2, ritm, reper, repartizare, nerepartizați, perspectivă. Pentru un părinte obosit seara, e prea mult.

Notă generală: **5,5/10** azi. Nucleul e de 8/10. Dacă se repară alertele false și cifrele contradictorii și se strânge ecranul Plan, poate ajunge ușor la 8,5.

---

## Ce mi-a plăcut

- **Pornirea în 3 pași** („Ce venituri intră?”, „Ce plătiți de obicei?”, „Salariul vine mereu în aceeași zi?”) e scurtă și umană. Faptul că mâncarea e „pe săptămână”, iar restul „pe lună”, e exact cum gândesc. Dacă apăs „Mai departe” fără sumă, primesc un mesaj clar.
- **Propunerea de împărțire la salariu** (`U/22-oct10-salary-2.png`): întâi obligațiile, apoi restul, cu „Nu acum” / „Aplică repartizarea”. Faptul că nu se mută nimic fără acordul meu îmi dă siguranță.
- **Al doilea salariu știe ce s-a acoperit deja**: „2.510 RON deja acoperiți” la Mâncare, apoi Taxi și Neprevăzute (`U/25-ana-split.png`). Foarte bine gândit.
- **Anularea** apare imediat după aplicare. Cele făcute mai demult se pot anula din Plan → „Ce plătim lunar” → „Repartizări făcute”.
- **Plicul se alege singur** după magazin (Lidl, Kaufland, Bolt, Enel, grădiniță, rata BCR). N-a trebuit să aleg nimic.
- **„Toate săptămânile”** la Mâncare (S1…S5 cu datele și cât am cheltuit) e clar și util.
- **„Pe luni · media”** (după ce am avut istoric) plus propoziția „De obicei cheltuiți cu X mai mult/puțin” e un sfat foarte bun.
- **Plăți rare** (RCA, Crăciun): scriu suma și data, iar aplicația îmi spune „~250 RON pe lună”. Excelent pentru o familie din România.
- Ghidul răspunde bine la „cât mai am la mâncare?” și la „cât am cheltuit pe taxi luna asta?”, cu detaliile (fiecare Bolt).
- Rezumatul din „Ce plătim lunar”: „intră 7.500, pleacă ~5.490, rămân ~2.010 liberi”. Asta e cifra pe care o voiam de la început și ar trebui să fie pe primul ecran.
- Temele Întunecat și Navy arată bine, cu contrast ok (`U/49-dark-Astăzi.png`, `U/49-navy-Mișcări.png`).
- „Telefonul lui X” are o idee foarte bună (ecran unic, buton mare), cu confirmare la intrare și la ieșire.
- Butoanele sunt destul de mari (aproape toate ≥ 36 px).

---

## Probleme (în ordinea gravității)

### 1. Factura plătită = alarmă falsă („DEPĂȘIT”, „peste plan”, „cel mult 0,25 lei pe zi”)
- **Ecran:** Astăzi (banner + Bilanțul săptămânii), Plan (cardurile plicurilor), Analiză („Limite de revizuit”), Ghid.
- **Ce am făcut:** Am plătit rata de 1.400 lei (plicul Rate bancă = 1.400), Enel 243 lei (Lumină = 250) și grădinița 450 lei (plic 450).
- **Ce s-a întâmplat:**
  - Banner galben „APROAPE DE LIMITĂ · Rate bancă · 100% din limită este deja consumată”. A stat sus pe Astăzi zile întregi (15, 16, 17 oct), și în modul simplu.
  - „Bilanțul săptămânii: Mută lei în Rate bancă sau încetinește cheltuielile din acest plic (1.094 lei peste plan)”. Dar am plătit exact cât era planificat.
  - Plan: Rate bancă și Grădiniță apar ca „DEPĂȘIT · 25% AȘTEPTAT”, cu textul „Mai ai nevoie de bani 24 de zile… Plicul e gol”.
  - Lumină: „La ritmul de acum se termină pe 17 octombrie… Ca să ajungă: cel mult 0,28 RON pe zi”. Toast la salvare: „cel mult 0,25 RON pe zi (acum 48,60 RON)”.
  - Neprevăzute (farmacie 64 lei): „cel mult 4,68 RON pe zi”.
  - Ghidul: „Atenție la «Rate bancă»: 0 RON rămași”.
  - Analiză: „Urmărește Rate produse”, adică rata băncii e „categoria principală de urmărit”.
- **Ce mă așteptam:** Pentru o factură sau o rată lunară, plata întreagă înseamnă „✓ Plătit”, verde, fără ritm pe zi și fără alertă. Ritmul pe zi și săptămânile au sens doar la Mâncare, Taxi și altele asemănătoare.
- **Gravitate:** **MARE.** Te sperie exact când ai făcut totul bine.
- **Capturi:** `U/29-home-oct16-0.png`, `U/29-home-oct16-2.png`, `U/40-plan-6.png`, `U/40-plan-7.png`, `U/40-plan-9.png`, `U/31-guide.png`

### 2. „Cât ai acum pe card?” dublează banii
- **Ecran:** Astăzi, cardul „SOLD REAL · Cât ai acum pe Card debit?”.
- **Ce am făcut:** După o săptămână (salarii notate, cheltuieli notate) am scris cât văd în aplicația băncii: 5.200.
- **Ce s-a întâmplat:** Suma a fost salvată ca *sold inițial*. Imediat dedesubt, un alt card spune „Cât ai de fapt pe Card debit? Eu zic **9.942,30 RON**”, adică 5.200 + salariile − cheltuielile.
- **Ce mă așteptam:** „Cât ai acum” = cât am acum. Aplicația ar trebui să calculeze singură diferența, eventual ca o mișcare de „ajustare sold”.
- **Gravitate:** **MARE.** Strică toate cifrele de „disponibil”.
- **Captură:** `U/63-sold-real-after.png`
- În plus, pe Astăzi sunt două carduri care întreabă același lucru: „SOLD REAL” și „Cât ai de fapt pe Card debit?” (`U/29-home-oct16-2.png`).

### 3. Patru cifre diferite pentru „cât pot cheltui azi”
- **Ecran:** Astăzi, Plan, Ghid.
- **Ce am făcut:** Pe 17 oct am întrebat, pe rând, fiecare ecran.
- **Ce s-a întâmplat:**
  - Astăzi: „De mâine: 80 lei/zi (480 pe 6 zile)”.
  - Plan, la Mâncare: „cel mult 68,57 RON pe zi, 7 zile cu tot cu azi”.
  - Ghid, la deschidere: „ritmul e 352,84 RON/zi, peste 212,60 RON sigur”.
  - Ghid, la „cât pot cheltui azi?”: „85,71 RON… Ești peste ritmul de azi. Ai cheltuit în medie 352,84 RON pe zi”. Media include rata și grădinița, deci mă ceartă degeaba.
- **Ce mă așteptam:** O singură cifră a zilei, aceeași peste tot.
- **Gravitate:** **MARE.** Nu mai am încredere în niciuna.
- **Capturi:** `U/49-dark-Astăzi.png`, `U/62-pe-luni.png`, `U/31-guide.png`

### 4. Dacă pornesc aplicația la mijlocul lunii, planul de mâncare ține 6,5 săptămâni
- **Ecran:** Astăzi, propunerea de împărțire.
- **Ce am făcut:** Am instalat pe 25 sept. și am notat salariul de 4.700 (primit de fapt pe 10), cu data implicită „azi”.
- **Ce s-a întâmplat:** „Mâncare: 600 RON × 6 săpt. + 5 zile = 4.029 RON”. Ciclul s-a întins până pe 10 noiembrie, deși salariul următor vine pe 10 octombrie.
- **Ce mă așteptam:** Să fiu întrebat „Salariul ăsta e cel din 10 septembrie?” sau ca ciclul să se termine la următoarea zi declarată (10 oct).
- **Gravitate:** **MARE** pentru prima impresie (orice om nou pornește la mijlocul lunii).
- **Captură:** `U/16-today-salary-2.png`

### 5. După pornire, Astăzi îmi cere exact ce tocmai am făcut
- **Ecran:** Astăzi, imediat după „Gata” la pornire.
- **Ce am făcut:** Am terminat cei 3 pași (venituri, 7 cheltuieli, data salariului).
- **Ce s-a întâmplat:**
  - Aterizez pe Plan cu „Fiecare leu are un loc… Adaugă câte o categorie” și „0 plicuri”, deși tocmai am declarat 7 cheltuieli.
  - Pe Astăzi scrie „Fă primul plic” și „Spune când vine salariul”.
  - Mai scrie „Ciclul se închide. Uită-te ce a rămas.”, deși nu există încă niciun ciclu.
- **Ce mă așteptam:** „Gata! Când îți vine salariul (~10 oct.), apasă «Notează → Venit» și îți propun împărțirea.” Plus un buton mare „Notează salariul”.
- **Gravitate:** Medie spre mare, pentru că te face să crezi că n-a salvat nimic.
- **Capturi:** `U/09-after-onboarding.png`, `U/11-home-0.png`, `U/20-p2-home-oct9.png`

### 6. „Ce plătim lunar” și „Obligații” sunt două lumi care nu se văd una pe alta
- **Ecran:** Obligații.
- **Ce am făcut:** Rata de bancă e declarată la pornire (1.400/lună) și e deja plătită.
- **Ce s-a întâmplat:** Obligații spune „Nu ai datorii înregistrate”, „0 RON rate declarate / lună”, „Nu ai scadențe apropiate”. „Plăți rare” (RCA) stă în Plan, nu în Obligații.
- **Ce mă așteptam:** Obligații să arate rata, grădinița și Enel cu ziua scadenței și bifa „plătit”, adică lista „ce mai am de plătit luna asta”.
- **Gravitate:** **MARE** ca neclaritate.
- **Captură:** `U/42-oblig-0.png`

### 7. Ghid: dacă aleg plicul înainte de zi, alegerea nu se ține, iar după salvare conversația dispare
- **Ecran:** Ghidul (chat).
- **Ce am făcut:** „am dat 120 la Lidl”. Am atins „Din Mâncare · S2”, apoi „Azi”.
- **Ce s-a întâmplat:**
  - Atingerea plicului n-a avut niciun efect vizibil (nu s-a marcat). După „Azi” a scris „Ziua e aleasă. Alege de unde scoatem banii.”, deci a uitat plicul. Merge doar în ordinea zi → plic.
  - După salvare, tot chatul s-a strâns în „Istoric (22)”, cu mesajul „Conversația începe aici”. Nicio confirmare „Am notat Lidl 120”.
  - Deschiderea ghidului strânge mereu conversația anterioară în „Istoric”.
- **Ce mă așteptam:** Să aleg în orice ordine, iar ziua implicită „azi” să fie deja bifată. Deci o singură atingere pe plic salvează și îmi arată „✓ Notat Lidl 120 lei din Mâncare · Anulează”.
- **Gravitate:** **MARE** pentru ghid.
- **Capturi:** `U/33-g-lidl-picked.png`, `U/33-g-lidl-saved.png`, `U/37-g-lidl-after.png`

### 8. Ghid: „am primit salariul 4700” se poate nota a doua oară, iar textul e rupt
- **Ecran:** Ghid.
- **Ce am făcut:** Pe 17 oct am scris „am primit salariul 4700”. Salariul fusese deja notat pe 10.
- **Ce s-a întâmplat:**
  - Nu există niciun avertisment de dublură.
  - Propunerea spune „repartizează 4.700 RON după Ce plătim lunar:  · liberi 4.700 RON”: listă goală, spațiu dublu, iar toți banii apar ca „liberi”.
- **Ce mă așteptam:** „Ai deja Salariu 4.700 pe 10 oct. E altul?”, plus împărțirea corectă.
- **Gravitate:** Medie.
- **Captură:** `U/32-guide-2.png`

### 9. Ghid: nu înțelege „cardul Anei” și „pe tichete”
- **Ecran:** Ghid.
- **Ce am făcut:** „am plătit 55 lei la farmacie cu cardul Anei” și „am dat 80 pe tichete la Kaufland”.
- **Ce s-a întâmplat:**
  - Titlurile ies „Plătit farmacie cardul Anei” și „Tichete Kaufland”, iar sursa nu se schimbă.
  - La farmacie spune „Nu am un plic exact pentru Sănătate”, deși din „Notează” farmacia a mers la Neprevăzute.
- **Ce mă așteptam:** Sursa corectă (Bonuri de masă, cardul Anei) și titlul „Farmacie”/„Kaufland”.
- **Gravitate:** Medie.
- **Captură:** `U/34-g-tichete.png`

### 10. Tichetele de masă și cash-ul pornesc de la 0 și ajung pe minus
- **Ecran:** Notează, Plan („Disponibil în surse”), Setări.
- **Ce am făcut:** Am plătit Lidl 150 cu Bonuri de masă și pâine 35 cash.
- **Ce s-a întâmplat:**
  - „Bonuri de masă · -150 RON”, „Cash · -35”. „Disponibil în surse” scade cu tichetele.
  - Cumpărătura cu tichete a consumat plicul de Mâncare, finanțat din salariu, deși la pornire scria „Tichetele nu intră”.
  - Pașii de pornire pe varianta „salariu” nu m-au întrebat nici de tichete (ex. 40 lei × 21 zile), nici de cash, nici cum mă cheamă. Varianta „Vreau doar să notez” întreabă de nume, card și cash (`U/64-just-note.png`).
- **Ce mă așteptam:** Să fiu întrebat „Primești tichete? Cât pe lună, în ce zi?”. Cheltuielile cu tichete să scadă din tichete, iar Mâncarea din salariu să fie redusă corespunzător.
- **Gravitate:** Medie.
- **Capturi:** `U/40-plan-2.png`, `U/47-settings-3.png`

### 11. Butonul „Notează” dispare când n-ai încă nicio mișcare
- **Ecran:** Astăzi, înainte de prima mișcare.
- **Ce s-a întâmplat:** Nu există buton „Notează”. Există doar lista „Treci prima mișcare” și o lupă sus („Deschide acțiunile rapide”), care ascunde „Înregistrează o mișcare”. Butonul mare apare abia după prima mișcare.
- **Ce mă așteptam:** Un buton mare „+ Notează”, mereu în același loc (ideal în bara de jos).
- **Gravitate:** Medie.
- **Captură:** `U/11-home-0.png`, `U/13-quick-actions.png`

### 12. Ecranul Plan e uriaș și amestecă 3 lucruri
- **Ecran:** Plan (~8.100 px, 13 ecrane).
- **Ce s-a întâmplat:** Ordinea de sus în jos e:
  - „Fiecare leu are un loc”, apoi „Plicul e o limită, nu un sold”, apoi progres 59%;
  - „Pornește rapid”, „Alege ritmul casei.”, „Unelte: propunere, simulare, ghid”;
  - „Tranșa S2”, un checkbox nestilizat „Am venituri neregulate (PFA…)”, data salariului;
  - „Repartizare ghidată” și **formularul complet „Adaugă plic”, mereu deschis**;
  - abia apoi plicurile (fiecare card are ~400 px și un buton roșu „Șterge” lângă „Editează”);
  - „Mută între plicuri”, apoi „Ce plătim lunar”, închis jos de tot.
  - Unele texte au 9–11 px („rămași din…”, „Familie / comun · Orice sursă”).
- **Ce mă așteptam:** Plan = lista plicurilor, compactă (nume, bară, „rămas X din Y”), cu un buton „+ Plic”. Restul (setări de perioadă, repartizare, mutări) să stea în foi separate.
- **Gravitate:** Medie spre mare.
- **Capturi:** `U/40-plan-0.png` … `U/40-plan-12.png` (mai ales `-1`, `-2`)

### 13. „Mod simplu” nu e simplu
- **Ecran:** Astăzi în mod simplu.
- **Ce s-a întâmplat:** Apare o bandă verde permanentă „Mod simplu activ — Dezactivează în Setări”. Rămân vizibile alerta „APROAPE DE LIMITĂ”, cardul „SOLD REAL”, „Copie de siguranță”, benzile pe zile și dock-ul cu 4 file.
- **Ce mă așteptam:** O cifră mare, „Notează” și ultimele 3 mișcări. Fără bandă de avertizare.
- **Gravitate:** Medie.
- **Captură:** `U/51-simple-today-0.png`

### 14. „Telefonul lui Ana”: arată „0 RON”, lasă ieșirea deschisă și arată tot bugetul la „Notează”
- **Ecran:** Telefonul lui Ana.
- **Ce s-a întâmplat:**
  - „Ai azi **0 RON** · Din banii familiei, pentru azi. Banii noi vin peste 22 de zile.” Ana are salariu de 2.800, iar alte ecrane spun 24 de zile.
  - Deasupra rămâne banda „Mod simplu activ — **Dezactivează**”, pe care un copil o poate apăsa fără confirmare.
  - În „Notează” se văd toate sursele familiei cu soldurile (Card debit · Eu · 4.742 RON) și toate plicurile (Rate bancă, Grădiniță…), deși ecranul promite „Fără restul bugetului”.
- **Ce mă așteptam:** Doar plicul/banii persoanei. Dacă nu are plic, mesajul „Fă-i un plic lui Ana în Plan”, nu „0 RON”.
- **Gravitate:** Medie.
- **Capturi:** `U/54-ana-phone.png`, `U/55-ana-notează.png`

### 15. Ghidul se strică fără internet pe web (ecran de eroare)
- **Ecran:** Ghid, în versiunea web, fără conexiune.
- **Ce s-a întâmplat:** Am apăsat pe iconița ghidului fără internet și am primit „A apărut o eroare neașteptată”, pe tot ecranul (modulul ghidului nu se putuse încărca).
- **Ce mă așteptam:** „Ghidul nu e disponibil offline” sau ghidul local. În APK probabil nu se întâmplă, dar în PWA/browser da.
- **Gravitate:** Medie.
- **Captură:** `U/30-guide-open.png`
- Tot aici: antetul ghidului scrie „GHIDUL TĂU · **ONLINE**” chiar când sus apare „Fără conexiune”.

### 16. „Anulează” la împărțire dispare la repornire
- **Ecran:** Astăzi.
- **Ce s-a întâmplat:** Cardul „Am împărțit Salariu în 7 plicuri · Anulează” dispare după ce închid și redeschid aplicația. Anularea se mai găsește doar în Plan → „Ce plătim lunar” (închis) → „Repartizări făcute”.
- **Gravitate:** Mică spre medie.
- **Mai e ceva:** Mesajul spune „în 7 plicuri”, deși Taxi și Neprevăzute au primit 0 („—”).

### 17. Formularul de venit nu recunoaște salariile declarate
- **Ecran:** Notează → Venit.
- **Ce s-a întâmplat:**
  - „Ce venit?” e gol. Dacă nu scriu nimic, se salvează ca „Venit rapid”.
  - Nu îmi propune „Salariul meu 4.700” sau „Salariu Ana 2.800”.
  - Salariul Anei intră implicit pe „Card debit · Eu”, pentru că Ana nu are card: pornirea n-a creat unul.
  - Eticheta e „Cine a înregistrat”, nu „Al cui e venitul”.
- **Ce mă așteptam:** Butoane „Salariul meu · 4.700” și „Salariul Anei · 2.800”, care completează tot dintr-o atingere.
- **Gravitate:** Medie.
- **Capturi:** `U/14b-venit-filled.png`, `U/24b-ana-income-form.png`

### 18. Categorii greșite, deși plicul e corect
- **Ecran:** Notează, Analiză.
- **Ce s-a întâmplat:**
  - grădiniță → categoria „Consumabile copil”;
  - rata BCR → „Rate produse”;
  - farmacie → „Altele”, nu „Sănătate”;
  - cafea → „Băuturi”.
  - Analiza pe categorii arată apoi „Rate produse 48%” și „Consumabile copil 15%”.
- **Ce mă așteptam:** Analiza să fie pe plicurile mele (Mâncare, Taxi, Grădiniță…). Sau categorii „Grădiniță/Educație”, „Credite”, „Sănătate”.
- **Gravitate:** Mică spre medie.
- **Captură:** `U/43-analiza-3.png`

### 19. „Ce rămâne dintr-o săptămână trece în următoarea”, dar S2 nu arată ce a rămas din S1
- **Ecran:** Plan → Mâncare → Toate săptămânile.
- **Ce s-a întâmplat:** S1 a rămas cu 17,50, iar S2 arată tot „din 600 RON”, nu 617,50.
- **Gravitate:** Mică.
- **Captură:** `U/44-toate-sapt.png`

### 20. Analiză: mesaje care se contrazic și detalii tăiate
- **Ecran:** Analiză.
- **Ce s-a întâmplat:**
  - „Luna rămâne **pe plus**” și, imediat dedesubt, „Luna rămâne **în echilibru**” (+4.557).
  - „DE REVIZUIT 3”, fără să spună ce anume.
  - Lista de luni merge până în noiembrie 2025, deși nu am date.
  - Butonul „Personal” e tăiat la margine, iar selectul arată „octombrie 2…”.
  - Graficul anual are etichete „O O”.
- **Gravitate:** Mică.
- **Capturi:** `U/43-analiza-0.png`, `U/43-analiza-4.png`

### 21. Detalii vizuale
- Titlul „Bilanțul săptămânii” e lipit de text, pe același rând, fără spațiu (în textul accesibil apare „Bilanțul săptămâniiSăptămâna e în ritm”) (`U/16-today-salary-3.png`).
- La pasul 2 din pornire, ecranul se deschide derulat la jumătate și titlul „Ce plătiți de obicei?” nu se vede (`U/06-step2.png`).
- În Mișcări, rândul se taie („Eu · Card debit · …”), deci nu văd plicul. Filtrele ocupă jumătate de ecran și sunt pe două rânduri „Toate” (Toate/Ieșiri/Intrări și Toate/Comune/Personale) (`U/41-miscari-0.png`).
- Sumele sunt afișate cu punct („187.5”, placeholder „4862.3”) în formularul extins și la verificarea soldului (`U/27b-expense-more-0.png`, `U/29-home-oct16-2.png`).
- „IEȘIT −0,00 RON” pe prima zi (`U/15-after-salary.png`).
- La pornire, câmpurile au exemple identice cu salariul meu („ex. 4.700”, „ex. 10”). Aproape am crezut că sunt deja completate (`U/02-step1.png`).

---

## Confuzii de limbaj

| Unde | Text actual | Problema | Propunere |
|---|---|---|---|
| Setări, secțiune „Telefonul unui membru” | „Telefonul lui Ana” | Genitivul feminin corect e „Anei” | „Telefonul Anei” / „Telefonul lui Mihai” (în funcție de gen) sau „Ecranul Anei” |
| Venituri | „Salariu Ana” (generat automat) | Nearticulat, sună telegrafic | „Salariul Anei” |
| Setări | „SURSE ȘI SOLD INITIAL” | Lipsește diacritica | „SOLD INIȚIAL” |
| Setări | „Card · 11 mișcări”, „Cash · 1 mișcări” | Acord | „1 mișcare” |
| Ghid | „100/100 azi · 1 obiceiuri” | Acord și sens neclar | „1 obicei”. Ce e „100/100”? De scos |
| Pornire | „PRIMUL REZULTAT” deasupra „Ce vrei să faci acum?” | Nu înseamnă nimic pentru mine | de scos sau „BINE AI VENIT” |
| Pornire | „Vreau să pun banii de azi.” | Neclar („să pun unde?”) | „Vreau să scriu câți bani am acum” |
| Pornire | „Intervalele (300–400) le poți pune după, în Plan.” | Nu știu ce e un „interval” | „Dacă suma variază (ex. 300–400), o poți schimba după, în Plan.” |
| Pornire pas 3 | „Gata. Când notezi…” + butonul „Gata” | „Gata” de două ori | Textul: „Atât! Când vine salariul…” |
| Astăzi | „TRANȘA S1 A ÎNCEPUT” | „Tranșă” sună a credit bancar | „Săptămâna 1 (10–16 oct.)” |
| Astăzi | „RITM URMĂRIT” | Nu înțeleg ce e | de scos |
| Astăzi | „din 600 rămași în plicul săptămânii” | Lipsește „lei” | „600 lei rămași” |
| Astăzi | „Ciclul se închide. Uită-te ce a rămas.” (în ziua 1) | Fals, încă nu există ciclu | De afișat doar la final de ciclu |
| Split | „Rămân 733 RON pentru Salariu Ana (12 octombrie).” | Pare că 733 merg *la* Ana | „Restul de 733 lei îi acoperă salariul Anei (12 oct.).” |
| Split | „600 RON × 4 săpt. + 4 zile = 2.743 RON · rămân 233 RON” | „rămân” e ambiguu | „mai trebuie 233 lei din salariul Anei” |
| Plan | „ÎN AVANS · 25% AȘTEPTAT”, „DEPĂȘIT · 25% AȘTEPTAT” | Jargon | „✓ Plătit”, „Pe drum bun”, „Atenție: ai cheltuit mai repede” |
| Plan | „Fiecare leu are un loc.” / „Totul are un loc. 0%” | Se contrazic când e 0% | „Ai 1.867 lei nepuși în plicuri” |
| Plan | „Alege ritmul casei.”, „Unelte: propunere, simulare, ghid” | Titluri fără sens, par butoane | De scos sau titluri clare |
| Plan | „Perioada e opțională — o folosesc doar categoriile cu ritm săptămânal” | Greu | „Doar pentru plicurile pe săptămână (ex. Mâncare).” |
| Formular | „Perspectivă: Comun / Personal” | Cuvânt abstract | „E o cheltuială a familiei sau doar a mea?” |
| Formular | „Corectează mișcarea” (la adăugare) | Nu corectez nimic, adaug | „Mai multe detalii” |
| Formular | „Salvează combinația ca șablon local” | Jargon | „Păstrează ca scurtătură” |
| Setări | „Plic ≠ cont · Reper ≠ sold” | Pare formulă matematică | „Plicul e o limită, nu bani în bancă.” |
| Aspect | „Atelier Platinum — hârtie caldă, pin, citire de zi”, „Cabinet modern”, „Verdele rămâne progres, mierea înseamnă revizuire” | Limbaj de catalog de design | „Luminos”, „Întunecat”, „Albastru închis” |
| Obligații | „Chirie, telefon, Netflix — un nume și o sumă. Fără logo.” | „Fără logo” e ciudat | de scos |
| Pe luni | „August”, „Septembrie” | În română lunile se scriu cu literă mică | „august”, „septembrie” |
| Ghid | „peste 212,60 RON sigur” | Incomprehensibil | de reformulat sau de scos |
| General | plic / categorie / tranșă / S2 / ritm / reper / repartizare / nerepartizați / nealocat / sursă | Prea mulți termeni pentru același lucru | Doar: **plic**, **săptămâna**, **bani liberi**, **card/cash/tichete** |

---

## Idei și funcții dorite (ca să fie cea mai bună aplicație pentru familii din România)

1. **Bifa „Plătit” pentru facturi și rate.** Rata, grădinița, Enel, internetul, întreținerea: fiecare cu ziua scadenței. Pe Astăzi: „Mai ai de plătit luna asta: Enel (~250, până pe 25), Digi (60)”. Nimic roșu când plătesc exact.
2. **O singură cifră a zilei**, peste tot la fel, calculată doar din plicurile „de zi cu zi” (Mâncare, Taxi, Diverse).
3. **Pe primul ecran, cifra lunii**: „Intră 7.500, pleacă ~5.490, rămân ~2.010 liberi”, cu un buton „Pune-i deoparte” (plic Economii / Fond de urgență / Vacanță).
4. **Tichetele de masă tratate separat.** Suma lunară și ziua de încărcare. Mâncarea se plătește întâi din tichete, iar aplicația propune „Mâncare din salariu = 2.743 − tichete”.
5. **„Ce salariu e ăsta?”** când notez un venit: butoane „Salariul meu 4.700 (10)” și „Salariul Anei 2.800 (12)”, plus „a venit azi / pe 10”.
6. **Card pentru fiecare adult** creat automat la pornire („Cardul Anei”), plus un plic „Bani de buzunar Ana/Eu”, ca „Telefonul Anei” să aibă ce arăta.
7. **Buton mare „+ Notează” fix în bara de jos**, în mijloc, pe toate ecranele.
8. **Notare foarte rapidă**: sumă, apoi un singur tap pe un plic din lista „cele mai folosite” (Lidl, Kaufland, Bolt, Farmacie).
9. **Ghidul să confirme vizibil** fiecare acțiune („✓ Am notat Lidl 120 lei din Mâncare. Anulează”) și să nu ascundă conversația.
10. **Import extras bancar** (BT, BCR, ING, Revolut CSV/PDF), cu reguli învățate. Există deja „De verificat”; de promovat.
11. **Alerte utile, nu alarme.** Ex.: „Mâine vine salariul Anei”, „Joi e scadența la grădiniță”, „Ai cheltuit la Mâncare 70% și e abia miercuri”.
12. **Plăți rare predefinite pentru România**: RCA, ITP, rovinietă, impozit pe casă/mașină (31 martie, cu reducere), rechizite (septembrie), Crăciun, Paște, 1 Iunie, zile de naștere.
13. **Alocația copilului** ca venit separat, eventual pusă direct în plicul copilului.
14. **Raport lunar simplu de trimis pe WhatsApp soției**: „Luna asta: +7.500 / −6.100, economisit 1.400, depășit la Taxi”.
15. **Un singur ecran „Luna asta”** în locul Analizei pe categorii: plicurile mele, cât am plătit față de cât am planificat, bifă/cruce.
16. **Mod mare / text mare** pentru părinți și bunici. Acum multe texte din Plan au 9–11 px.
17. **Plan compact**: o linie pe plic (nume, bară, „rămas X din Y”). Detaliile la atingere. „Șterge” doar în ecranul de editare.
18. **Pornirea pe varianta „salariu”** să întrebe și numele, cât ai acum pe card/cash și tichetele, ca la varianta „doar să notez”.

---

## Note pe ecrane (claritate 1–10)

| Ecran | Notă | De ce |
|---|---|---|
| Alegerea inițială (6 variante) | 6 | Prea multe variante care se suprapun. Primele două sunt clare, ultimele trei nu |
| Pornire „împarte salariul” (3 pași) | 8 | Scurt și clar. Minus: pasul 2 se deschide derulat, exemplele par valori completate, nu întreabă de tichete/nume/sold |
| Astăzi, imediat după pornire | 3 | Îmi cere ce am făcut deja („Fă primul plic”, „Spune când vine salariul”) și n-are buton Notează |
| Astăzi, cu propunerea de împărțire | 8 | Clar și liniștitor, cu excepția textului „Rămân X pentru Salariu Ana” |
| Astăzi, zilnic | 5 | Cifra mare e bună. Dar alertele false, cele 2 carduri de sold, backup, bilanțul greșit și tutorialul lungesc ecranul |
| Notează (cheltuială) | 8 | Rapid, alege plicul corect. Minus: categoriile greșite, formularul extins cu jargon |
| Notează (venit) | 5 | Nu recunoaște salariile declarate, „Venit rapid”, cardul Anei lipsește |
| Ghid (chat) | 4 | Răspunsuri bune la întrebări, dar notarea e fragilă, cifrele sunt altele, conversația dispare, dubluri nesemnalate |
| Plan | 3 | Foarte lung, jargon, formular de plic mereu deschis, statusuri false („DEPĂȘIT”) |
| Plan → Toate săptămânile | 8 | Clar, util |
| Plan → Pe luni | 8 | Excelent după ce ai istoric (nu apare în prima lună, normal) |
| Plan → Ce plătim lunar | 7 | Bun și util, dar ascuns jos, într-un panou închis |
| Plan → Plăți rare | 8 | Foarte bun; ar trebui scos la vedere |
| Mișcări | 6 | Lista e ok, dar filtrele ocupă jumătate din ecran și rândurile sunt tăiate |
| Obligații | 3 | Nu știe de rata declarată. Pare altă aplicație |
| Analiză | 5 | Frumoasă, dar pe categorii, nu pe plicurile mele. Mesaje contradictorii („pe plus” / „în echilibru”) |
| Mai mult | 7 | Organizat pe grupe, ok |
| Setări | 4 | 9.300 px, amestecă lucruri tehnice (fus orar, cod local, Firebase, valute) cu cele de bază |
| Aspect / teme | 7 | Temele arată bine, dar textele sunt de broșură. Modul întunecat e ok |
| Mod simplu | 4 | Aproape la fel ca modul normal, plus o bandă verde permanentă |
| Telefonul lui Ana | 5 | Idee excelentă. Dar „0 RON”, un buton „Dezactivează” neprotejat și tot bugetul vizibil în Notează |

---

## Cum am testat (reproductibil)

- Scripturile Playwright sunt în `U/` (`s1.mjs`…`s52.mjs`, plus `lib.mjs` cu profilurile p1–p6).
  - p1: pornire pe 25 sept.
  - p2: ciclul principal, 9–17 oct.
  - p3: modurile simple.
  - p4: plăți rare și istoric.
  - p5: test sold real.
  - p6: varianta „doar să notez”.
- N-am modificat nimic în repo. Datele au fost doar locale, fără sync. Ghidul a rulat offline (după încărcarea modulului).
