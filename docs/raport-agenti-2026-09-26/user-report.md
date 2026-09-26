# Buget Familie: raport de utilizator real (părinte, 2 salarii, tichete, chirie, rată, grădiniță)

Versiune testată: 1.1.96 (commit 1935b14), pe web, mobil 390×844, pornire de la zero (fără chei de setup). Totul a rulat local, fără sync.
Capturi și scripturi: `/tmp/claude-0/-home-user-buget-familie/6251941a-2f52-5fdd-bb21-2d9641b66e0b/scratchpad/agenti/user/`, prescurtat mai jos `U/`.

**Persona:** eu, 5.200 lei pe 10. Ioana, 4.300 lei pe 25. Tichete: 640 + 800 lei. Chirie 2.000, rată BCR 1.100, grădiniță 750, utilități (lumină, gaz, apă, Digi), mâncare 600 lei/săpt., taxi, neprevăzute. Plăți rare: RCA 1.450 (martie), impozit casă 620.
**Cum am testat:** am instalat aplicația sâmbătă, 26.09.2026, seara. Ioana primise salariul cu o zi înainte. Am trăit o lună, cu ceasul mutat zi de zi: 27.09, 29.09, 01, 02, 05, 08, 10, 12, 14, 17, 20, 23 și 25.10. Am notat în total ~30 de mișcări. Am închis un ciclu, am repartizat trei venituri și am trecut prin Obligații, Calendar, Mișcări, căutare, Analiză, Setări, cele trei teme și backup.

---

## 1. Pe scurt

Pornirea e foarte bună. În 3 pași am declarat veniturile, cheltuielile și toleranța datei de salariu. Presetul „Familie cu copii” mi-a completat aproape tot. „Plăți rare” (RCA, impozit → „~290 lei pe lună”) e exact ce trebuie unei familii din România. Notarea rapidă alege corect plicul pentru Lidl, Kaufland, Enel, Engie, Apa Nova, Bolt, farmacie, chirie, grădiniță și BCR. Problema veche cu „Cât ai acum pe card” e rezolvată: aplicația salvează diferența, nu dublează banii. Temele Întunecat și Navy arată foarte bine.

Pentru o familie cu **două salarii în zile diferite**, logica ciclului se rupe. Propunerea de repartizare socotește o lună de la salariul Ioanei, în timp ce planul are ciclul 26.09–10.10. Pe 10 aplicația îmi spune „Salariul e așteptat azi”, deși tocmai l-am notat. Vreme de 11 zile, cifra principală de pe Astăzi a fost **„PESTE LIMITA PLANULUI 1.488 lei”**, cu 4.000 de lei pe card. Pe 25, cu 8.100 lei pe card, am citit „venitul nu ajunge pentru tot ce ai declarat”.

Cea mai gravă e **închiderea de ciclu**. Implicit, cu toate căsuțele bifate, îmi propune să ridic Lumina de la 250 la **2.830 lei**, la fel Gazul, Apa și Chiria. Dacă apăs butonul mare, planul ajunge la **„Nerepartizați −8.485 lei”**.

Pe locul trei: la notarea rapidă, **benzina, Digi și Decathlon ajung în plicul Mâncare**. Din cauza asta, cifra zilei a căzut la 5 lei/zi.

**Notă globală (utilizator): 5,5/10.** Nucleul de pornire și notare merită 8. Dacă se repară P0 și cele trei P1 legate de ciclu, aplicația e ușor de recomandat.

---

## 2. Constatări

