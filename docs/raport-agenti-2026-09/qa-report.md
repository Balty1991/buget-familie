# Raport QA — Buget Familie (testare exploratorie, 25.09.2026)

Director probe și capturi: `/tmp/claude-0/-home-user-buget-familie/6251941a-2f52-5fdd-bb21-2d9641b66e0b/scratchpad/agents/qa/`
(`p1.ts`…`p9.ts` = probe pe bibliotecă rulate cu `./node_modules/.bin/tsx`; `ui-*.mjs` = Playwright pe dev serverul de la :5174; `*.png` = capturi.)

## Rezumat

- Suita unitară: **103 fișiere / 1051 teste trec** (`pnpm test`). `e2e/flows.e2e.mjs` trece. `e2e/layout.e2e.mjs` nu s-a terminat înainte de limita de 400 de secunde pe care i-am pus-o (vezi „Zone netestate”).
- Am reprodus **18 bug-uri**: 1 critic, 5 mari, 7 medii și 5 mici. Cele mai grave sunt în fluxul nou de repartizare a salariului („Ce plătim lunar”): anularea, al doilea salariu și trecerea la un ciclu nou pot strica sumele din plicuri fără niciun avertisment. Asistentul (analyst) poate spune „Poți folosi azi X” când X este de fapt deficitul.
- Nu am găsit overflow orizontal la 360px și 1280px pe 5 teme (white/dark/navy/aurora/cyber) și 5 ecrane, cu date extreme (6 membri, nume lungi, sume de milioane). Pe desktop însă bara de navigare mobilă rămâne vizibilă.
- Pe ecranele testate nu au apărut erori JS în consolă.

## Bug-uri

### BF-01 — Anularea primei repartizări, după ce a fost aplicată a doua, șterge toate plicurile ciclului — **CRITICĂ**
- **Pași:** 3 cheltuieli lunare (Rate 1.400, Lumină 400, Mâncare 600/săpt.) și 2 salarii în același ciclu: Radu 1.500 (acum 5 zile), Ioana 3.000 (acum 2 zile). Aplici repartizarea pentru ambele. În Plan → „Ce plătim lunar”, apeși „Anulează” pe rândul „Salariul lui Radu” și confirmi.
- **Actual:** plicurile Rate=1.400, Lumină=400 și Mâncare=2.657 **dispar toate**. Aplicarea „Salariul Ioanei” rămâne în listă, dar trimite spre plicuri care nu mai există. Dacă plicurile ar fi avut cheltuieli, ar fi revenit la suma dinaintea ciclului (`previousAmount`) și s-ar fi pierdut și contribuția Ioanei. Dacă propui din nou repartizarea lui Radu, ea pornește cu `fundedBefore=0`.
- **Așteptat:** anularea scade doar contribuția salariului anulat. Altă variantă: anularea e permisă doar pentru cea mai recentă repartizare din ciclu sau le anulează în cascadă, cu avertisment.
- **Fișier:** `client/src/lib/finance-data.ts:714-735` (`revertSalaryAllocationApplication`: restaurează `previousAmount` și șterge plicurile `created` fără să verifice aplicările ulterioare); `client/src/lib/monthly-needs.ts:305-311`; UI: `client/src/components/MonthlyNeedsPanel.tsx:155-158` și 243.
- **Dovadă:** `ui-undo.mjs` → `before: Rate=1400, Lumină=400, Mâncare=2657` / `after undo Radu: (gol)` / `apps: ['Salariul Ioanei']`. Captură: `undo-first-salary.png`. Aceeași reproducere pe bibliotecă: `p1.ts` (cazul C).

