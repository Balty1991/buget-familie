# Buget Familie: audit de produs, runda a treia (27.09.2026)

**Versiune:** 1.1.96, commit `5b63e2a` · `BILLING_LIVE = false` · `TRIAL_DAYS = 14`
**Ținta:** lansare întâi doar în Google Play România, apoi diaspora (EUR/GBP), abia apoi alte țări.

**Cum am lucrat:**
- Am trecut cu Playwright prin aplicație (`127.0.0.1:5174`, 390 px, `ro-RO`, Europe/Bucharest), pornind de la zero pe drumul „Vreau ca aplicația să-mi împartă salariul”. Datele: 5.200 lei pe 10, partenerul 4.300 lei pe 25, șablonul „Familie cu copii”, 1.800 lei acum. Apoi am notat o cheltuială și am trecut prin Plicuri și Mai mult.
- Am citit codul schimbat de la runda trecută (73 de commituri, `1935b14..5b63e2a`): `NeedsQuickStart`, `FirstRunSetup`, `entitlements`, `review-prompt`, `money-format`, `i18n`, `family-invite`, `settle-up`, `SettingsPanel`, `PlanStudio`, `AICompanion`.
- Am citit materialele Play: `play-store-listing-ro.md`, `PLAY_LISTING.md`, `PLAY_STATUS.md`, `BILLING_PLAY_PREP.md`, `SCREENSHOTS.md`. Am văzut cele 8 capturi de telefon RO, capturile de tabletă RO, `feature-graphic-ro.png` și `icon-512.png`.
- Am făcut trei căutări web (Wallet, YNAB, MiM). Ce e verificat și ce e estimare e spus la fiecare cifră.

---

## 1. Pe scurt

Runda aceasta a reparat aproape tot ce ținea de cod din raportul meu trecut. Cel mai important, **pornirea dă acum cifra zilei din prima zi**. Am verificat: 12 acțiuni, iar pe Astăzi apare „Poți folosi azi 163,64 RON · Mai sunt 1.800 lei liberi pentru 11 zile”. Tot de atunci:
- transferurile și banii scoși cash nu mai sunt cheltuieli;
- primul ecran are 3 intenții, printre ele „Mă alătur familiei”;
- pasul 2 arată „Venituri 9.500 · cheltuieli ~7.720 · rămân ~1.780”;
- cererea de recenzie apare în aplicație, după un moment reușit;
- materialele de magazin au fost refăcute.

**Ce a rămas neschimbat și contează pentru lansare:**
1. **Măsurarea e tot zero.** Nu există niciun eveniment de activare, retenție sau conversie. Decizia e la tine (👤).
2. **Monetizarea nu e gata ca produs.** Proba e tot de 14 zile. Mai grav, limitele planului gratuit **nu se aplică acolo unde se câștigă valoarea**: pornirea adaugă partenerul, iar repartizarea automată creează plicuri peste limita de 10. Limitele se aplică doar la „+ Plic” și la „Adaugă membru” din Setări. Cu Billing pornit, asta dă un paywall incoerent.
3. **Fișa Play e frumoasă, dar se contrazice** în trei capturi. Descrierea lungă e aproape goală de cuvinte-cheie: „buget” apare o dată, „cheltuieli” o dată, „economii” și „bani” niciodată.
4. **Captura rămâne manuală.** MiM e gratuit și aduce automat tranzacțiile din toate băncile românești.
5. **Cifra zilei din prima zi nu scade obligațiile care vin înainte de salariu.** 1.800 lei împărțiți la 11 zile, chiar dacă rata de 1.400 lei cade pe 5.

**Notă globală pentru produs: 8/10** (față de 7,5/10 pe 26.09).

