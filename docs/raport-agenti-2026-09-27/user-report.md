# Buget Familie: raport de utilizator real, runda a treia (părinte, 2 salarii, tichete, chirie, rată, grădiniță)

Versiune testată: 1.1.96 (commit 5b63e2a), pe web, mobil 390×844, pornire de la zero, fără date. Totul a rulat local. Orice cerere spre internet (Firebase, reCAPTCHA) a fost blocată în browserul de test, deci nu s-a scris nimic pe server.
Capturi și scripturi: `/tmp/claude-0/-home-user-buget-familie/6251941a-2f52-5fdd-bb21-2d9641b66e0b/scratchpad/agenti3/user/`, prescurtat mai jos `U3/`.

**Persona:** eu câștig 5.200 lei, pe 10. Ioana câștigă 4.300 lei, pe 25, și primește și ea tichete. Chirie 2.000, rată BCR 1.100, grădiniță 750, lumină 250, gaz 180, apă 110, abonamente 120, taxi/transport 300, neprevăzute 300, mâncare 600 lei pe săptămână.
**Cum am testat:** am instalat aplicația duminică, 27.09.2026, seara. Salariul Ioanei intrase pe 25, iar pe card aveam 4.100 lei. Am trăit o lună cu ceasul mutat: 27.09, 28.09, 29.09, 01, 03, 05, 07, 10, 11, 12, 14, 16, 18, 20, 22, 23 și 25.10. Am notat ~40 de mișcări: facturi, tichete, benzină, o sumă greșită (1.500 în loc de 150), o mișcare dublă ștearsă și două salarii repartizate. Am închis un ciclu și am trecut prin căutare, Mișcări, Obligații, Calendar, Analiză, Setări și Sincronizare (doar cât se poate fără internet).

---

## 1. Pe scurt

Aproape tot ce am cerut data trecută s-a reparat, și se vede:
- Închiderea ciclului nu mai propune „Lumină 2.830”.
- Benzina ajunge la Transport, iar Digi la Abonamente.
- Scurtăturile de salariu se văd.
- Căutarea arată suma și data.
- Calendarul scade chiria și rata.
- Tichetele au rândul lor pe cardul Mâncare.
- Salariul Ioanei pune mâncare doar până pe 10.

Nucleul, adică notarea, corectura, ștergerea cu „Anulează” și căutarea, e acum plăcut de folosit.

Cifrele de bază mă încurcă însă în continuare, și în locuri noi:

1. **Prima zi.** Am scris „Cât aveți acum: 4.100”, apoi am notat salariul Ioanei din 25.09, cum îmi cerea textul de final. Aplicația a pus banii de două ori: **8.400 lei, „Poți folosi azi 763 lei”**. Chiar și fără salariu, prima cifră a fost **372 lei/zi**, deși chiria și rata vin până pe 10. Nimic nu mi-a propus să împart cei 4.100 lei pe plicuri.
2. **Corectura de sold.** Am corectat soldul cardului (−4.300). Mișcarea a ajuns în **plicul Neprevăzute („cheltuit 4.383 / 300”)** și la „Ieșit −4.683” pe Astăzi. La închiderea ciclului, aplicația mi-a propus **Neprevăzute 300 → 9.710 lei**.
3. **Facturile.** Engie și Apa Nova au intrat în plicul **Chirie**. Plicul era bun în funcție, dar formularul îl suprascrie.
4. **Cifra zilei.** Dacă plătesc Enel și grădinița din plicurile lor, cifra zilei scade de la **365 la 0 lei**, deși „în plicul săptămânii mai sunt 1.831”.
5. **Două salarii.** Pe 10.10, tot restul de mâncare a intrat în săptămâna 3: **458 lei/zi**. Propunerea a zis „Liberi 1.733”. A doua zi, după ciclul nou, am avut **−2.672 nerepartizați**. Timp de 13 zile, cifra mare de pe Astăzi a fost „Așteaptă venitul următor 2.672 RON”.