### #1 · P0 · Închiderea ciclului propune plicuri absurde (Lumină 250 → 2.830 lei), toate bifate implicit
- **Ce am văzut:** „Ciclul s-a încheiat → Ce arată cheltuielile tale”: Chirie 2.000 → 2.830, Lumină 250 → 2.830, Gaz 180 → 2.830, Apă 110 → 2.830, „ai cheltuit în medie 2.830 RON pe ciclu”. Toate au exact aceeași cifră și toate sunt bifate. Am apăsat „Începe ciclul 10 oct. – 10 nov.” și am ajuns la 11 plicuri · 14.920 lei, cu **Nerepartizați −8.485,45 lei** (`U/38-cycle-end-t-1.png`, `U/39-newcycle-0.png`).
- **Cauză:** `client/src/lib/cycle-close.ts:108-110` calculează istoricul pe **categorie** (`allocation.category`), nu pe plic. Chirie, Lumină, Gaz și Apă au toate categoria „Casă & facturi”, deci fiecare primește suma întregii categorii. Mai e o eroare: `spentPerCycle(..., days)` scalează la lungimea ciclului **închis** (15 zile: 26.09–10.10), nu a celui nou (32 de zile). De aici și Mâncare 2.657 → 1.030 lei pe lună.
- **Reproducere:** 2 plicuri sau mai multe cu aceeași categorie, cel puțin 3 mișcări în categoria respectivă, apoi închiderea ciclului.
- **Reparare:** filtrează istoricul după `allocationId`, cu fallback pe categorie doar când categoria are un singur plic. Normalizează la zilele ciclului nou. Nu propune nimic pentru plicurile „fixe” (facturi, rate), pentru că la ele suma o dă factura, nu obiceiul. Lasă sugestiile nebifate implicit sau cere un pas de confirmare în care se vede totalul „după”. Adaugă un test cu Chirie, Lumină și Gaz în „Casă & facturi”.
- **Efort:** S.

### #2 · P1 · Două salarii în zile diferite: ciclul planului și ciclul propunerii nu se potrivesc
- **Ce am văzut:**
  - 26.09: notez salariul Ioanei (25.09). Propunerea pune **toate** facturile din el, iar la Mâncare socotește „600 × 4 săpt. + 3 zile = 2.657”, adică o lună (25.09 → 25.10). Planul, în schimb, merge 26.09 → 10.10. Mâncarea pentru cele 2 săptămâni până la salariul meu primește **0**. Abia după „Sold real” (+900) se umple parțial.
  - 10.10: notez salariul meu și aplic. Pe Astăzi apare „FINAL DE LUNĂ · Toate plicurile au ajuns · **Salariul e așteptat azi**”, deși salariul e deja notat și împărțit. Tot restul de mâncare (1.967 lei) intră în „săptămâna 3”, care are 9 zile (05–13 oct.). Rezultatul e **418 lei/zi** timp de 4 zile (`U/34-d10-after-0.png`, `-1.png`).
  - 14.10 → 23.10: după ciclul nou 10.10–10.11, cifra principală de pe Astăzi e **„PLAN DE REVIZUIT · PESTE LIMITA PLANULUI 1.332 → 1.488 lei”**, cu 4.000–4.500 lei pe card. Aplicația nu ține cont că Ioana primește 4.300 pe 25 (`U/41-home-newcycle-ok-0.png`, `U/53-d23-0.png`).
  - 25.10: salariul Ioanei propune din nou Chirie 2.000, Rată 1.100 și celelalte, apoi scrie „**Rămân neacoperiți 1.376 RON — venitul nu ajunge**”. În același timp, Plicuri arată „**Nerepartizați 3.711 lei**” (`U/54-d25-split-*.png`, `U/60-navy-plicuri.png`). După aplicare, Grădinița **scade** de la 750 la 540 și Mâncarea de la 2.657 la 1.967.
- **Cauză:** `client/src/lib/monthly-needs.ts:205-213` (`proposeIncomeSplit`). Ciclul propunerii pornește de la venitul-deschizător și merge o lună (`nextPaydayAfter(cycleStart, declaredDay)`). Ciclul planului (`salaryPlan.periodStart/nextPayday`) are alte capete. Veniturile declarate care vin **în** ciclu (salariul Ioanei) nu sunt socotite ca bani care urmează.
- **Reparare:** un singur model de „lună a familiei”, de la primul salariu la următorul salariu de același tip, cu **toate** veniturile declarate din interval socotite ca „vin pe X”. Obligațiile se împart între salarii după „Din ce venit”, câmp care există deja în „Ce plătim lunar”. Mâncarea se socotește doar până la următorul venit declarat. Un salariu notat trebuie să ascundă „Salariul e așteptat azi”. Cât timp un venit declarat urmează în ciclu, textul „peste limita planului” trebuie înlocuit cu „vine salariul Ioanei pe 25 (4.300)”.
- **Efort:** L.