| Sub-notă | 26.09 | 27.09 | De ce |
|---|---|---|---|
| Nucleu (plicuri pe salariu, repartizare, cuplu) | 9 | **9** | Transferurile corecte și „Închide anul” au întărit nucleul. Lipsește încă împărțirea proporțională între parteneri. |
| Activare (primele 5 minute) | 5 | **7,5** | Cifra zilei din prima zi, 3 intenții, bilanțul venituri–cheltuieli. Minus: nu rezervă scadențele de dinainte de salariu, Plicuri rămâne gol, tutorialul și „bilanțul săptămânii” apar prea devreme. |
| Captură | 5 | **6** | Butonul „Am scos cash sau am mutat bani”, sumele recente, importul fără dubluri de transfer. Tot manual: nu citește notificările băncii și nu are notare vocală. |
| Retenție | – | **6** | Există notificări de ritm și de salariu, widgetul și recenzia la succes. Nu există istoric sau serie a ciclurilor, nici o recompensă la final de ciclu. |
| Monetizare | – | **5** | Billing e scris și testat, dar oprit. Proba e de 14 zile, iar limitele sunt incoerente (secțiunea 5). Prețul e rezonabil. |
| Fișa Play / ASO | – | **6** | Capturi și feature graphic de calitate. Minus: contradicții în capturi, text slab în cuvinte-cheie, contact pe Gmail și politică pe `github.io`. |
| Măsurare | 2 | **2** | Nicio schimbare. |

---

## 2. Ce s-a făcut din raportul de pe 26.09 (verificat)

| Propunere | Stare | Cum am verificat |
|---|---|---|
| 1. Cifra zilei înainte de primul salariu | **Făcut parțial.** Întrebarea „Cât aveți acum, pe card și cash?” din pasul 3 devine soldul cardului. **Nu** se face repartizare de legătură și nu se scad scadențele de dinainte de salariu (constatarea A). | Playwright: 163,64 RON pe zi = 1.800 / 11. Commitul `85eff2b` are doar 9 rânduri în `NeedsQuickStart.tsx`. |
| 2. Transferuri și bancomat | **Făcut.** „Am scos cash sau am mutat bani între carduri” apare în Notează. | Ecranul Notează; `source-transfer.test.ts` |
| 3. Telemetrie opt-in | **Nefăcut** (👤) | Nu există `analytics`, `telemetry` sau `metric` în `client/src` și `functions/src`. |
| 4. Banda venituri–cheltuieli la pasul 2 | **Făcut** | „Venituri 9.500 RON · cheltuieli ~7.720 RON · rămân ~1.780 RON” |
| 5. Recenzia în aplicație, la momentul bun | **Făcut** (`ReviewManager` în `BugetFamilieNativePlugin.java`, după a doua repartizare). Intră abia cu un AAB nou. | cod |
| 6. Trei intenții, cu „Mă alătur familiei” | **Făcut** | primul ecran |
| 7. Materiale de lansare | **Făcut în mare parte.** Capturile și feature graphicul sunt noi. **Nu** s-au actualizat `PLAY_LISTING.md` (tot 1.1.69, descrierea scurtă veche cu „sync familie criptat”, temele „Aurora, Cyber”), `README.md` (navigația veche cu Plan, Obligații, Analiză) și `PLAY_STATUS.md` (trimite la `AUDIT_AND_UPGRADE.md` și `MARKET_RESEARCH.md`, care nu există). | fișierele |
| 8. „Închide anul” | **Făcut** (`year-close.ts`) | cod |
| Istoric și serie de cicluri | Nefăcut | nu există `cycleOutcomes` |
| Împărțire între parteneri după o regulă | Nefăcut. `settle-up.ts:10` împarte tot în părți egale. | cod |
| Partener pe iPhone, ghidat | Nefăcut. `inviteMessage` (`family-invite.ts:44`) nu spune nimic despre iPhone. | cod |
| Venituri tipice RO (alocație, al 13-lea) | Nefăcut | cod |
| Captură din notificările băncii | Nefăcut | nu există `NotificationListenerService` |
| Probă de 30 de zile | Nefăcut: `TRIAL_DAYS = 14`, iar `BILLING_PLAY_PREP.md` spune tot 14. | cod |

---

## 3. Constatări noi