**Notă globală (utilizator): 6/10** (de la 5,5/10). Urcă pentru că tot ce era P0 și aproape toate P1-urile de data trecută sunt reparate și verificate. Nu urcă mai mult, fiindcă au apărut 6 probleme P1 noi, toate în cifrele pe care un părinte le citește zilnic. Două dintre ele sunt regresii sau efecte ale reparațiilor: plicul Chirie pentru facturi și corectura de sold pusă în Neprevăzute.

---

## 2. Ce s-a îmbunătățit față de runda trecută (verificat)

| # vechi | Ce am verificat | Rezultat |
|---|---|---|
| 1 (P0) | Închiderea ciclului pe 11.10 | ✅ Pe plic, nebifat implicit, fără facturi. Mâncare 2.657 → 1.870, cifră rezonabilă (`U3/34-cycle-end-*.png`). Rămâne problema de la #P1-2 de mai jos. |
| 2 | Salariul Ioanei pe 25.09 | ✅ parțial. Mâncarea primește doar 15 zile (1.286), până la salariul meu. Pe 10.10 problema reapare altfel (vezi P1-4). |
| 3 | Benzină OMV/Petrom, Bolt, Digi | ✅ Transport / Taxi, Abonamente. ❌ Decathlon e încă la Alimente → Mâncare. |
| 4, 7 | Cifra zilei după repartizare, „bani liberi” | ✅ „86 lei azi” din plicul săptămânii, „lei liberi”. |
| 5 | Calendarul | ✅ Scade facturile: „Cel mai jos: 2.485 RON pe 1 noiembrie” (`U3/49-calendar-*.png`). |
| 6 | Scurtăturile „Salariul meu · 5.200” | ✅ Vizibile, 36 px (`U3/13-income-form-*.png`). |
| 8 | Corecția de sold | ✅ parțial. Se numește „Corecție de sold”, iar cea pozitivă nu intră la „Intrat”. ❌ Cea negativă intră în plic și la „Ieșit” (P1-1). |
| 9 | Tichete | ✅ Bifă „Primește și tichete de masă” pentru partener, rândul „+ tichete: 760 RON” pe Mâncare, tichetele scoase din „Nerepartizați”. |
| 11 | Săptămâni de 9 zile | ✅ parțial. Nu mai e „S1 fantomă”, dar pe 10.10 săptămâna 3 primește iar tot restul lunii (P1-4). |
| 12 | Plăți rare în rezumat | nereverificat (nu am adăugat plăți rare de data asta) |
| 13 | Analiză | ✅ Fără „media ultimelor 1 luni” cu tot roșu. |
| 14 | Căutare | ✅ Autofocus, sumă și dată pe rând, fără diacritice („mancare”, „benzina”, „gradinita”, „150” merg toate) (`U3/46-search-*.png`). |
| 16 | Mărunțișuri | ✅ „Pornește de la” nu mai e tăiat, după „Gata” ajungi pe Astăzi, grădinița și chiria sunt „PLĂTIT”. ❌ „Pornește: Telefonul lui Eu” e încă acolo. |
| nou | Obligații | ✅ Secțiune nouă, „Plăți lunare declarate”, cu starea fiecărei facturi în ciclu. |
| nou | Corecturi | ✅ Editarea sumei (1.500 → 150) și a plicului merge din Mișcări. Ștergerea cere „Ești sigur?” și oferă „Anulează”. |
| nou | Sincronizare offline | ✅ La „Creează camera” fără internet apare, după ~40 s, „Serviciul de sincronizare este temporar indisponibil”, fără să strice datele locale. |

---

## 3. Probleme găsite

