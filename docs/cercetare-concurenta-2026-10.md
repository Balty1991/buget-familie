# Cercetare de concurență și drumul spre topul Play — octombrie 2026

**Data:** 1–2 octombrie 2026 · **Continuă:** [`archive/analiza-play-store-2026-09-10.md`](archive/analiza-play-store-2026-09-10.md) și [`archive/analiza-concurenta-roadmap-2026-09.md`](archive/analiza-concurenta-roadmap-2026-09.md).

## Metodă și limite

`play.google.com` e blocat din mediul în care s-a făcut analiza (ca și în septembrie). Notele, descărcările și funcțiile vin din paginile producătorilor, din comparative publicate în 2026 și din agregatoare (AppBrain, apppricinglab, CNBC, Guiding Tech). **Cifrele trebuie reverificate în magazin înainte de decizii de preț.** Ce scrie despre Buget Familie vine din codul acestui depozit.

## Concurența, pe scurt

| Aplicație | Descărcări / notă (aprox.) | Ce o duce sus | Unde scârțâie (recenzii) | Ce luăm |
|---|---|---|---|---|
| **Money Manager** (Realbyte) | 20 mil.+ · 4,7 | Aproape tot gratuit, calendar, notare rapidă, partidă dublă | Reclame, sync doar contra plată, filtre rigide | Notare rapidă, calendar (avem) |
| **Wallet** (BudgetBakers) | 10–14 mil. · 4,7 · Editor's Choice | Bănci conectate, widgeturi, categorisire care învață | Interfață „greoaie, ilogică”, sync cu dubluri, multe setări | Widget (avem), învățarea categoriei (avem) |
| **Monefy** | ~190 mii recenzii · 4,0 | Diagramă-roată, notare în 2 atingeri, offline, plată unică | Buget superficial, fără familie | Viteza la notare (avem „Notează” în 3 s) |
| **Spendee** | milioane · ~4 | Totul în imagini colorate, portofele comune | Lag, tastatură lentă, salvare instabilă | **Culori pe categorii** (făcut acum) |
| **1Money** | — | Fără reclame, curat, gratuit | Sync contra plată | Fără reclame (avem) |
| **Goodbudget** | 1 mil.+ · 3,3–4,4 | Metoda plicurilor, gospodărie comună | „Greoi”, solduri greșite, doar manual | Plicurile (avem, pe ciclul de salariu) |
| **Money in Motion (RO)** | nou, susținut de Iancu Guda + Penny | Open Banking cu toate băncile din RO, educație financiară | Cere acces la bănci; nu are plicuri | Educația: ghidul local (avem) |
| **Bugetul familiei** (FinancePM) | mic | Nume cu „familie” în RO | Interfață veche | — |

**Ce cer oamenii în 2026** (Guiding Tech, CNBC, getfinny): concluzii în cuvinte, nu doar grafice (abonamente care cresc, cheltuieli neobișnuite); widgeturi; partajare în cuplu; bonuri citite din poză; fără reclame și fără parola băncii.

## Cum se urcă în Play în 2026