### A. P1: cifra din prima zi poate promite bani care sunt deja ai ratei
- **Ce am văzut:** după pornire, Astăzi arată 163,64 lei pe zi (1.800 / 11 zile). Șablonul „Familie cu copii” a pus însă „Rate bancă 1.400 / lună”, lumină, gaz, apă și grădiniță, **fără zi de plată**. Aplicația nu știe dacă rata cade pe 5 octombrie și nici nu întreabă.
- **De ce contează:** e prima cifră pe care o vede omul, iar produsul se vinde pe „nu promite niciodată mai mult decât există” (`money-format.ts:25`). Dacă rata pleacă pe 5, după o săptămână cifra se prăbușește și încrederea se pierde exact în perioada în care se decide D7.
- **Propunere:** o singură întrebare în pasul 3, sub „Cât aveți acum”: „Ce mai aveți de plătit până pe 10 octombrie?”, cu bife pe cheltuielile din pasul 2 (sumele sunt deja completate). Ce e bifat se scade din banii de acum, printr-un plic „De plătit până la salariu”. Textul de pe Astăzi devine: „1.800 acum − 1.400 rată = 400 liberi pentru 11 zile”.
- **Unde:** `NeedsQuickStart.tsx` (pasul 3), plus un plic creat prin `applyIncomeSplit` cu un venit virtual „Bani de acum”.
- **Efort:** S.

### B. P1: limitele planului gratuit nu se aplică acolo unde contează
- **Ce am văzut:**
  - `PLANS.casa` are `members: 1` și `envelopes: 10`.
  - Pornirea adaugă totuși partenerul (`NeedsQuickStart.tsx:88-90`), fără `canAddMember`.
  - `canAddEnvelope` e verificat doar în `PlanStudio.tsx:351`, la „+ Plic” de mână. Repartizarea automată a șablonului „Familie cu copii” duce la 10–12 plicuri (9 cheltuieli, plăți rare, eventual chirie).
  - `canUseSettleUp` nu e folosit nicăieri.
- **De ce contează:** cu Billing pornit, un om pe planul gratuit are 12 plicuri și pe „Maria”, dar la al 13-lea plic sau la al treilea membru primește paywall. Pare o capcană, nu o valoare. Nu blochează testarea închisă, pentru că Billing e oprit, dar trebuie hotărât înainte de producție.
- **Propunere:** limitele să urmeze promisiunea „eu gratuit, noi plătit”, ajustată la un MiM gratuit:
  - **Casa (gratuit):** plicuri nelimitate, două nume pe un singur telefon, repartizarea ambelor salarii, import, widget, notificări.
  - **Familia:** al doilea telefon și sync, „cine cui dă”, un ghid online mai generos, rapoarte complete și istoricul ciclurilor.
  - Concret: se scoate `envelopes: 10`, `members` devine 2 pe Casa, iar `canUseSettleUp` se leagă în `SettleUpCard`. Paywallul apare doar la „Conectează al doilea telefon”, adică exact momentul în care cuplul a primit deja valoare.
- **Efort:** S (cod), plus decizia ta (👤).

### C. P1 pentru fișă: trei capturi se contrazic singure
| Captură | Problema | Reparația |
|---|---|---|
| `04-needs` „Două salarii, zile diferite.” | Ambele salarii au **ziua 18**. | În datele de test, Maria pe 25, cum spune chiar `SCREENSHOTS.md`. |
| `03-plan` „Fiecare leu are un loc.” | „Nerepartizați 3.960,50 RON · 53% așezat”. Jumătate din bani nu au loc, sub titlul care spune că fiecare leu are un loc. „8 plicuri · 7.850 RON” lângă „4.480,60 în plicuri” derutează. | Captura se face după ambele repartizări (≥ 95% așezat), sau cu un alt titlu. |
| `02-split` „Se împarte singur.” | „Salariul Mariei (Maria)” repetă numele. Rândul de mâncare spune „560 RON × 3 săpt. + 1 zile = 1.760 RON · rămân 1.540 RON” și propune 220 RON, deci e greu de citit și are o greșeală de acord („1 zile”). | Eticheta fără paranteză când numele e deja în titlu, „1 zi”, rândul de mâncare mai scurt. Cele două corecturi de text țin de aplicație, nu doar de captură. |
| `01-today` (și tableta) | Data e ruptă pe 3 rânduri („27 / SEPTEMBRIE / 2026”). Banda „A început săptămâna 2” ocupă o treime din ecran. Duminică cifra e 216,60 (ultima zi din săptămână), nu cifra obișnuită de ~80, iar textul o repetă („Azi poți 216,60… mai sunt 216,60 pentru 1 zi”). | Captura se face într-o zi de marți sau miercuri, fără bandă, cu data pe un rând. |