### P1-1 · Corecția de sold negativă ajunge în plicul Neprevăzute și la „Ieșit”
- **Pași:** 28.09 → „Cât ai de fapt pe Card debit? Eu zic 8.112” → scriu 3.812 → „Salvez diferența”.
- **Așteptat:** soldul cardului se potrivește, iar plicurile și rapoartele rămân neatinse.
- **Ce s-a întâmplat:** mișcarea „Corecție de sold −4.300” apare ca „Altele · **Neprevăzute**”. Plicul Neprevăzute arată „DEPĂȘIT · cheltuit 4.383 / 300”. Alerta „PLIC DEPĂȘIT” a stat pe Astăzi două săptămâni. Pe Astăzi scrie „IEȘIT −4.683”, iar în Mișcări, pe 28 sept., „−4.683 RON”. La închiderea ciclului, aplicația propune „**Neprevăzute: 300 → 9.710 RON**” (`U3/23-d28-after-0.png`, `U3/24-plicuri-d28-*.png`, `U3/34-cycle-end-*.png`).
- **Cauză:** `client/src/lib/balance-check.ts:87-107` o creează corect, cu `allocationId: "outside"`, `adjustment: true`. Apoi `adoptOutsideExpenses` (`client/src/lib/finance-data.ts:1472-1491`) o „adoptă” în primul plic cu categoria Altele, pentru că nu sare peste `adjustment`. Separat, `client/src/pages/TodayView.tsx:224` (`periodExpense`) nu filtrează `isBalanceAdjustment`.
- **Reparare:** `if (isBalanceAdjustment(item)) return item;` în `adoptOutsideExpenses`. Același filtru la `periodExpense` și la totalurile pe zi din Mișcări. Un test cu o corecție negativă și un plic „Altele”.

### P1-2 · Facturile (Engie, Apa Nova, Enel) ajung în plicul Chirie
- **Pași:** 14.10 → Notează → 150 → „Engie” → Gata. La fel pentru „Apa Nova” și, pe 14.10, și pentru „Enel”.
- **Așteptat:** Gaz, Apă, Lumină. Funcția `allocationFromText` le găsește corect, am verificat-o direct: Engie → Gaz, Apa Nova → Apă.
- **Ce s-a întâmplat:** plicul ales e „Chirie · 2.000 RON rămași”. Pe 11.10 mersese doar pentru că Chirie era golit, iar atunci primul plic cu bani din „Casă & facturi” era Lumină. După ce am corectat de mână Engie → Gaz, a doua oară tot Chirie apare. Corectura nu se învață.
- **Cauză:** regresie. În `client/src/components/QuickEntryPanel.tsx:227-231`, textul setează categoria și plicul potrivit. Imediat după, efectul „plicul urmează categoria” (`QuickEntryPanel.tsx:113-119`) vede categoria schimbată și suprascrie plicul cu `matched[0]`.
- **Reparare:** când plicul vine din text, marchează-l ca ales (sau actualizează `previousCategory.current` înainte de `setCategory`). Adaugă un test de componentă: „Engie” → Gaz când Chirie are bani. Propune regula de comerciant la corectură („Engie → Gaz de acum încolo?”).

### P1-3 · Plătesc o factură din plicul ei, iar „Poți folosi azi” scade la 0
- **Pași:** 11.10, după repartizarea salariului meu. Astăzi arată 365 lei. Notez Enel 230 (plic Lumină), apoi Grădinița 750 (plic Grădiniță).
- **Așteptat:** cifra zilei (mâncare) rămâne 365, pentru că facturile au plicurile lor.
- **Ce s-a întâmplat:** 365 → **135** → **0,00 lei**, cu textul „Azi poți 0 lei. În plicul săptămânii mai sunt 1.831 pentru 3 zile.” (`U3/33-d11-*.png`, reprodus și cu scriptul `U3/hero.js`).
- **Cauză:** `client/src/lib/household-insights.ts:859-874`. `spentToday` adună **toate** cheltuielile zilei, inclusiv facturile, iar `fromLiquid = dayShareLeft(...)` scade cei 980 lei din partea zilei. `spendable = min(fromWeek, fromLiquid, …)` ia valoarea cea mai mică.
- **Reparare:** în `dayShareLeft`, pentru partea lichidă, socotește doar cheltuielile din plicuri variabile sau din afara plicurilor, nu și plățile din plicuri fixe.