### BF-02 — Un al doilea salariu venit la peste 20 de zile după primul e tratat ca ciclu nou și suprascrie plicurile — **MARE**
- **Pași:** venituri declarate „Al meu” 4.000 (ziua 1) și „Al ei” 3.000 (ziua 25). Cheltuieli: Chirie 2.500, Lumină 400, Mâncare 600/săpt. Aplici salariul din 01.09, apoi pe cel din 25.09.
- **Actual:** după primul salariu, Mâncare=1.100. Propunerea pentru al doilea salariu calculează ciclul 25.09–25.10 cu `fundedBefore=0` și propune din nou Chirie 2.500 și Lumină 400. Mâncare devine **100** (s-au pierdut 1.000 lei de limită la mijlocul ciclului). Nici propunerea primului salariu nu spune „rămân … pentru Al ei”, pentru că 24 de zile depășesc fereastra.
- **Așteptat:** veniturile declarate ale aceluiași ciclu lunar (ziua 1 și ziua 25) completează același ciclu 01.09–01.10.
- **Fișier:** `client/src/lib/monthly-needs.ts:28` (`CYCLE_WINDOW_DAYS = 20`), `fundedInCycle` (~l.85-100), `otherIncomeSoon` (~l.120-131).
- **Dovadă:** `p7.ts` → `after s1 [Chirie 2500, Lumină 400, Mâncare 1100]` / `s2 proposal … Chirie fundedBefore 0 amount 2500` / `after s2 [… Mâncare 100]`.

### BF-03 — Asistentul spune „Poți folosi azi 4.457 RON” când planul e depășit cu 4.457 RON — **MARE**
- **Pași:** planul e peste limită (plicurile depășesc soldul surselor, „Nerepartizat” = −4.457). În ghid/asistent întrebi „cât mai pot cheltui azi pe taxi?” (orice întrebare care ajunge la `answerPace`).
- **Actual:** „Poți folosi azi 4.457 RON, la fel ca pe Astăzi. De acoperit prin limită… Ești sub ritmul de azi. … Nerepartizat: −4.457 RON”. Cifra de pe Astăzi, când planul e depășit, este **deficitul** („Peste limita planului”), nu o sumă disponibilă.
- **Așteptat:** când `overPlan` e adevărat, răspunsul spune că planul e depășit cu X și că azi se pot folosi 0 lei.
- **Fișier:** `client/src/lib/analyst.ts` ~l.455-470 (`answerPace` folosește `summary.heroValue` fără să verifice `summary.overPlan`); `client/src/lib/today-summary.ts:49-52` (`heroValue = Math.abs(math.remaining)` când `overPlan`).
- **Dovadă:** `p4.ts` → „Q: cât mai pot cheltui azi pe taxi? → Poți folosi azi 4.457 RON … Nerepartizat: -4.457 RON”.

### BF-04 — În ziua salariului, salariul notat intră în ciclul care se încheie: „Poți folosi azi 5.200 RON, ritm 5.200 lei/zi” — **MARE**
- **Pași:** plan cu `nextPayday = azi` (testat cu flex 0 și flex 3). Notezi salariul de azi (4.700), fără să aplici încă repartizarea. Deschizi Astăzi.
- **Actual:** eroul arată „POȚI FOLOSI AZI 5.200,00 RON — Ritm 5.200 lei/zi, din 5.200 disponibili pe 1 zi”, adică tot salariul, de cheltuit azi. După „Aplică repartizarea” cifra se corectează, dar până atunci îndemnul e periculos. Dacă familia apasă „Nu acum”, rămâne așa toată ziua.
- **Așteptat:** un venit din ziua de salariu deschide ciclul următor (sau e exclus din ciclul care se încheie), iar eroul nu propune să cheltui tot salariul într-o zi.
- **Fișier:** `client/src/lib/finance-data.ts:857-860` (`inPlanPeriod` include `nextPayday` și zilele de flex) și calculul `brief.spendable` din `household-insights.ts` (`todayBrief`).
- **Dovadă:** `ui-payday.mjs` → `before: POȚI FOLOSI AZI ¦ 5.200,00 ¦ Ritm 5.200 lei/zi, din 5.200 disponibili pe 1 zi.` Capturi: `axe-today-white.png`, `axe-today-dark.png`, `today-1280-dark.png`.