**Lipsesc din capturi exact cele două lucruri care deosebesc produsul de MiM și de aplicațiile băncilor:** „fără parola băncii” și „două telefoane, un buget”. Propun ca `06-journal` să fie înlocuită cu Sync sau „cine cui dă” („Amândoi, pe telefoanele voastre”), iar pe `08-insights` să apară subtitlul „Fără parola băncii. Datele stau pe telefon.”.

**Feature graphic și icon:** sunt curate și lizibile la dimensiunea mică. „Fiecare leu are un loc.” se citește bine. Nu am observații.

### D. P1: descrierea lungă nu conține cuvintele după care caută românii
Numărul de apariții în descrierea completă (2.099 din 4.000 de caractere):

| Cuvânt | Apariții |
|---|---|
| buget | 1 |
| cheltuieli | 1 |
| familie | 1 |
| economii | 0 |
| bani | 0 |
| cuplu | 0 |
| gratuit | 0 |
| salariu | 8 |
| plic | 10 |

Titlul folosește doar 13 din cele 30 de caractere. Cum se face ASO-ul e în secțiunea 6.

### E. P1 pentru Play: ghidul AI nu are buton de semnalare a răspunsului
Politica Google Play pentru conținut generat de AI cere ca utilizatorul să poată raporta din aplicație un răspuns nepotrivit. În `AICompanion.tsx` nu există așa ceva. Există doar formularul general „Spune-ne ce nu merge”.
- **Propunere:** sub fiecare răspuns online, „Semnalează răspunsul”, care deschide formularul de feedback cu textul răspunsului precompletat (întrebarea utilizatorului nu se trimite fără acordul lui).
- **Efort:** S.

### F. P2: primele minute după pornire au zgomot
- Tutorialul „1 · CAPTURĂ: Notează o mișcare când se întâmplă” apare **după** ce omul a notat deja prima cheltuială.
- „Bilanțul săptămânii: Săptămâna merge bine. Poți trimite bilanțul familiei.” apare după o singură cheltuială, în ziua 1.
- Pe Plicuri, după pornirea cu banii de acum: „Fiecare leu are un loc” lângă „0 plicuri · Nerepartizați 1.800 · 0% așezat”. Blocul „Următorul salariu” apare de două ori pe aceeași pagină (în „Salariul” și în „Ce plătim lunar”).
- **Propunere:** tutorialul de captură să nu mai apară dacă există deja o mișcare. Bilanțul săptămânii să apară abia după ≥ 3 zile cu date. Pe Plicuri, în perioada de legătură, un singur card: „Până la salariu: 1.800 lei, 163 pe zi. Plicurile se fac singure pe 10 octombrie.”
- **Efort:** S.

### G. P2: încrederea pe fișă e tot cea de dinainte
Contactul e un Gmail, politica stă pe `balty1991.github.io`, iar dezvoltatorul apare ca „Balty1991”. Pentru o aplicație de bani, fișa e primul loc unde omul decide dacă are încredere. E nevoie de domeniu propriu, email pe domeniu și nume de PFA/SRL la dezvoltator (👤). Pentru testarea închisă nu e blocant. Pentru producție, da.

---

## 4. Concurența în România: ce s-a schimbat de ieri

| Concurent | Preț (verificat sau estimat) | Unde câștigă BF |
|---|---|---|
| **MiM (Money in Motion)** | **Gratuit** (ONG). Open banking pentru toate băncile RO și Revolut, sync de familie, peste 120.000 de utilizatori. *Verificat.* | Planul **înainte** de cheltuială (repartizarea salariului, săptămâna de mâncare, plăți rare), cash și tichete, fără acces la bancă. MiM arată trecutul, BF spune cât mai poți. |
| **YNAB** | 14,99 USD pe lună sau 109 USD pe an, probă de 34 de zile, până la 6 persoane. *Verificat.* | Româna, ciclul de salariu, un preț de aproximativ 4 ori mai mic (149 lei față de ~500 lei pe an), specificul RO. |
| **Wallet (BudgetBakers)** | ~4,49 EUR pe lună, cu variantă anuală și uneori „pe viață”. *Verificat parțial* (prețul exact în lei nu l-am văzut). | Ciclul de salariu, plicurile pe săptămână, confidențialitatea, cuplul. |
| **Spendee, Monefy** | Prețuri preluate din rapoartele trecute, *nereverificate azi*. | Planul și familia. Monefy notează mai repede. |
| **George, BT Pay, ING, Revolut** | Gratuite | Văd o singură bancă și trecutul. Nu văd cash, tichete, partenerul sau planul. Revolut are limită pe zi, dar pe luna calendaristică și doar pentru banii din Revolut. |
| **Excel sau Google Sheets** | Gratuit | Principalul „concurent” al celor care fac deja buget pe plicuri. BF trebuie să ofere o migrare: import dintr-un tabel simplu de categorii și sume (există deja import CSV de mișcări, dar nu de plan). |