### P1-4 · Două salarii: pe 10 tot restul de mâncare intră într-o singură săptămână, iar „Liberi 1.733” devine −2.672 a doua zi
- **Pași:** salariul Ioanei e repartizat pe 25.09. Pe 10.10 notez „Salariul meu · 5.200” și apăs „Aplică repartizarea”. Pe 11.10 apăs „Începe ciclul 10 oct. – 10 nov.”.
- **Ce s-a întâmplat:**
  - Propunerea socotește „Rate bancă 1.100 · **1.014 deja acoperiți**” și „Mâncare 2.657 · **1.286 deja acoperiți**”. Banii aceia erau ai ciclului vechi și sunt deja cheltuiți. Concluzia afișată: „Liberi după repartizare: 1.733 RON” (`U3/31-d10-salary-*.png`).
  - După aplicare, săptămâna S3 (05–10.10, cu toleranța până pe 13) are 1.971 lei: „**Poți folosi azi 365 · 1.831 pentru 4 zile**”, adică ~458 lei/zi (`U3/32-d10-applied-0.png`). E aceeași problemă ca #2/#11 de data trecută.
  - După „Începe ciclul”, chiria și rata ciclului nou revin la „de plătit”. Rezultat: „**Nerepartizați −2.672 RON**”. Timp de 13 zile, cifra mare de pe Astăzi a fost „PLAN DE REVIZUIT · AȘTEAPTĂ VENITUL URMĂTOR 2.672,00 RON” (`U3/37-d12-0.png`).
- **Cauză:** `client/src/lib/monthly-needs.ts:206-213` (`proposeIncomeSplit` → `fundedInCycle`). Luna propunerii merge de la salariul Ioanei (25 → 25). Planul merge de la salariul meu (10 → 10). Salariul de pe 10 cade în „luna Ioanei” și moștenește plicurile ciclului care se închide.
- **Reparare:** în ziua salariului principal, închide întâi ciclul și socotește propunerea pe ciclul nou (10.10–10.11), cu plicurile de la zero. Salariul Ioanei de pe 25 intră ca „vine pe 25 · 4.300”. Nu turna restul lunii în săptămâna curentă: săptămâna de toleranță primește doar partea ei.

### P1-5 · Soldul de la pornire plus salariul deja primit înseamnă bani dublați (8.400 lei, 763 lei/zi)
- **Pași:** onboarding, pasul 3: „Cât aveți acum, pe card și cash?” → 4.100 → Gata. Textul de final spune: „Când notezi salariul, pe Astăzi apare propunerea”. Așa că notez „Salariul Ioanei · 4.300”, cu data 25.09, când a intrat efectiv.
- **Așteptat:** o întrebare de felul „Salariul din 25.09 e deja în cei 4.100?”, sau măcar ca salariul să nu se adune a doua oară.
- **Ce s-a întâmplat:** „POȚI FOLOSI AZI **763,64** · Mai sunt **8.400 lei liberi** pentru 11 zile” (`U3/15-after-ioana-0.png`). Am reparat abia a doua zi, din „Cât ai de fapt pe card”, și de acolo a pornit P1-1.
- **Cauză:** `client/src/components/NeedsQuickStart.tsx:105-106` pune suma ca `openingBalance`, fără dată. Orice venit notat cu o dată anterioară se adaugă peste ea.
- **Reparare:** la pasul 3 întreabă „Salariul Ioanei din 25 septembrie a intrat deja? [Da, e în suma de mai sus]”. Dacă răspunsul e da, aplicația înregistrează venitul fără să schimbe soldul (sau mută soldul de pornire înainte de el) și deschide propunerea direct.