### #3 · P1 · Notează: plicul rămâne „Mâncare” când magazinul schimbă categoria (benzină, Digi, Decathlon)
- **Ce am văzut:** „Benzină OMV” → categoria Transport (corect), dar plicul „**Mâncare · 25 RON în S2**”. Același lucru la „Petrom”, „Digi” (Casă & facturi → Mâncare) și „Decathlon” (Alimente → Mâncare). Benzina de 250 lei a golit săptămâna de mâncare: „De mâine: **5,08 lei/zi**”. Am corectat Digi din Mișcări, dar pe 20.10 a ajuns din nou în Mâncare, deci corectura nu e învățată.
- **Reproducere:** Notează → 50 → „Benzină OMV”. Plicul arată Mâncare, deși există „Taxi / transport”, cu categoria Transport.
- **Cauză:** `client/src/components/QuickEntryPanel.tsx:95-105`. La deschidere, categoria implicită e Alimente, iar efectul setează plicul = Mâncare. Când textul schimbă categoria, `currentIsValid` rămâne adevărat, fiindcă `candidates` conține toate plicurile, iar fallback-ul pe `matched[0]` rulează doar când plicul e „outside”. În plus, `ENVELOPE_HINTS` (`client/src/lib/finance-data.ts:1713-1726`) nu știe benzinăriile (OMV, Petrom, Rompetrol, MOL, Lukoil, „benzină”, „motorină”). Și nici Digi → Abonamente: modelul pentru Digi caută un plic numit „telefon/internet/mobil”.
- **Reparare:** când categoria se schimbă și alegerea nu a fost atinsă de om, resetează plicul la `matched[0]` sau la „În afara plicurilor”. Adaugă benzinăriile la Transport și leagă Digi/Orange/Vodafone și de un plic „Abonamente”. Când omul corectează plicul unei mișcări, propune „Ține minte: Digi → Abonamente?” (regulă de comerciant).
- **Efort:** S.

### #4 · P1 · Imediat după repartizare, Astăzi spune „358 lei/zi” deși mâncarea are 0 lei
- **Ce am văzut:** 26.09, după ce am aplicat împărțirea salariului Ioanei (toți banii în facturi, Mâncare 0): „POȚI FOLOSI AZI **358,33** · Mai sunt **4.300 bani liberi** pentru 12 zile” (`U/15-after-ioana-t-0.png`, text identic și după reload). Plicuri arată „Nerepartizați 0”.
- **Cauză:** `client/src/lib/household-insights.ts:835-856`. Când plicul săptămânal are 0 (`rhythm.hasWeekly` e fals), cifra cade pe `fromPace`/lichid și ignoră că banii sunt deja puși în plicuri.
- **Reparare:** dacă există plicuri și nimic nu e nerepartizat, cifra zilei = plicurile variabile ale săptămânii (aici 0), cu textul „Pune bani în Mâncare”.
- **Efort:** S.

### #5 · P1 · Calendarul: „Sold estimat 27 nov.: 18.371 lei”, fără chirie, rată sau facturi
- **Ce am văzut:** Obligații → Calendar de scadențe. Linia urcă de la 4.571 la 18.371 lei. Adună salariile declarate, dar cheltuielile din „Ce plătim lunar” nu au zi de scadență, deci nu scad nimic (`U/44-calendar-0.png`). Tot atunci, Obligații spune „Nu ai scadențe apropiate”, deși chiria și rata sunt „de plătit”.
- **Reparare:** în onboarding și în „Ce plătim lunar”, cere opțional **ziua** plății („chiria pe 1, rata pe 5”). Până atunci, calendarul să scadă obligațiile lunare fără dată ca „undeva în lună” sau să afișeze „estimare fără facturi: X”.
- **Efort:** M.