**Concluzie:** poziționarea „planul înainte, pe salariu, pentru cuplu, fără bancă” rămâne corectă și neocupată. Primele 48 de ore au devenit bune. Lipsesc bucla de retenție (captura aproape automată și recompensa de ciclu) și măsurarea.

---

## 5. Monetizare

**Recomandarea mea (👤 decizie):**

| | Casa (gratuit) | Familia |
|---|---|---|
| Plicuri, ciclu, repartizarea ambelor salarii, două nume pe un telefon, import, widget, notificări | Da, **fără limită de plicuri** | Da |
| Al doilea telefon, sync criptat, până la 6 persoane | – | Da |
| „Cine cui dă”, împărțire proporțională (când va exista) | – | Da |
| Ghid online | 5 pe zi (azi 20) | 100 pe zi |
| Istoric de cicluri, PDF, coșul etalon complet | Rezumat | Complet |

**Prețuri în lei** (prețuri de listă, cu TVA inclus, cum le afișează Play):
- **19,99 lei pe lună / 149 lei pe an** rămân corecte. 149 lei pe an e aproximativ 12,4 lei pe lună. *Estimare:* după TVA (21%) și comisionul Play (15%) îți rămân în jur de 105 lei pe an de abonat.
- **Preț de fondator 99 lei pe an** pentru primul an, ca ofertă introductivă în Play, doar pe anual.
- **Proba: 30 de zile** (YNAB dă 34). Configurată în Play pe planul anual și cerută la „Conectează al doilea telefon”. `TRIAL_DAYS` trebuie trecut la 30, iar textele din `BILLING_PLAY_PREP.md` și din politică trebuie aliniate.
- Nu recomand „pe viață” la lansare. Decizia se ia după 3–4 luni de date de churn, care azi nu pot fi măsurate (constatarea H).

**Ordinea:** testarea închisă merge cu Billing oprit, așa cum e acum. Billing se pornește la producție doar după ce limitele sunt coerente (B) și există măsurare (H).

---

## 6. Fișa Play și ASO (în română)

**Titlu (30):** `Buget Familie: plicuri salariu` (30 de caractere). Alternativa de testat: `Buget Familie – cheltuieli` (26). *Estimare:* „buget” și „cheltuieli” au cel mai mare volum de căutare în RO, iar „plicuri” e un termen de nișă. Nu am acces la date de volum, așa că Play Console → Statistici → „Termeni de căutare” trebuie urmărit după primele 4 săptămâni.

**Descrierea scurtă:** varianta A actuală e bună (`Buget pe salariu, pe plicuri. Cheltuieli, facturi, rate. Fără parola băncii.`). Pentru experimentul de fișă din Play Console propun ca variantă B ceva mai orientat pe familie: `Bugetul familiei pe salariu: cât poți cheltui azi. Fără parola băncii.` (70).

**Descrierea lungă:** ce propun să se adauge, cu termenii care lipsesc acum:
- **primul paragraf:** „Aplicație de **buget** pentru **familie** și **cuplu**: vezi cât poți cheltui azi până la salariu, ține evidența **cheltuielilor** și pune deoparte **economii**. **Gratuit**, fără reclame, fără parola băncii.”;
- **o secțiune „Pentru cupluri”:** două salarii în zile diferite, două telefoane, cine cui dă;
- **o secțiune „Făcut pentru România”:** tichete de masă, RCA, ITP, rovinietă, impozitul local, Paște ortodox, import de extrase de la BT, BCR, ING, Raiffeisen și Revolut;
- **o secțiune „Merge și pe iPhone, din browser”**, doar după ce există ghidul pentru iPhone;
- **ținta:** „buget” de 4–6 ori, „cheltuieli” de 3–5 ori, „bani” și „economii” de 2–3 ori fiecare, natural, fără liste de cuvinte (Play penalizează umplutura);
- **la producție** se scoate „Fără plată în magazin în versiunea asta”, iar planul Familia și proba se descriu pe scurt.