### BF-05 — Repartizarea care deschide un ciclu nou păstrează mutările între plicuri și între săptămâni din ciclul vechi — **MARE**
- **Pași:** ciclul 10.08–10.09 are un transfer Distracție → Mâncare de 300 lei și o mutare S1 → S4 de 400 lei pe Mâncare. Pe 10.09 intră salariul și aplici repartizarea: planul trece pe 10.09–10.10.
- **Actual:** Mâncare are `amount` 2.657, dar buget **2.957**; Distracție are `amount` 500, dar buget **200**. Tranșele noului ciclu sunt S1=200 și S4=1.000 (în loc de 600/600). `startNextCycle` din `cycle-close.ts` golește explicit `transfers`/`weekTransfers`, dar `applyIncomeSplit` nu o face.
- **Așteptat:** când ciclul nou e deschis din repartizare, `transfers: []` și `weekTransfers: []`, la fel ca la `startNextCycle`.
- **Fișier:** `client/src/lib/monthly-needs.ts:329-345` (obiectul `cycle` pune doar `periodStart`/`nextPayday`). De comparat cu `client/src/lib/cycle-close.ts:175-176`.
- **Dovadă:** `p2.ts` (cazul J): `J Mâncare {"amount":2657,"budget":2957}`, `J Distracție {"amount":500,"budget":200}`, `J food weeks [[1,…,200],[2,…,600],[3,…,600],[4,…,1000],[5,…,557]]`.

### BF-06 — După ieșirea din „Telefonul lui X”, telefonul rămâne al copilului: cheltuielile părintelui se notează pe copil — **MARE**
- **Pași:** Setări → „Telefonul unui membru al familiei” → alegi Ana → Pornește. Apoi „Ieși din modul acesta” → Ieși. Pe Astăzi apeși „Notează”.
- **Actual:** `selfMemberId` rămâne `ana` după ieșire. Formularul rapid are membrul „Ana” preselectat și propune plicul „Bani de buzunar · 200 RON rămași” pentru o cheltuială la Alimente. Tot ce notează părintele ajunge pe numele Anei și scade din banii ei de buzunar.
- **Așteptat:** la ieșire se restabilește membrul de dinainte, sau aplicația întreabă „al cui e telefonul acum?”.
- **Fișier:** `client/src/components/MemberModeSetup.tsx:16` (setează `selfMemberId`); `client/src/components/MemberModeScreen.tsx` în `exit` (nu-l restabilește); `client/src/lib/member-mode.ts`.
- **Dovadă:** `ui-member.mjs` → `self after start: ana` / `self after exit: ana` / `quick entry selects: Alimente | Ana | Card · 3.000 RON | Bani de buzunar · 200 RON rămași`. Captură: `member-exit-quick.png`.

### BF-07 — Două cheltuieli lunare cu același nume (fără diferențe de majuscule sau spații) ajung în același plic și se suprascriu — **MEDIE**
- **Pași:** cheltuielile „Rate” 1.000 și „rate ” 500 (de exemplu, două bănci). Aplici un salariu de 5.000.
- **Actual:** există un singur plic „Rate” cu **500**, iar ambele cheltuieli sunt legate de el. Cei 1.000 lei ai primei cheltuieli se pierd, deși sunt socotiți „acoperiți”.
- **Așteptat:** plicuri separate, sau suma plicului să fie totalul cheltuielilor legate de el. Ar ajuta și o validare de nume duplicat.
- **Fișier:** `client/src/lib/monthly-needs.ts` `envelopeFor` (~l.262-264) și maparea `allocations` din `applyIncomeSplit` (~l.310), care pune `amount: next` fără să adune.
- **Dovadă:** `p1.ts` (cazul A): `A dup labels allocations [["Rate",500]]`.

### BF-08 — Dacă o cheltuială trece din săptămânal în lunar, plicul rămâne pe tranșe săptămânale vechi — **MEDIE**
- **Pași:** „Taxi” 100/săptămână, aplici un salariu (plic cu `weeklyAmount: 100`). Schimbi Taxi pe lunar, 500. Aplici salariul următor.
- **Actual:** plicul are 500, dar `weeklyPace: true, weeklyAmount: 100`. Tranșele sunt 100/100/100/100/100, deci o cursă de 150 lei într-o săptămână apare „săptămână depășită”.
- **Așteptat:** la cadență lunară plicul primește `weeklyPace: false` și pierde `weeklyAmount`.
- **Fișier:** `client/src/lib/monthly-needs.ts` ~l.310 (`...(line.perWeek ? {weeklyAmount, weeklyPace: true} : {})` nu curăță nimic pe ramura lunară).
- **Dovadă:** `p6.ts` → `sep taxi [500,true,100,…]`, `sep weeks [[1,…,100],[2,…,100],…]`.