### #6 · P2 · Notează venit: scurtăturile „Salariul meu · 5.200” și „Salariul Ioanei · 4.300” sunt tăiate (4 px înălțime)
- **Ce am văzut:** în foaia „Cât a intrat?” se vede doar o fâșie de 4 px din cele două butoane (`U/12-salary-form.png`). Butonul există (l-am apăsat din script), dar un om nu-l vede.
- **Cauză:** `client/src/capture-amount-first.css:7-14` face din `.bf-quick-entry-scroll` un flex pe coloană, iar `.bf-declared-incomes` (overflow-x:auto) se micșorează la `min-height:0`. Am măsurat: `height: 4px`.
- **Reparare:** `html body .bf-quick-entry-scroll > * { flex-shrink: 0; }` (sau doar pentru `.bf-declared-incomes`).
- **Efort:** S.

### #7 · P2 · „Mai sunt 4.300 **bani** liberi”
- **Ce am văzut:** pe Astăzi, „Azi poți 358,33 lei. Mai sunt 4.300 bani liberi pentru 12 zile.” În română, „4.300 bani” înseamnă 43 de lei.
- **Cauză:** `client/src/lib/household-insights.ts:856` („{available} bani liberi”, cu `stripLei`).
- **Reparare:** „Mai sunt 4.300 lei liberi pentru 12 zile.”
- **Efort:** S.

### #8 · P2 · Ajustarea de sold („Bani disponibili +900”) apare ca venit peste tot
- **Ce am văzut:** după „Sold real = 5.200”, aplicația creează corect o mișcare de +900. Doar că apare ca „A INTRAT UN VENIT · Bani disponibili (Eu)” cu propunere de împărțire. Pe Astăzi e trecută la „INTRAT +900”. În Analiză, septembrie are „venituri 6.640 lei” (4.300 + 900 + tichete).
- **Reparare:** marchează aceste mișcări ca „Corecție sold” (alt `kind` sau flag). Scoate-le din „Intrat”, din rapoarte și din bilanț, și formulează propunerea „Ai 900 lei pe card care nu sunt în plicuri. Îi pun în plicuri?”.
- **Efort:** M.

### #9 · P2 · Tichetele de masă umflă „Nerepartizați” și „Pune bani în plic”
- **Ce am văzut:** onboardingul spune „Tichetele nu le trece aici”, iar cheltuielile pe tichete intră corect „în afara plicurilor”. Totuși, pe Astăzi scrie „În Plan mai ai **1.188,55 nerepartizați**: poți pune o parte în plic”, iar suma aceea e exact soldul de pe tichete. Mai sunt și alte probleme:
  - Tichetele nu apar nicăieri ca bani pentru mâncare, deși le folosim fix la Lidl și Kaufland. Mâncarea pe card și cea pe tichete nu se văd împreună.
  - Sursa „Bonuri de masă” e doar „Eu”, iar tichetele Ioanei ajung la mine.
- **Reparare:** exclude sursele `meal` din „nerepartizați”. Arată pe cardul Mâncare un rând „+ tichete: 1.156 lei”. La onboarding, întreabă „Primiți tichete? Cât, de câte ori?” și creează câte o sursă pentru fiecare membru.
- **Efort:** M.

### #10 · P2 · Pe Astăzi apar două cifre diferite pentru „cât pot azi”
- **Ce am văzut:** 14.10, același ecran. Banner-ul spune „SĂPTĂMÂNA MERGE REPEDE · Mâncare S2 … cel mult **43,50 RON pe zi**”. Dedesubt, banda zilelor spune „Mai rămân 217,50, cam **54,38 pe zi** până duminică” (`U/41-home-newcycle-ok-0.png`). O cifră include ziua de azi, cealaltă nu.
- **Reparare:** aceeași formulă (a „cifrei zilei”) și pentru banner-ul de ritm.
- **Efort:** S.