**Etichete:** Buget, Finanțe personale, Cheltuieli. **Categorie:** Finanțe.

**Capturi:** constatarea C. Ordinea bună ar fi: 1 Astăzi → 2 Se împarte singur → 3 Două salarii (reparat) → 4 Plicuri (reparat) → 5 Notezi în 3 secunde → 6 **Amândoi, pe telefoanele voastre** (nouă) → 7 Rate și facturi → 8 Unde se duc banii, cu „Fără parola băncii”.

**Limbă și țări la lansare:**
- limba implicită a fișei: **ro-RO**;
- disponibilitate: **doar România** în producție;
- fișa în engleză (există capturi EN) poate fi pusă, dar nu adaugă nimic în RO. O las pentru etapa diaspora (secțiunea 9).

---

## 7. Măsurare

### H. P1: fără măsurare nu se poate decide nimic după testarea închisă
Propunerea de ieri rămâne valabilă și e ieftină. O funcție `metric` în `functions/src/index.ts` face `increment` pe `metrics/{zi}.{eveniment}`, fără ID de utilizator, fără sume, cu plafonul zilnic existent, **cu acord explicit** (o bifă la finalul pornirii și în Setări → Confidențialitate).

Cele 10 evenimente minime:
1. `onboard_done:{intent}`;
2. `day1_number_seen`;
3. `first_expense`;
4. `split_applied`;
5. `cycle_closed_in_plan`;
6. `second_device`;
7. `import_done:{bank}`;
8. `paywall_shown:{reason}`;
9. `trial_started`;
10. `review_requested`.

Pentru D1, D7 și D30 se folosesc statisticile din Play Console, fără SDK. Politica și Data safety primesc o frază despre „statistici anonime, opționale”.

**Alternativa fără cod:** dacă nu vrei telemetrie deloc, testarea închisă se face cu un formular scurt la zilele 3 și 14 (5 întrebări) și cu statisticile Play. E mai slabă, dar e onestă.

**Țintele de la 90 de zile** rămân cele din raportul de ieri: pornire terminată ≥ 70%, cifra zilei văzută în ziua 1 ≥ 60%, ciclu încheiat în plan ≥ 20%, al doilea telefon ≥ 15% din gospodăriile active, probă → plată 25–35%, rating ≥ 4,5.

---

## 8. Recomandări prioritizate

Efort: **S** ≤ 1 săptămână · **M** 2–4 săptămâni · **L** peste o lună.

| Prio | Recomandare | Efort | Când |
|---|---|---|---|
| **P0** | Capturile reparate: `04` cu zile diferite, `03` fără 53% nerepartizați, `01` într-o zi obișnuită; „1 zi” și „Salariul Mariei (Maria)” corectate în aplicație (C) | S | înainte de testarea închisă |
| **P0** | Butonul „Semnalează răspunsul” la ghidul AI (E) | S | înainte de testarea închisă |
| **P0** | Un AAB nou cu pluginul de recenzie, pentru testarea închisă (👤 build) | S | înainte de testarea închisă |
| **P1** | Scadențele de dinainte de salariu scăzute din cifra zilei 1 (A) | S | înainte de testarea închisă (ideal) |
| **P1** | Telemetria opt-in, cele 10 evenimente (H) (👤 decizie) | S–M | înainte de testarea închisă (ideal), obligatoriu înainte de Billing |
| **P1** | Descrierea lungă rescrisă pentru ASO, titlul pe 30 de caractere (D, secțiunea 6) | S | înainte de producție |
| **P1** | Limitele Casa/Familia coerente, paywall doar la al doilea telefon (B) (👤) | S | înainte de Billing |
| **P1** | `TRIAL_DAYS = 30`, prețul de fondator, textele de politică (👤) | S | înainte de Billing |
| **P1** | Domeniu propriu, email pe domeniu, entitate la dezvoltator (G) (👤) | S | înainte de producție |
| **P2** | Zgomotul din primele minute: tutorial, bilanț, Plicuri în perioada de legătură (F) | S | în timpul testării închise |
| **P2** | Captură din notificările băncii | M | după producție, prima funcție mare |
| **P2** | Istoricul ciclurilor și seria sănătoasă (bucla lunară) | S | în timpul testării închise |
| **P2** | Ghid pentru iPhone în mesajul de invitație și banda din Safari | S | înainte de producție |
| **P2** | Împărțire proporțională între parteneri (motiv de plată pentru Familia) | S–M | după producție |
| **P2** | `PLAY_LISTING.md`, `README.md` și `PLAY_STATUS.md` la zi (linkuri moarte, 1.1.69, teme vechi) | S | oricând |
| **P3** | Venituri tipice RO (alocație, al 13-lea), fond de siguranță calculat, notare vocală, card „Ciclul nostru” | S–M fiecare | după producție |