### BF-09 — La importul unui extras, două mișcări diferite cu aceeași dată și sumă din același fișier: a doua se pierde ca „duplicat” — **MEDIE**
- **Pași:** CSV cu `07.09.2026;LIDL BUCURESTI;-12,00` și `07.09.2026;STB BILET;-12,00`.
- **Actual:** iese o singură propunere (Lidl 12), iar `duplicates: 1`. Biletul STB nu ajunge în registru.
- **Așteptat:** deduplicarea din același fișier ține cont și de descriere (sau de comerciant). Dublurile reale (rânduri identice) pot rămâne excluse.
- **Fișier:** `client/src/lib/statement-import.ts:394-396` (`alreadyStaged` compară doar data, tipul și suma). Testul existent „nu dublează rândurile identice” acoperă doar rânduri cu descriere identică.
- **Dovadă:** `p3.ts` → `drafts [["2026-09-07","Lidl",12,…], …]`, `dups 1`.

### BF-10 — Pe Astăzi, banda unică de alertă ascunde alerte mai importante și nu le numără — **MEDIE**
- **Pași:**
  - (a) Mâncare este „aproape de limită” (83% din tranșa S2), iar Taxi (60% folosit) se termină pe 3 octombrie, cu 9 zile înainte de salariu.
  - (b) Trei plicuri depășite (Taxi, Lumină, Gaz) și unul aproape de limită.
- **Actual:**
  - (a) Apare doar „APROAPE DE LIMITĂ · Mâncare 83%”. Alerta „SE TERMINĂ ÎNAINTE DE SALARIU · Taxi” nu apare și nu există „Încă o alertă”.
  - (b) Apare doar „PLIC DEPĂȘIT · Taxi”, fără „Încă N alerte la plicuri”.
- **Așteptat:** ordinea din comentariu („depășit → săptămână → se termină → aproape de limită”) și un număr corect al celorlalte alerte, pe plicuri, nu pe tipuri de alertă.
- **Fișier:** `client/src/pages/TodayView.tsx:180-194`. `runOutAlert` caută doar plicul lui `activeEnvelopeAlert` când acesta există, iar `noticeOrder` numără tipuri de bandă, nu plicuri.
- **Dovadă:** `ui-notice.mjs` → `runOut:[["Taxi","2026-10-03",9]]`, `notices: ['APROAPE DE LIMITĂ Mâncare 83% …']`. `ui-notice2.mjs` → 3 plicuri „over” și `notices: ['PLIC DEPĂȘIT Taxi …']`. Capturi: `notice-order.png`, `notice-multi-over.png`.

### BF-11 — Asistent: „De ce mi-a scăzut plicul de taxi?” fără un plic de taxi răspunde despre alt plic — **MEDIE**
- **Pași:** plicurile Rate bănci, Mâncare, Lumină (fără Taxi). Întrebi „De ce mi-a scăzut plicul de taxi?”.
- **Actual:** „Din «Rate bănci» au plecat 1.400 RON pe ciclul; rămân 0 RON.” Răspunsul vine din primul plic din listă.
- **Așteptat:** „Nu ai un plic pentru taxi/transport”, cu o sugestie.
- **Fișier:** `client/src/lib/analyst.ts:800-802` (`|| allocations[0]`).
- **Dovadă:** `p4.ts`, primul răspuns.

### BF-12 — O cheltuială fără plic, dintr-o categorie comună mai multor plicuri, e scăzută din fiecare plic — **MEDIE**
- **Pași:** plicurile Lumină 400 și Apă 100, ambele pe „Casă & facturi” (așa le creează implicit NeedsQuickStart pentru Lumină/Gaz/Apă). O cheltuială de 380 la „Casă & facturi” fără `allocationId` (de exemplu, date vechi sau sincronizate dintr-o versiune mai veche).
- **Actual:** Lumină are 380/400 („watch”), iar Apă are 380/100 („over”, −280). Aceeași cheltuială e numărată de două ori. Asistentul spune „Din Lumină au plecat 380 … Nicio mișcare pusă pe plic în perioada asta”, ceea ce se contrazice.
- **Așteptat:** potrivirea pe categorie se face doar când un singur plic are acea categorie, așa cum face deja `needAdjustments`.
- **Fișier:** `client/src/lib/finance-data.ts:876-890` (`allocationSpent`), aceeași regulă în `allocationWeeksStatus` (~l.1047-1051) și `household-insights.ts:949-955`; `client/src/lib/analyst.ts:808-822`.
- **Dovadă:** `p2.ts` (cazul N) și `p4.ts` (întrebarea despre lumină).