### P1-6 · Prima zi: 372 lei/zi din tot soldul, fără chirie și rată, și fără propunere de plicuri
- **Pași:** onboarding complet, cu 10 cheltuieli declarate și 4.100 pe card, fără alt pas.
- **Ce s-a întâmplat:** „POȚI FOLOSI AZI **372,73** · Mai sunt 4.100 lei liberi pentru 11 zile”. În același timp, Plicuri arată „0 plicuri · Nerepartizați 4.100”. Nu există niciun buton de tipul „Împarte cei 4.100 pe plicuri”: propunerea apare doar la notarea unui salariu, iar următorul e pe 10.10 (`U3/08-home-first-0.png`, `U3/10-plicuri-0.png`). Chiria de pe 1 și rata de pe 5 nu scad nimic din cifra zilei.
- **Reparare:** după onboarding, dacă există sold de pornire, deschide aceeași propunere ca la salariu („Ai 4.100 lei până pe 10: chirie, rată, mâncarea pe 13 zile…”). Până se aplică, cifra zilei să scadă obligațiile declarate care cad înainte de salariu.

### P2-1 · Cifra mare de pe Astăzi e un deficit, nu „cât pot azi”
- 28.09–09.10: „AȘTEAPTĂ VENITUL URMĂTOR 488 → 580 → 711”. 12.10–24.10: „2.672,00 RON” (`U3/26-d01-0.png`, `U3/37-d12-0.png`). Formularea e mai blândă decât „PESTE LIMITA PLANULUI”, dar cifra zilei (86 lei) e mică, mai jos, în bandă. Un părinte citește „2.672 RON” și crede că are atâția bani de cheltuit.
- **Reparare:** cifra mare rămâne „Poți folosi azi 86”, iar deficitul acoperit de un venit declarat trece într-un rând secundar.

### P2-2 · „Rămân neacoperiți 86 RON — venitul nu ajunge”, iar după aplicare sunt 1.628 liberi
- 25.10, propunerea pentru salariul Ioanei (`U3/52-d25-salary-*.png`). După „Aplică”, Plicuri: „Nerepartizați 1.628 RON” (`U3/54-d25-plicuri-*.png`). Cei 86 lei sunt diferența rămasă de la rata din septembrie. Mesajul sperie degeaba (venituri 9.500, cheltuieli 7.710).

### P2-3 · Cardul „Final de lună” din ziua salariului se contrazice
- 07.10: card −105 lei, dar „Mâncare: a ajuns, rămân 606 RON”. 10.10, înainte de salariu: „Poți muta fără grijă 260 RON”, cu cardul pe minus. După salariu: „Nu prisosește nimic de mutat: ce a rămas mai trebuie în zilele până la salariu”, deși salariul tocmai intrase (`U3/30-d10-morning-*.png`, `U3/32-d10-applied-2.png`).
- Tot aici: închiderea ciclului „27 sept. – 10 oct.” adună Enel, grădinița și Kaufland din **11.10**, bani ai ciclului nou („Ai cheltuit 5.520 RON”).

### P2-4 · „Bilanțul săptămânii: Cheltuielile au trecut peste veniturile săptămânii. Amână o plată neesențială.”
- Mesajul apare în orice săptămână fără salariu (16.10, 18.10), adică în trei din patru. Nu înseamnă nimic pentru un buget pe plicuri.
- **Loc:** `client/src/lib/household-insights.ts:1290`. Bilanțul ar trebui comparat cu plicurile săptămânii, nu cu veniturile ei.

### P2-5 · Magazinele necunoscute ajung automat în Mâncare, iar corecturile nu se învață
- „Decathlon 150” și „Cadou ziua lui Matei 150” → Alimente · Mâncare. Cadoul a mâncat un sfert din săptămâna de mâncare („S2: 110 RON rămași”). Formularul pornește cu Alimente, iar un nume necunoscut rămâne acolo fără niciun semn.
- **Reparare:** pentru text necunoscut, lasă „Altele / În afara plicurilor” sau cere o atingere pe categorie. Adaugă Decathlon, Jysk, Dedeman, eMAG, Pepco la categoriile lor.

### P2-6 · Nicio avertizare la mișcarea dublă
- 16.10: „Lidl 95” notat de două ori la câteva secunde (dublă atingere pe Gata). Aplicația nu întreabă „Ai notat deja Lidl 95 acum 1 minut. Îl mai pun o dată?”. Am văzut dublura abia în Mișcări. Ștergerea în sine merge bine (confirmare și „Anulează”).