---

## 9. Gata de testare închisă vs. după

**Trebuie gata ÎNAINTE de testarea închisă (12 testeri, 14 zile):**
- [ ] capturile reparate (C) și cele două corecturi de text;
- [ ] „Semnalează răspunsul” la ghidul AI (E);
- [ ] AAB nou (versionCode > 98) cu pluginul de recenzie;
- [ ] scadențele de dinainte de salariu la pornire (A). Testerii sunt primii care vor vedea cifra zilei, iar o cifră greșită în săptămâna 1 strică feedbackul;
- [ ] decizia despre măsurare: telemetria opt-in **sau** formularul de la zilele 3 și 14. Fără una dintre ele, cele 14 zile nu produc date;
- [ ] Data safety aliniat cu ce se măsoară;
- [ ] recrutarea: cel puțin 6 cupluri (două telefoane) printre cei 12, altfel sync-ul și „Mă alătur familiei” nu sunt testate cu adevărat.

**Poate aștepta până după testarea închisă (înainte de producție):**
- descrierea lungă și titlul optimizate (D), experimentul de fișă A/B;
- domeniul, emailul și entitatea (G);
- ghidul pentru iPhone;
- zgomotul din primele minute (F), istoricul ciclurilor.

**Poate aștepta până după lansarea în producție:**
- Billing (cu limitele coerente, proba de 30 de zile, prețul de fondator);
- captura din notificările băncii;
- împărțirea proporțională, notarea vocală, veniturile tipice, cardul partajabil.

---

## 10. Planul pentru diaspora (EUR/GBP), etapa a doua

**Pe cine țintim:** familii românești din Italia, Spania, Germania, UK, Franța și Irlanda. Au de obicei telefonul setat pe limba țării și plătesc în EUR sau GBP. Au bani „acasă” (rate sau părinți în RON) și trimit bani lunar în România.

**Ce e deja favorabil:**
- Aplicația pornește în română indiferent de limba telefonului (`i18n.ts`, implicit `ro`).
- Sursele pot avea deja altă monedă, cu curs (`currency.ts`, `exchangeRates`).
- Paștele ortodox, evenimentele românești și Revolut în import se potrivesc diasporei.

**Ce trebuie schimbat:**