### BF-13 — Venitul declarat în ziua 31 are o dată invalidă în lunile scurte — **MICĂ**
- **Pași:** „Salariul ei” declarat pe 31. Salariul meu intră pe 15.09 (sau pe 15.02.2027).
- **Actual:** `nextIncome.date = "2026-09-31"`, afișat „rămân 1000 RON pentru Salariul ei (**1 octombrie**)”. În februarie: `"2027-02-31"`, afișat „**3 martie**”.
- **Așteptat:** 30 septembrie și 28 februarie, cu aceeași regulă de limitare ca în `sameDayNextMonth`.
- **Fișier:** `client/src/lib/monthly-needs.ts` ~l.123 (`otherIncomeSoon`: `${income.date.slice(0, 8)}${day}` fără limitare la ultima zi a lunii).
- **Dovadă:** `p8.ts` și `p1.ts` (cazul B).

### BF-14 — Pe desktop (≥761px) bara de navigare mobilă rămâne vizibilă, pe lângă navigația de sus — **MEDIE (UI)**
- **Pași:** deschizi aplicația la 1280×900, pe orice temă.
- **Actual:** apar două navigații: `os-desktop-nav` sus și `os-dock` („Navigație mobilă”) jos, pe toată lățimea, cu 65px ocupați. Tastatura trece de două ori prin Astăzi…Analiză.
- **Așteptat:** regula `@media (min-width:761px) { .os-dock { display:none } }` ar trebui să se aplice.
- **Fișier:** `client/src/apk-safe-area.css:27-33` (`display: flex !important` pe `.os-dock` și variantele pe teme) anulează `client/src/household-os-chrome.css:601-602`.
- **Dovadă:** captura `today-1280-dark.png`. `ui-dockcss.mjs` arată regula câștigătoare. `ui-kbd.mjs` arată ordinea tab dublată.

### BF-15 — Accesibilitate: butoanele Modifică/Șterge sunt în `<summary>` la rândurile din „Ce plătim lunar” — **MICĂ (a11y, axe „serious”)**
- **Pași:** Plan → „Ce plătim lunar” deschis → axe-core (WCAG 2.1 AA).
- **Actual:** încălcarea `nested-interactive` pe `.bf-needs-item > summary`, pe toate temele (white/dark/navy/cyber). Cititoarele de ecran anunță o singură comandă, iar butoanele din ea sunt greu de accesat.
- **Fișier:** `client/src/components/MonthlyNeedsPanel.tsx:68-77`.
- **Dovadă:** `ui-axe.mjs` (log). Captură: `axe-needs-dark.png`.

### BF-16 — Focusul se pierde după „Aplică repartizarea” de la tastatură — **MICĂ (a11y)**
- **Pași:** Tab până la „Aplică repartizarea” pe cardul „A intrat un venit”, apoi Enter.
- **Actual:** `document.activeElement` devine `<body>`. Cine folosește tastatura sau un cititor de ecran pierde locul în pagină.
- **Așteptat:** focusul trece pe confirmarea „repartizat” (cu butonul Anulează) sau pe titlul ei.
- **Fișier:** cardul de repartizare de pe Astăzi (`client/src/components/TodayBrief.tsx` ~l.120-130).
- **Dovadă:** `ui-kbd.mjs` → `focus after apply: BODY …`.

### BF-17 — Copia automată de siguranță se oprește dacă `lastAt` e în viitor sau nu e o dată validă — **MICĂ**
- **Pași:** `autoBackupDue({enabled:true, lastAt:"2027-03-01T10:00:00Z"})`, de exemplu după ce ceasul telefonului a fost greșit, sau `lastAt:"ieri"`.
- **Actual:** `false` în ambele cazuri. Copia nu mai pornește până când ceasul ajunge la acea dată (sau niciodată, pentru o valoare invalidă).
- **Așteptat:** o dată din viitor sau invalidă se tratează ca „copie necesară”.
- **Fișier:** `client/src/lib/auto-backup.ts:32-33`.
- **Dovadă:** `p9.ts`.