### P3 · Mărunțișuri
1. Notează → Venit → „Adaugă notiță, altă dată sau corectează”: titlul foii devine „**Corectează mișcarea**”, deși adaug una nouă (`U3/zz-error.png`).
2. Onboarding: venitul se numește tot „Salariul partenerului” la pasul 3, deși i-am scris numele (Ioana). Nu se cere suma tichetelor. Sursa apare ca „Bonuri de masă · Ioana · **Ioana**” în Notează.
3. Cardul tutorial „1 · CAPTURĂ · Notează o mișcare când se întâmplă” rămâne pe Astăzi și după 10 mișcări notate.
4. Astăzi → „Mai mult din ziua asta”: ilustrația „Masa e pregătită, plicurile încă nu” strânge textul într-o coloană de ~80 px, cu „!”, „OK”, „!” rătăcite (`U3/09-home-more-1.png`). „Până la venit **13 zile**” apare lângă cifra zilei socotită pe **11 zile**.
5. Plicuri: blocul „Următorul salariu ~10 octombrie · Poate varia cu…” apare de două ori pe pagină (la „Salariul” și în „Ce plătim lunar”).
6. Obligații: „Lumină · mai sunt 20 RON” după ce factura Enel de 230 e plătită (suma e estimată, nu fixă). Deasupra scrie „Nu ai scadențe apropiate”, iar dedesubt „Chirie · de plătit”.
7. Calendar: „azi · 2.995 RON”, dar pe aceeași pagină „Sold estimat la final de zi: 2.695 RON”.
8. Alerta de transport după un plin: „cel mult 3,84 RON pe zi (acum 28,57)”, pentru un plin care ține o lună. Duminica, restul săptămânii (490 lei) apare ca „Poți folosi azi 490”.
9. Sincronizare fără internet: „Se conectează…” ~40 s, apoi „Serviciul de sincronizare este temporar indisponibil”. Ar fi mai util „Nu am internet, încearcă din nou” și mai repede.
10. Setări: încă „Pornește: Telefonul lui **Eu**” și „Culoarea lui Ioana: culoare automată”. Membrul principal se numește „Eu” peste tot, fiindcă onboardingul nu-mi cere numele.

---

## 4. Top 5 de făcut, în ordine

1. **Corecția de sold să nu mai atingă plicurile și rapoartele** (P1-1): o linie în `adoptOutsideExpenses` și un filtru în `TodayView.tsx:224`. Efort S, efect mare: altfel o singură corectură strică Neprevăzute, alertele și închiderea ciclului.
2. **Reparația regresiei „factura în plicul Chirie”** (P1-2), cu un test de componentă pentru Engie, Apa Nova și Enel. Efort S.
3. **Cifra zilei să nu scadă când plătești facturi din plicurile lor** (P1-3), în `household-insights.ts:859-874`. Efort S.
4. **Ziua salariului principal cu două venituri** (P1-4, P2-1, P2-2, P2-3): ciclul nou se deschide la aplicarea salariului, fără „deja acoperiți” din ciclul vechi, fără toată mâncarea într-o săptămână, cu cifra zilei ca cifră mare și cu deficitul acoperit de salariul Ioanei ca notă. Efort M–L.
5. **Prima zi cinstită** (P1-5, P1-6): întrebarea „salariul din 25 e deja în sold?” și propunerea de plicuri pentru soldul de pornire, cu chiria și rata scăzute din cifra zilei. Efort M.

*Numărătoare: P0 – 0 · P1 – 6 · P2 – 6 · P3 – 10.*
*Neverificat: ghidul AI (ar fi apelat funcțiile reale), sincronizarea reală și invitația (cererile spre server au fost blocate intenționat) și temele Întunecat/Navy (nereluate de data asta).*
*Notă de mediu: spre finalul testului, serverul de dezvoltare de la 127.0.0.1:5174 nu mai răspundea (curl → 000). Toate constatările de mai sus sunt făcute înainte de asta.*