Între 2024 și 2026, Google a mutat greutatea **de la semnalele dinainte de instalare** (cuvinte cheie, descărcări brute) **spre cele de după**: retenție, rata de conversie a fișei, relevanța semantică ([AppRadar](https://appradar.com/academy/aso-basics/app-store-ranking-factors), [Moburst](https://www.moburst.com/blog/google-play-store-ranking-factors-explained-how-to-boost-your-apps-visibility/)).

| Factor | Greutate | Unde suntem |
|---|---|---|
| **Titlul** (30 car., indexat) | cea mai mare | „Buget Familie – cheltuieli” ✓ |
| **Descrierea scurtă** (80 car.) | mare | bună; A/B pregătit |
| **Descrierea lungă** (4.000 car., toată indexată) | medie | completă; adăugat „buget personal”, „evidența cheltuielilor”, „imaginea lunii” |
| **Android vitals** (crash, ANR, baterie) | afectează vizibilitatea | de urmărit în Console după closed testing |
| **Retenția** (ziua 1, 7, 30) | mare | „Cifra zilei”, widget, mementouri — bine; imaginea lunii aduce oamenii înapoi la început de lună |
| **Număr de note + nota** | mare (volumul contează, nu doar media) | **cererea de recenzie venea prea târziu** — reparat acum |
| **Conversia fișei** (icon, capturi, feature graphic) | mare | capturi bune; recomandări mai jos |
| **Localizare** | multiplică reach-ul | RO + EN ✓ |

## Unde câștigăm deja

1. **Singurii pe ciclul de salariu**, nu pe luna calendaristică, cu două salarii în zile diferite. Niciun concurent din tabel nu are asta.
2. **Familie fără conturi**: două telefoane, sync criptat, serverul nu vede sumele. Wallet și Spendee cer cont și abonament.
3. **Românește, făcut pentru România**: bonuri românești, extrase BT/ING/Raiffeisen, tichete de masă, Enel/Apa Nova/Bolt recunoscute.
4. **Fără reclame, fără parola băncii, datele pe telefon** — exact ce reproșează recenziile celorlalți.

## Unde pierdeam și ce am făcut în noaptea asta

| Problemă | De ce contează | Ce s-a schimbat |
|---|---|---|
| Interfață aproape monocromă; Spendee/Monefy câștigă prin culoare | Conversia capturilor și „wow”-ul primei zile | Fiecare categorie are culoarea ei (aceeași ca în diagrama din Analiză) în Mișcări, Astăzi, căutare și pe plicuri; tema Alb e mai luminoasă (carduri albe); cardul „Poți folosi azi” are o lumină verde discretă |
| Nicio buclă de creștere organică | O aplicație de familie crește din gură în gură | **Imaginea lunii**: un card 4:5 de trimis pe WhatsApp/Instagram cu „Ne facem bugetul cu Buget Familie · Gratuit pe Google Play”. Implicit **doar procente**, ca nimeni să nu-și arate salariul; sumele doar la cerere. Apare pe Astăzi în primele 7 zile ale lunii și în Analiză → Gospodărie |
| Recenzia se cerea doar după a doua repartizare de salariu (1–2 luni) | Volumul de note e factor de clasament | Se cere și după **a 10-a zi cu cheltuieli notate** sau după ce trimiți imaginea lunii (tot o singură dată, după o săptămână de folosire, fără întrebare de filtrare) |
| Primul ecran începea cu jargon („Plicuri pe ciclul de salariu, fără bancă…”) | Retenția din ziua 1 | O frază clară + trei etichete: **Fără parola băncii · Fără reclame · Datele stau pe telefon** |
| Linia dintre mișcări pica verificarea de contrast pe Navy | Calitate | Desenată altfel; testul de interfață trece pe 13 ecrane × 3 teme × 2 lățimi |

## Fișa din magazin (ASO)

**Titlu:** păstrăm „Buget Familie – cheltuieli” (26 car.). Variantă de testat: „Buget Familie: cheltuieli, bani” (30).

**Descriere scurtă** — test A/B în Console (Store listing experiments), 50/50, minim 7 zile:
- A (actuală): „Buget de familie pe plicuri: cheltuieli, economii, facturi. Fără parola băncii.”
- B: „Cât poți cheltui azi, până la salariu. Buget de familie fără parola băncii.” (76)

**Capturi**, în ordinea care convertește (primele 3 se văd fără derulare):
1. „Cât poți cheltui azi” — cifra zilei (păstrăm)
2. „A intrat salariul? Se împarte singur.” (păstrăm)
3. **Nouă: „Toată luna, într-o imagine.”** — imaginea lunii, partea care se distribuie
4. „Fiecare leu are un loc.” — plicurile, acum colorate
5. „Notezi în 3 secunde.”
6. „Toate mișcările familiei.” — cu iconițele colorate
7. „Rate și facturi la timp.”
8. „Vezi unde se duc banii.”

**Descrierea lungă**: actualizată în [`play-store-listing-ro.md`](play-store-listing-ro.md) cu „Imaginea lunii” și expresiile căutate „buget personal”, „evidența cheltuielilor”, „economii”.

## După closed testing: planul de lansare

Conturile personale de dezvoltator create după 13.11.2023 au nevoie de **12 testeri înscriși, 14 zile la rând** în closed testing înainte de cererea de acces la producție. **Dacă numărul scade sub 12 în fereastra de 14 zile, ceasul o ia de la zero**, iar din 2026 Google verifică și că testerii chiar folosesc aplicația ([extendsclass](https://extendsclass.com/blog/google-plays-closed-testing-requirement-what-developers-need-to-know-in-2026), [testerscommunity](https://www.testerscommunity.com/blog/google-play-closed-testing-requirements-2026)). Ține 14–15 testeri, ca să ai rezervă. Ce urmează, în ordine:

1. **Ziua 0–14 (closed testing):** cere fiecărui tester să noteze 5 zile din 14 (crește retenția raportată în Console) și să lase feedback din aplicație („Spune-ne ce nu merge”).
2. **Cererea de producție:** răspunsurile despre testare cer exemple concrete de feedback și ce s-a schimbat — changelog-ul din `docs/CHANGELOG.md` e dovada.
3. **Lansarea:** întâi 20% din utilizatori (staged rollout), urmărește crash-urile și ANR-urile 3 zile, apoi 100%.
4. **Primele 30 de zile:** răspunde la fiecare recenzie în 24 h (Google urmărește asta); pornește experimentul A/B pentru descrierea scurtă; pune link-ul de Play în imaginea lunii (făcut).
5. **Creștere organică:** invitația partenerului (există) + imaginea lunii (nouă) = două bucle virale. Grupuri de Facebook de mame/părinți și r/Romania_Finance — imaginea lunii e postarea gata făcută.
6. **De urmărit lunar în Console:** conversia fișei (țintă > 30%), retenția în ziua 30, nota și numărul de note, crash-uri < 1,09% și ANR < 0,47% (pragurile „bad behavior” Play, [Android vitals](https://developer.android.com/topic/performance/vitals)).

## Ce n-am făcut (și de ce)

- **Conectarea la bancă:** exclusă la cererea ta.
- **Paleta schimbată radical / alt font pentru sume:** direcția din 1.1.119–1.1.123 (Fraunces, pete discrete) e recentă și deliberată; am adăugat culoare peste ea, nu am înlocuit-o.
- **Capturile noi din magazin:** scriptul are nevoie de `scripts/store-screenshots/seed.mjs`, care nu a fost niciodată pus în repo. Vezi raportul de dimineață.

## Surse

- [Guiding Tech — Best Android Apps for Budgeting in 2026](https://www.guidingtech.com/best-android-apps-for-budgeting-in-2026/)
- [CNBC Select — Best budgeting apps of 2026](https://www.cnbc.com/select/best-budgeting-apps/)
- [getfinny — Best Simple Budget Apps in 2026](https://getfinny.app/blog/best-simple-budget-apps-2026)
- [BudgetBakers](https://budgetbakers.com) · [42matters — Top budgeting apps on Google Play](https://42matters.com/top-10-budgeting-and-financial-planning-apps-on-google-play)
- [apppricinglab — Goodbudget](https://www.apppricinglab.com/app/google_play/com.dayspringtech.envelopes) · [Gerald — Monefy review](https://joingerald.com/learn/financial-wellness/monefy-expense-tracker-review)
- [Iancu Guda — Money in Motion](https://iancuguda.ro/mim/) · [facetotibanii.ro — aplicații buget personal](https://facetotibanii.ro/aplicatii-buget-personal-romania/)
- [AppRadar — ASO ranking factors in 2026](https://appradar.com/academy/aso-basics/app-store-ranking-factors) · [Moburst — Google Play ranking factors](https://www.moburst.com/blog/google-play-store-ranking-factors-explained-how-to-boost-your-apps-visibility/) · [AppTweak — ASO best practices](https://www.apptweak.com/aso-blog/app-store-optimization-aso-best-practices)