### BF-18 — „IEȘIT −0,00 RON” când nu s-a cheltuit nimic — **MICĂ (cosmetic)**
- **Pași:** ciclu cu venit, dar fără cheltuieli.
- **Actual:** dala „Ieșit” afișează „−0,00 RON”.
- **Fișier:** `client/src/pages/TodayView.tsx:370` (semnul „−” e pus mereu).
- **Dovadă:** `axe-today-dark.png`, `today-1280-dark.png`.

## Suspiciuni și riscuri (nereproduse ca defect clar sau posibil intenționate)

1. **Anularea nu restabilește ciclul.** Dacă repartizarea a deschis un ciclu nou (`periodStart`/`nextPayday`), „Anulează” lasă ciclul mutat (`p1.ts`, cazul D). Când venitul a fost notat greșit, planul rămâne pe perioada greșită.
2. **Ziua salariului e numărată în două cicluri.** `cycleWeeks`/`weeklyTarget` și `calendarBudget` includ ziua următorului venit, care e și prima zi a ciclului următor. Mâncare 600/săpt. pe 25.09–25.10 = 2.657 lei în loc de 2.571, deci aproximativ 12 zile pe an finanțate în plus. BF-04 vine din aceeași suprapunere (`inPlanPeriod`).
3. **Anularea după cheltuieli din plicul creat.** Plicul rămâne cu limita 0 și cu cheltuielile pe el, deci apare imediat „PLIC DEPĂȘIT”. Mesajul de confirmare spune doar că plicul „rămâne”, nu că devine depășit.
4. **„4,700” este citit ca 4,70 lei**, iar „3,000” ca 3 lei. Formatul românesc e corect, dar în NeedsQuickStart un salariu de 4,7 lei trece validarea fără avertisment și nu mai e recunoscut la import (`p5.ts`). Merită un avertisment pentru sume sub, de exemplu, 50 lei la venituri.
5. **Salariul partenerului importat de pe cardul meu** primește titlul „Salariul soției”, dar `memberId` rămâne al meu, pentru că sursa are `memberId`. Repartizarea îl tratează apoi ca pe salariul meu: plătitorii (`payerId`) sunt greșiți și propunerea încă așteaptă salariul ei (`p3.ts`).
6. **Banda „PLIC DEPĂȘIT … peste limita alocată”** apare și când doar tranșa săptămânii e depășită, deși plicul întreg mai are bani. Formularea poate speria (captura `today-360-dark.png`).
7. **Plățile manuale la un eveniment rar** (RCA), făcute în ciclul curent din ecranul Evenimente, nu scad ținta „Plăți rare” a salariului următor din același ciclu. `rarePlan` numără doar contribuțiile de dinainte de începutul ciclului și aplicările din repartizări. Am dedus asta din cod, nu am testat-o.
8. **`fundedInCycle` ignoră un venit repartizat cu dată ulterioară** celui propus (`other.date > income.date`). Dacă salariile sunt notate în altă ordine decât au intrat (întâi al soției, apoi al meu, datat mai devreme), ciclul se socotește greșit. Nu am testat.

## Zone netestate / acoperire parțială

- Sincronizarea Firebase și conflictele între telefoane (offline, conform instrucțiunilor) și comportamentul Capacitor/Android real: copia în Descărcări, notificările locale.
- Cititor de ecran real (NVDA/TalkBack). Am rulat doar axe-core și un test de tab/focus.
- NeedsQuickStart de la capăt la capăt în UI. Am citit doar codul; nu am găsit defecte clare în afara riscului 4.
- `cycleEndReport` și `familyWeekExtras`: verificate pe bibliotecă (`p2.ts`, cazul L), fără anomalii. Raportul dispare după data salariului dacă ciclul n-a fost reînnoit, ceea ce pare intenționat.
- `envelopeMonthlyHistory` (an bisect, trecerea peste an): corect în probe (`p2.ts`, cazul M).
- `weekCarryOver`: reportarea pozitivă și negativă e corectă (`p2.ts`, cazul K).
- `e2e/layout.e2e.mjs` nu a dat un rezultat: l-am rulat cu `timeout 400` și a fost oprit după 400 de secunde (exit 124), deci eroarea „Target page … has been closed” vine de la oprirea mea. Nu e un rezultat de test (log: `agents/qa/e2e-layout.log`). Verificarea de layout proprie (`ui-layout.mjs`) nu a găsit overflow.