| # | Schimbare | Unde | Efort |
|---|---|---|---|
| 1 | **Moneda de bază a gospodăriei**, aleasă la pornire (RON, EUR, GBP). Azi `lei()` are `currency: "RON"` fix (`money-format.ts:13`), e folosit în 28 de fișiere, iar în componente sunt ~150 de „lei”/„RON” scrise direct. | `settings.baseCurrency`, `money-format.ts`, textele „lei” → `{moneda}` | M |
| 2 | **Sursele în RON pentru cei din diaspora** (rata sau chiria din România), convertite în moneda de bază. Mecanismul există, trebuie doar inversat. | `currency.ts` | S |
| 3 | **„Bani trimiși acasă”**: o categorie și un obligatoriu lunar, cu suma în EUR și echivalentul în RON. E un diferențiator real pentru diaspora. | `monthly-needs`, șabloane | S |
| 4 | **Module doar pentru RO, ascunse sau înlocuite** când moneda nu e RON: tichete de masă; RCA, ITP, rovinietă și impozitul local (înlocuite cu șabloane pe țară: UK council tax, MOT, TV licence; IT bollo auto, IMU/TARI; ES IBI, ITV; DE Rundfunkbeitrag, TÜV); catalogul de produse și „coșul etalon” cu magazine RO; `merchant-rules` cu comercianți RO. | un flag `region` în setări, `planned-events.ts`, `ProductCatalogPanel`, `PriceWatchPanel` | M |
| 5 | **Importul de extrase:** Revolut merge deja. Trebuie adăugate formatele CSV ale băncilor din diaspora: Monzo, Starling, Barclays, N26, Wise, Sparkasse, Intesa, BBVA, CaixaBank. | `statement-import.ts`, plus fixture-uri | M |
| 6 | **Ciclul de plată:** în UK multe salarii vin săptămânal sau la 4 săptămâni. Modul de venit neregulat există, dar trebuie verificat pentru „la fiecare 4 săptămâni”. | `plan-cycle.ts` | S |
| 7 | **Prețuri pe țară în Play:** 3,99 EUR pe lună / 29,99 EUR pe an și 3,49 GBP pe lună / 24,99 GBP pe an (*estimare*: sub Wallet ~4,49 EUR și mult sub YNAB). | Play Console | S |
| 8 | **Fișa:** limba implicită rămâne ro-RO (un telefon pe italiană vede fișa implicită, adică cea română, dacă nu adaugi traducere în italiană). **Nu** se adaugă it, es sau de. Textul se adaptează cu „în lei, euro sau lire” și „pentru familiile de români de oriunde”. Capturile sunt separate, cu EUR. | Play Console | S |
| 9 | **OCR-ul de bonuri** e antrenat pe bonuri fiscale RO. Pe bonuri UK, IT sau ES trebuie testat. Până atunci nu se promite în fișa pentru diaspora. | `receipt-reading` | M |

**Ordinea:** 1 → 2 → 3 → 4 → 7 → 8. Asta e minimul pentru lansarea în diaspora. Importul (5), ciclul (6) și OCR-ul (9) vin pe urmă. **Condiția de pornire:** în România să existe 90 de zile de date cu ciclu încheiat în plan ≥ 20%. Altfel nu știm ce exportăm.

---

## 11. Top 5

1. **Capturile Play reparate** (zile diferite pe „Două salarii”, fără 53% nerepartizați sub „Fiecare leu are un loc”, Astăzi într-o zi obișnuită), plus o captură cu „două telefoane / fără parola băncii”. P0, S.
2. **Cifra zilei din prima zi să scadă scadențele de dinainte de salariu** („Ce mai aveți de plătit până pe 10?”). P1, S.
3. **Măsurare opt-in cu 10 evenimente**, sau cel puțin formularul de la zilele 3 și 14, pusă înainte de testarea închisă. P1, S–M, 👤.
4. **Monetizare coerentă înainte de Billing:** Casa fără limită de plicuri și cu două nume, paywall doar la al doilea telefon, probă de 30 de zile, preț de fondator 99 lei pe an. P1, S, 👤.
5. **Descrierea lungă rescrisă pentru ASO** (buget, cheltuieli, economii, familie, cuplu, gratuit), plus „Semnalează răspunsul” la ghidul AI pentru politica Play. P0/P1, S.

---

**Surse web (27.09.2026):**
- MiM (gratuit, open banking pentru toate băncile RO și Revolut, familie, peste 120.000 de utilizatori): https://iancuguda.ro/mim/ și https://www.piatafinanciara.ro/money-in-motion-devine-prima-aplicatie-mobila-care-integreaza-open-banking-pentru-toate-bancile-din-romania-si-revolut-in-parteneriat-cu-finqware/
- YNAB (14,99 USD pe lună, 109 USD pe an, probă de 34 de zile): https://www.ynab.com/pricing
- Wallet by BudgetBakers (~4,49 EUR pe lună, planuri lunare, anuale și „pe viață”): https://support.budgetbakers.com/hc/en-us/articles/7151349344018-Everything-about-Premium
- Prețurile pentru Spendee și Monefy, volumele de căutare și calculul net după TVA și comision sunt **estimări** și nu au fost verificate azi.