### #11 · P2 · Săptămâni de 9 zile și „S1” fantomă după ciclul nou
- **Ce am văzut:** „A ÎNCEPUT SĂPTĂMÂNA 3 · 05 oct. – 13 oct. · 1.886 RON pentru 9 zile” (fereastra ±3 zile a salariului e lipită de ultima săptămână). După ciclul nou, la Notează apare „Mâncare · fără tranșă activă | S1: 171 RON rămași din 171 RON”, cu cifre din ciclul vechi (14.10). Editarea unei mișcări vechi (29.09) arată săptămânile ciclului nou.
- **Reparare:** ultima săptămână se oprește la data așteptată. Zilele de toleranță se afișează separat („dacă salariul întârzie: +3 zile”). La mișcările din ciclul anterior, ascunde „Din ce săptămână”.
- **Efort:** M.

### #12 · P2 · „Ce plătim lunar”: plățile rare nu intră în rezumatul lunii
- **Ce am văzut:** după RCA (~290/lună) și impozit (~120/lună), rezumatul spune tot „pleacă ~7.710 RON … Rămân ~1.790 RON liberi”.
- **Reparare:** adaugă „+ ~410 pentru plăți rare”, cu totalul corect.
- **Efort:** S.

### #13 · P2 · Analiză: „față de medie” după o singură lună, cu tot roșu
- **Ce am văzut:** „Media ultimelor 1 luni”: Casă & facturi **+2.637**, Credite +1.100, Educație +750, toate în roșu, pentru că septembrie avea doar 5 zile de date (`U/49-analiza-0.png`). Tot aici, „LUNA ANALIZATĂ octombrie” amestecă ciclul (706 lei cheltuiți) cu luna calendaristică din grafic (5.367 lei).
- **Reparare:** secțiunea să apară abia după 2–3 luni complete, sau cu textul „încă nu am destul istoric”. Fix gramatical: „ultima lună”. Afișează clar „Ciclu 10 oct.–10 nov.” lângă cifre.
- **Efort:** S.

### #14 · P3 · Căutarea: rezultate fără sumă și dată, iar numele plicului nu e găsit
- **Ce am văzut:** „lidl” întoarce două rânduri identice „Lidl · Alimente · Eu”, fără sumă și fără dată. „mancare” întoarce „Nu am găsit…”. Titlul foii se schimbă din „Caută o mișcare” în „Ce vrei să faci?”. Câmpul nu primește focus la deschidere (`U/48-search-lidl.png`).
- **Reparare:** adaugă suma și data pe fiecare rând, caută și după plic/categorie (fără diacritice) și pune autofocus pe câmp.
- **Efort:** S.

### #15 · P3 · Mementoul de backup rămâne după „Salvează pe telefon” din Setări
- **Ce am văzut:** am descărcat backup-ul din Setări (fișierul e ok, 37 KB), dar pe Astăzi a rămas „E timpul pentru copia de siguranță a săptămânii”.
- **Cauză:** `SettingsPanel.tsx` (`exportBackup`) nu apelează `writeAutoBackup({ lastAt })`. Doar `AutoBackupCard.tsx:52` o face.
- **Reparare:** actualizează `lastAt` la orice export reușit.
- **Efort:** S.

### #16 · P3 · Mărunțișuri de text și aspect
- Pasul 2 din onboarding: eticheta „Pornește de la” e tăiată („rnește de la”) de rândul de chips care derulează (`U/06-onb2-family.png`).
- Pasul 3 vorbește doar de „Următorul: ~10 octombrie”, nu și de salariul Ioanei de pe 25.
- După „Gata” în onboarding ajung în **Plicuri** cu „0 plicuri · 0 RON · Așază primii lei într-un plic”, deși tocmai declarasem 10 cheltuieli. Textul de final promitea „pe Astăzi apare propunerea”.
- Notează, cheltuială: eticheta „SAU ALTĂ CATEGORIE” apare înaintea gridului de categorii, care e mai jos, sub „Cine a înregistrat” și sursă.
- Setări: „SURSE ȘI SOLD INITIAL” (lipsește Ț). „Pornește: Telefonul lui Eu”. aria-label „Culoarea lui Ioana: . Atinge pentru alta.” (numele culorii lipsește). Pagina are ~9.250 px.
- Planul gratuit „Casa” scrie „Până la 10 plicuri · Un membru”, dar am 2 membri și am putut adăuga al 11-lea plic fără niciun mesaj. Ori textul e greșit, ori limita nu e aplicată.
- Cardul unui plic fix are două cifre: „2.000 RON rămași din 2.000” și „TOT PLICUL 0 RON / 2.000 RON”. A doua înseamnă „cheltuit”, dar nu scrie asta.
- Banda zilelor de pe Astăzi amestecă sensuri: la zilele trecute arată cât s-a cheltuit (211, 365), la cele viitoare cât e disponibil (54, 419).
- Mementourile „Cât ai de fapt pe Card debit? … **Ciclu nou** — e cel mai ușor moment” au stat pe Astăzi 11 zile la rând.
- **Observat o singură dată, nereprodus:** o plată (Rata BCR, 05.10) a dispărut după ce am închis browserul la ~1 s după salvare. La a doua încercare s-a păstrat. Poate fi un efect al ceasului înghețat din test (stampă egală LS/IDB), dar merită un test de „închid aplicația imediat după Gata”.

---

## 3. Idei de dezvoltare (în ordinea în care le-aș vrea)

1. **„Luna familiei” cu două salarii** (vezi #2): un ecran „Salariul meu (10) plătește: chirie, rată. Salariul Ioanei (25) plătește: grădiniță, utilități, mâncarea 25–10”. Câmpul „Din ce venit” există deja, doar că nu se vede la onboarding.
2. **Ziua de plată pentru fiecare factură** („chiria pe 1, rata pe 5, Enel pe ~15”), ca să meargă Calendarul, Obligațiile și mementourile. În onboarding ajunge un câmp opțional „ziua”.
3. **Tichetele ca plic separat de mâncare**: „Mâncare: 1.967 pe card + 1.156 pe tichete”. Plus un memento „au intrat tichetele?” pe data lor.
4. **Învățare din corecturi:** „Ai mutat Digi în Abonamente. Fac asta mereu?” (reguli comerciant generate automat).
5. **Rata bancară legată de o datorie:** „Rate bancă 1.100” din „Ce plătim lunar” ar putea crea singură datoria BCR (sold, câte rate mai sunt). Acum „Sold datorii 0 RON”.
6. **Închidere de ciclu ca rezumat de 30 de secunde:** „Ai economisit 236 la neprevăzute. Mută în Fond de urgență?” în loc de liste de ajustări.
7. **Partajarea bilanțului săptămânii pe WhatsApp** (aplicația îl pomenește: „Poți trimite bilanțul familiei”), cu 3 rânduri simple.

---

## 4. Ce e deja foarte bine

- Onboardingul în 3 pași, cu presetul „Familie cu copii” și validare clară. Pentru un român, „Mâncare pe săptămână, restul pe lună” e natural.
- **„Sold real”** nu mai dublează banii: creează diferența (+900) și propune ce să facă cu ea. „Cât ai de fapt pe Card debit? Eu zic 289” a fost exact.
- **Plicul ales după magazin**, pentru furnizorii cunoscuți (Lidl, Kaufland, Mega, Carrefour, Enel, Engie, Apa Nova, Bolt, Catena/Dona, BCR, grădiniță, chirie) și cu fallback pe tichete „în afara plicurilor”.
- **Plăți rare** (RCA, impozit, Crăciun, rechizite, rovinietă): „~290 RON pe lună” e o funcție pe care nicio altă aplicație nu o face atât de simplu.
- **Plicurile fixe plătite apar ca „✓ PLĂTIT”**, verde, fără alarme false. Problema mare din auditul vechi e rezolvată.
- Mișcările (jurnalul): grupare pe zile, totaluri pe zi, filtre, export CSV, editare și ștergere cu confirmare, „Anulează” imediat după notare.
- Temele Întunecat și Navy au contrast bun și arată îngrijit (`U/63-dark-astazi-0.png`, `U/63-navy-noteaza.png`).
- Backup local JSON dintr-o atingere, cu propunere de copie săptămânală și previzualizare înainte de import.
- Textul din „Încredere și confidențialitate” e cinstit și clar (inclusiv ce pleacă la ghidul online).

*Neverificat în acest test: ghidul AI (ar fi apelat funcțiile reale) și sync (interzis pe server real).*
