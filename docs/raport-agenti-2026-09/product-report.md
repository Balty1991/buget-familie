# Buget Familie: evaluare de produs și plan de lansare (România)

**Data:** 25 septembrie 2026 · **Versiune analizată:** 1.1.96 / versionCode 98 · `BILLING_LIVE = false`
**Surse:** README.md, PRODUCT_STRATEGY.md, ideas.md, todo.md, docs/PLAY_LISTING.md, docs/play-store-listing-ro.md, docs/ROADMAP_PLAY_2026.md, docs/BILLING_PLAY_PREP.md, docs/archive/MARKET_RESEARCH.md, docs/archive/analiza-concurenta-roadmap-2026-09.md, `client/src/lib/{monthly-needs,household-insights,entitlements,member-mode,allowance,price-history,statement-import}.ts`, plus căutări web punctuale (vezi „Surse web” la final).

> **Notă despre date:** accesul web a fost parțial (căutările au mers, unele site-uri au fost blocate de proxy). Prețurile concurenților marcate „indicativ” vin din cunoștințele mele și din căutări, nu din paginile oficiale verificate azi. Verificați-le înainte să le citați public.

---

## 1. Rezumat și poziționare

### Pe scurt

Buget Familie are **un nucleu de produs rar întâlnit și potrivit pentru România**: plicuri pe **ciclul de salariu**, nu pe luna calendaristică, cu tranșe săptămânale exacte, **„Ce plătim lunar”** declarat o singură dată și **repartizare automată la fiecare salariu**, cu două salarii în zile diferite, tichetele de masă ținute separat, plăți rare strânse lunar, plic de neprevăzute și transferuri propuse între parteneri. Nicio aplicație din top-ul Play RO nu face acest flux cap-coadă în română, fără login bancar.

Riscul principal **nu este lipsa de funcții**. Riscurile sunt:

1. **Prea multe funcții pentru un utilizator nou.** README-ul listează 5 teme, scor de sănătate, vârsta banilor, simulator, PDF, prețuri pe produs, vânător de abonamente, ghid AI și altele. Utilizatorul-țintă („nu folosește termeni financiari”) riscă să se piardă înainte de primul salariu repartizat.
2. **Încrederea într-o aplicație financiară făcută de un dezvoltator individual.** Politica stă pe `balty1991.github.io`, contactul e un Gmail, nu există nume de firmă și nici recenzii. Pentru o aplicație care ține bugetul familiei, contează mai mult decât AES-GCM.
3. **Introducerea manuală.** Fără legătură cu banca, fiecare cheltuială se scrie de mână. Cine nu notează nu revine. E motivul numărul unu de abandon în categorie.
4. **Distribuția.** Nu există încă un plan concret pentru primii 1.000 de utilizatori, nici bucle virale în afară de invitarea partenerului.
5. **Măsurarea.** Analytics e „opțional Umami, dacă e configurat la build”. Fără metrici de activare și retenție, deciziile de preț și roadmap se iau pe ghicite.

### Poziționare recomandată

> **„Salariul vine, aplicația îl împarte. Voi doar notați.”**
> Bugetul familiei pe plicuri, pe ciclul vostru de salariu. Fără parola băncii.

- **Segment primar:** cupluri cu 1–2 salarii și copii, 28–45 ani, cu rate sau credite, facturi, grădiniță sau școală, care ajung „la limită” spre ziua de salariu. Folosesc WhatsApp în familie, au Android (circa 70–75% din piața RO) și tichete de masă.
- **Segment secundar:** o singură persoană care vrea „cât pot cheltui azi până la salariu” (planul Casa), și pensionarii ajutați de copii prin modul membru.
- **Anti-poziționare (spusă explicit):** nu e un agregator bancar, nu dă credite și nu vinde produse financiare. Este opusul aplicațiilor cu open banking și al celor bancare, care arată doar **ce s-a întâmplat**. Buget Familie spune **ce urmează și cât mai poți**.

### Diferențiatori reali (de apărat)

| Diferențiator | De ce contează în RO | Există în cod |
|---|---|---|
| Ciclu salarial + tranșe săptămânale | Salariul vine pe 10, 15 sau 25, nu pe 1. Presiunea e în ultima săptămână. | `monthly-needs.ts` (`cycleWeeks`, `weeklyTarget`, `nextPaydayAfter`) |
| Repartizare automată pentru 2 salarii | Majoritatea familiilor au 2 venituri în zile diferite | `proposeIncomeSplit` / `applyIncomeSplit` |
| Plăți rare (RCA, impozite, Crăciun) | Șocurile anuale sunt specifice: impozit local până pe 31 martie, RCA, ITP, rovinietă | `rarePlan`, `planned-events.ts` (Paștele ortodox calculat) |
| Tichete de masă ca sursă separată | Circa 2 milioane de angajați primesc tichete (estimare) | sursele „Bonuri de masă”, excluse din repartizare |
| Cine plătește și transferuri | Cuplurile cu conturi separate | `pendingTransfers`, `settle-up.ts` |
| Modul membru (copil sau bunic) | Bunicii și copiii cu bani de buzunar | `member-mode.ts`, `allowance.ts` |
| Fără bancă, date pe telefon, sync E2E | Neîncredere mare în legarea băncii | `family-crypto.ts` |

---

## 2. Analiză concurență

| Produs | Tip | Preț (indicativ) | RO nativ | Familie / partajare | Plicuri / ciclu salarial | Legătură bancară | Amenințare pentru Buget Familie |
|---|---|---|---|---|---|---|---|
| **YNAB** | Buget zero-based, plicuri | 14,99 USD/lună sau 109 USD/an (circa 500 lei), probă 34 zile, până la 6 persoane | Nu (EN) | Da, 6 persoane | Plicuri da, fără ciclu salarial | SUA/UK/UE parțial | Mică în RO din cauza prețului și a limbii. **Referință pentru metodă și pentru modelul de 6 persoane la un singur preț.** |
| **Goodbudget** | Plicuri clasice | circa 10 USD/lună / 80 USD/an; free cu 10 plicuri | Nu | Da (sync) | Plicuri da, perioadă configurabilă | Nu | Mică. UI învechit. **Modelul free cu 10 plicuri e identic cu Casa** și validează gate-ul. |
| **Wallet (BudgetBakers)** | Tracker complet, CZ | Freemium; Premium de câțiva euro pe lună | Parțial (tradus) | Partajare conturi (Premium) | Bugete pe categorii, nu tranșe | Da, agresiv | **Medie-mare.** Lider CEE, ASO puternic pe „buget”, „cheltuieli”. |
| **Spendee** | Tracker vizual, CZ | Free + Plus/Premium circa 2–6 USD/lună | Tradus | Portofele comune | Bugete simple | Da | Medie. Recenziile se plâng de bank sync și lag. |
| **Money Lover** | Tracker, VN | Premium anual ieftin sau pe viață | Tradus | Portofel partajat | Bugete pe categorii | Limitat | Medie pe ASO, mică pe flux. |
| **Monefy** | Captură ultra-rapidă | Pro, plată unică mică | Tradus | Sync Dropbox/Drive | Nu | Nu | Mică. **Referință pentru viteza de introducere** (2 atingeri). |
| **Money Manager (Realbyte)** | All-rounder | Free + plată unică sau sync | Tradus | Slab | Bugete lunare | Nu | Medie pe ASO. Mulți români îl folosesc „ca un caiet”. |
| **CashControl** (RO) | Tracking RO | Free limitat, Pro circa 20 lei/lună | Da | Limitat | Nu | Parțial | **Directă pe cuvinte-cheie RO** și ancoră de preț (circa 20 lei). |
| **MiM – Money in Motion** (RO, Iancu Guda) | Tracker + educație financiară, open banking anunțat | Gratuit | Da | Mesaj „economii în familie” | Bugete, rapoarte | Open banking planificat sau parțial | **Cea mai mare amenințare de brand**: autor cunoscut, gratuit, RO. Diferențiere: plicuri pe salariu, privacy, cuplu. |
| **George (BCR)** | App bancară | Inclus în cont | Da | Nu (per titular) | „Spotlights”, limite pe categorii, indicator de buget, notificări la depășire | Nativ | **Mare pentru cine are totul la BCR.** Nu vede alte bănci, cash sau tichete, nu repartizează salariul și nu leagă partenerul. |
| **BT Pay** | App bancară | Inclus | Da | Nu | Categorii automate (ultimele 3 luni), credite | Nativ | Medie. Arată trecutul, nu planul. |
| **ING Home'Bank** | App bancară | Inclus | Da | Nu | Categorisire de bază (după cunoștințele mele) | Nativ | Mică-medie. |
| **Revolut** | Neobank | Free sau planuri plătite | Da | Conturi comune, Pockets / Vaults | Bugete lunare pe categorii | Nativ | **Mare la tineri urbani.** Buget lunar, nu ciclu. Doar banii din Revolut. |
| **Excel / caiet / notițe WhatsApp** | DIY | 0 | Da | Da (foaie partajată) | Da, cum vrea fiecare | Nu | **Cel mai mare concurent real.** Buget Familie trebuie să fie mai rapid decât caietul și să „gândească” (repartizare, alertă). |

### Concluzii

- **Aplicațiile bancare** (George, BT Pay, Revolut) au mutat „categoriile și limitele” spre utilitate de bază, gratuită. **Nu vindeți categorisire.** Vindeți ce nu poate face o bancă: **toate sursele (2 bănci, cash, tichete), ambii parteneri, planul înainte de cheltuială, plățile rare și ciclul salarial.**
- **Prețul Familia (19,99 lei/lună, 149 lei/an)** e aliniat cu CashControl Pro și de circa 3 ori sub YNAB. E sănătos pentru RO (veniturile medii sunt circa 9.444 lei pe gospodărie pe lună în S1 2026, conform INS). Riscul e ca MiM gratuit să ancoreze așteptarea la 0.
- **Nimeni nu ocupă cuvintele „plicuri” și „salariu” în română pe Play.** Oportunitate ASO clară.

---

## 3. Ce lipsește ca să fie „top” în România (prioritizat)

Ordinea e după impactul asupra **activării și retenției în primele 2 cicluri de salariu**, nu după cât de interesantă e funcția.

| # | Lipsă | De ce | Prioritate |
|---|---|---|---|
| 1 | **Încredere vizibilă**: domeniu propriu (ex. `bugetfamilie.ro`), entitate juridică (PFA/SRL) în Play, pagină „Cum vă protejăm datele” de 1 ecran, email pe domeniu, fața și povestea autorului | Aplicație financiară de la un dezvoltator necunoscut, cu politica pe github.io, înseamnă conversie scăzută pe listing și refund-uri. Play cere oricum date de contact verificate pentru dezvoltatorii noi. | P0 |
| 2 | **Onboarding „primul salariu repartizat” sub 3 minute**, cu șabloane de gospodărie RO („2 salarii + rată + copil la grădiniță”, „singur, chirie”, „pensionar”) care precompletează „Ce plătim lunar” | Magia produsului (repartizarea) apare doar după configurare. Azi prima valoare depinde de câtă răbdare are omul. | P0 |
| 3 | **Telemetrie minimă, opt-in și anonimă** (numărători de evenimente, fără sume) | Fără ea nu puteți măsura activarea, conversia trial→plată sau churn-ul. Se poate face în spiritul privacy (Umami agregat, fără ID persistent). | P0 |
| 4 | **Mod simplu ca default pentru utilizatori noi**, cu funcțiile avansate (teme, scor, vârsta banilor, simulator) ascunse până la ciclul 2 | Reduce copleșirea. „Simple mode” există, dar nu ca experiență inițială. | P0 |
| 5 | **Captură automată fără bancă**: citirea notificărilor push ale aplicațiilor bancare (BT Pay, George, ING, Revolut, Raiffeisen) pe telefon, ca propuneri în „De verificat” | Rezolvă introducerea manuală fără login bancar și păstrează poziționarea. Citirea SMS e interzisă de Play pentru aplicațiile non-SMS, dar `NotificationListenerService` e permis cu informare explicită. | P1 (cel mai mare efect pe retenție) |
| 6 | **Partenerul pe iPhone**: flux explicit „partenerul are iPhone → deschide PWA-ul și introduce parola familiei” | Un cuplu din 4 are cel puțin un iPhone. Dacă partenerul nu poate intra, Familia nu se vinde. PWA-ul există, dar nu e poziționat ca soluție. | P1 |
| 7 | **Notificări-ritual**: „A intrat salariul? Repartizează” (în ziua declarată), „Mâine e rata”, „Săptămâna merge prea repede”, raportul dinainte de salariu | Bucla de obișnuință e ciclul salarial. Logica există (`weekTooFast`, `cycleEndReport`), dar trebuie să ajungă la om când aplicația e închisă. | P1 |
| 8 | **Calendar anual RO preconfigurat**: impozit local (cu bonificația până la 31 martie și termenul de 30 septembrie), RCA, ITP, rovinietă, CASCO, PAD, verificarea centralei, început de școală, 1 Iunie, Paște, Crăciun, vacanță | Plăți rare există, dar un vrăjitor „bifează ce ai” cu date reale RO e un „wow local” și un argument ASO. | P1 |
| 9 | **Introducere vocală în română** („am dat 45 de lei la Lidl pe card”) cu recunoaștere de vorbire Android și parserul local existent (`understand.ts`) | Viteza de captură plus accesibilitate pentru bunici și modul membru | P1 |
| 10 | **Recenzii și rating ≥4,5** cu cerere in-app (Play In-App Review) după un moment de succes: primul salariu repartizat sau prima săptămână încheiată în plan | Ratingul e factorul numărul unu de conversie pe listing. | P1 |
| 11 | **Importuri bancare mai complete**: BRD, CEC, UniCredit, Salt, Libra, extras PDF (text) și „Partajează în Buget Familie” din aplicația bancară | Acoperă băncile mari rămase. Share-intent-ul scurtează drumul. | P2 |
| 12 | **Rapoarte „inflația coșului tău”** din `price-history.ts`, ca poveste lunară partajabilă | Inflația ridicată din 2025–2026 (TVA majorată, energie) e subiect de presă. E marketing gratuit. | P2 |
| 13 | **Aplicație iOS nativă** | Doar după ce Android arată retenție și conversie. PWA-ul acoperă deocamdată partenerul. | P3 |

**Ce NU ar trebui făcut acum:** open banking (cost, dependență de furnizor, contrazice mesajul „fără bancă”), reclame, marketplace de credite sau asigurări, funcții sociale, încă o temă.

---

## 4. Funcții noi propuse

Legendă efort: **S** ≤ 1 săptămână · **M** 2–4 săptămâni · **L** > 1 lună (un dezvoltator).

### 4.1 Șabloane de gospodărie la pornire („Familia ca noi”)
- **Problemă:** configurarea „Ce plătim lunar” de la zero durează și sperie.
- **Soluție:** 5–6 profiluri RO cu sume tipice editabile (chirie sau rată, utilități pe intervale, mâncare pe săptămână, grădiniță, transport, tichete). Omul ajustează numerele, nu construiește lista.
- **Impact:** activare, adică primul salariu repartizat în ziua 1 (+15–25% estimat).
- **Efort:** S · **Plan:** Gratuit.

### 4.2 Captură din notificările băncii („Plăți văzute”)
- **Problemă:** notarea manuală scade după săptămâna 2.
- **Soluție:** permisiune opțională de acces la notificări, cu filtru doar pe pachetele bancare cunoscute. Extrage local suma, comerciantul și cardul, apoi propune în „De verificat” cu plicul ghicit (`learned-rules.ts`, `merchant-rules`). Nimic nu pleacă de pe telefon. Informare explicită conform politicilor Play.
- **Impact:** foarte mare pe retenția D30 și pe acuratețea plicurilor.
- **Efort:** M (parsere per bancă, QA pe formate de notificare) · **Plan:** **Gratuit** pentru o bancă sau card, **Familia** pentru mai multe carduri (ambii parteneri). Bucla de obișnuință trebuie să fie accesibilă, iar valoarea de cuplu se plătește.

### 4.3 Partener pe iPhone (PWA ghidat)
- **Problemă:** familiile mixte Android/iPhone nu pot folosi sync-ul.
- **Soluție:** în invitația de familie, link plus instrucțiuni „Adaugă pe ecranul principal” pentru Safari. Test E2E pe iOS. Mesajul din listing: „Merge și pe iPhone, din browser”.
- **Impact:** deblochează conversia Familia pentru circa 25% din cupluri.
- **Efort:** S–M · **Plan:** Familia (sync).

### 4.4 Ziua de salariu (ritual push)
- **Problemă:** repartizarea e magia produsului, dar se întâmplă doar dacă omul deschide aplicația.
- **Soluție:** notificare locală în ziua așteptată a salariului (și în „prima dată posibilă”): „A intrat salariul lui Andrei? Apasă și vezi cum se împarte.” Dacă e detectat din notificarea băncii (4.2), propunerea vine gata făcută.
- **Impact:** mare pe retenția lunară (întoarcerea la fiecare ciclu).
- **Efort:** S · **Plan:** Gratuit.

### 4.5 Calendar anual RO („Plățile anului”)
- **Problemă:** șocurile anuale strică ciclurile (impozit, RCA, școală, Crăciun).
- **Soluție:** listă de bifat cu date și sume estimate. Aplicația calculează contribuția lunară (există deja `rarePlan`) și reamintește bonificația la impozitul local (termen 31 martie) și ITP-ul după data mașinii.
- **Impact:** mare pe percepția „făcută pentru România”. Argument ASO și PR în ianuarie.
- **Efort:** S · **Plan:** Gratuit (maxim 3 plăți rare în Casa), Familia nelimitat.

### 4.6 Introducere vocală RO
- **Problemă:** tastarea e lentă, iar bunicii și copiii nu tastează.
- **Soluție:** microfon în „Notează” și în widget. Recunoaștere de vorbire Android (on-device unde e disponibilă), apoi parserul local, apoi confirmare.
- **Impact:** mediu-mare (viteză, accesibilitate, modul membru).
- **Efort:** S–M · **Plan:** Gratuit.

### 4.7 Cash la bancomat → plic cash
- **Problemă:** România folosește mult cash. Retragerea de la ATM nu e cheltuială, dar dispare din urmărire.
- **Soluție:** o acțiune „Am scos cash”, care mută bani din sursa card în sursa cash, fără cheltuială. Plicurile cash scad apoi normal. La import sau notificare, ATM-ul e recunoscut automat.
- **Impact:** mediu (acuratețea soldurilor).
- **Efort:** S · **Plan:** Gratuit.

### 4.8 Facturi de utilități din PDF sau poză
- **Problemă:** lumina, gazul, internetul și întreținerea variază lunar. Omul caută suma și scadența în email.
- **Soluție:** „Partajează factura” (PDF sau poză) în aplicație, cu OCR local pentru sumă, scadență și furnizor. Actualizează suma din „Ce plătim lunar” pentru luna asta și setează reamintirea. `needAdjustments` există deja pentru ajustarea intervalelor.
- **Impact:** mediu-mare.
- **Efort:** M · **Plan:** Familia (tot OCR-ul avansat e argument de upgrade), cu 3 facturi pe lună gratuit.

### 4.9 Împărțirea cheltuielilor comune între parteneri
- **Problemă:** cuplurile cu conturi separate vor „cât îți datorez luna asta”.
- **Soluție:** se extinde `settle-up` cu reguli de împărțire (50/50, proporțional cu salariul, „eu chiria, tu mâncarea”) și un rezumat lunar trimis pe WhatsApp.
- **Impact:** mare pentru segmentul „DINK” și pentru cuplurile tinere. Diferențiere față de aplicațiile bancare.
- **Efort:** M · **Plan:** Familia.

### 4.10 „Anul familiei” / retrospectiva ciclului (card partajabil)
- **Problemă:** lipsește o buclă virală naturală.
- **Soluție:** card vizual fără sume absolute (procente, „am ajuns la salariu în 10 din 12 luni”, „am strâns pentru Crăciun”), partajabil pe WhatsApp sau Instagram, cu link spre Play. Lansare pe 2–5 ianuarie.
- **Impact:** achiziție organică.
- **Efort:** S–M · **Plan:** Gratuit (e marketing).

### 4.11 Inflația coșului vostru
- **Problemă:** oamenii simt scumpirile, dar nu le văd cifrat.
- **Soluție:** din `price-history.ts`, „coșul vostru s-a scumpit cu X% față de martie”, cu produsele care au crescut cel mai mult și magazinul cel mai ieftin observat.
- **Impact:** mediu pe retenție, mare pe PR.
- **Efort:** S (logica există) · **Plan:** Familia (raport complet), Gratuit (un număr).

### 4.12 Liste de cumpărături legate de plic
- **Problemă:** plicul de mâncare se golește la supermarket, nu în aplicație.
- **Soluție:** listă partajată (sync) cu estimare din istoricul de prețuri: „lista de azi aprox. 240 lei, ai 310 în săptămână”.
- **Impact:** mediu. Crește frecvența de deschidere pentru al doilea partener.
- **Efort:** M · **Plan:** Familia.

### 4.13 Alerte pentru rate cu dobândă variabilă (IRCC)
- **Problemă:** rata se schimbă trimestrial, iar planul rămâne pe suma veche.
- **Soluție:** o reamintire trimestrială „Verifică noua rată în aplicația băncii” și actualizare într-un pas a sumei din „Ce plătim lunar”. Fără sfaturi financiare.
- **Impact:** mic-mediu (acuratețe, încredere).
- **Efort:** S · **Plan:** Gratuit.

### 4.14 Venituri tipice RO ca șabloane
- **Problemă:** alocația copiilor, pensia (card sau poștaș), tichetele (încărcarea lunară) și bonusurile de Crăciun sau al 13-lea salariu nu apar ca venituri „normale”.
- **Soluție:** șabloane de venit cu ziua tipică și comportament: alocația în plicul copilului, tichetele doar pe plicul de mâncare, bonusul direct în „plăți rare” și obiective.
- **Impact:** mediu (se simte local).
- **Efort:** S · **Plan:** Gratuit.

---

## 5. Monetizare și retenție

### 5.1 Ce intră în Familia (recomandare)

Principiul actual e corect: **„Billing controlează funcțiile, nu registrul.”** Recomand ca limita să separe **„eu”** (gratuit) de **„noi”** (plătit), plus confort avansat.

| Funcție | Casa (gratuit) | Familia |
|---|---|---|
| Înregistrare, plicuri pe ciclu, tranșe, „Ce plătim lunar”, repartizare 1 salariu | Da | Da |
| Plicuri | 10 (ca acum) | Nelimitat |
| **Al doilea salariu în repartizare** | Nu (sau doar propunere, fără aplicare) | Da |
| Membri / telefoane / sync E2E | 1 / 1 / nu | 6 / 6 / da |
| Cine plătește, transferuri, împărțire între parteneri | Nu | Da |
| Modul membru (copil sau bunic), bani de buzunar | Nu | Da |
| Plăți rare | 3 | Nelimitat |
| Captură din notificări bancare | 1 card | Toate cardurile familiei |
| OCR bon | Da, local (e argument de adopție) | Da + facturi PDF nelimitat |
| Import CSV / Excel | Da | Da |
| Ghid local | Da | Da |
| Ghid online (Gemini) | **5/zi** (azi 20; costă bani, dar nu convertește) | 100/zi |
| Închidere ciclu, rapoarte avansate, inflația coșului, PDF | Rezumat | Complet |
| Widgeturi, WhatsApp săptămânal, backup | Da | Da |

**Observație:** „al doilea salariu” e cel mai curat trigger de plată. E exact momentul în care gospodăria devine familie, iar valoarea e evidentă.

### 5.2 Verificarea prețului

- **19,99 lei/lună** e ok ca ancoră (circa CashControl Pro, sub un abonament de streaming, circa 0,2% din venitul mediu al unei gospodării).
- **149 lei/an** (circa 12,4 lei/lună, „4 luni cadou”) e bun. Recomand un **preț de fondator de 99 lei/an** pentru primii 1.000 de plătitori sau până pe 31 ianuarie 2027, blocat cât timp abonamentul rămâne activ. Creează urgență și un nucleu de avocați.
- **Nu lansați Family+ (29,99)** în primele 6 luni. Împarte oferta și încurcă.
- **Opțiune de test (luna 4+):** „Familia pe viață” la 349–399 lei, ca produs unic în Play. Mulți români preferă plata unică (vezi Monefy și Money Manager). Costul marginal al sync-ului în Firestore e mic. Testați doar după ce aveți date despre churn.

### 5.3 Trial

- **14 zile e prea scurt**: nu acoperă un ciclu salarial, iar valoarea (salariul repartizat, ajuns la salariu în plan) apare după circa 30 de zile.
- **Recomandare:** **30 de zile gratuit** pe Familia, pornit **la conectarea celui de-al doilea telefon sau membru**, nu la instalare. Până atunci omul e în Casa, care e complet funcțional. Reamintiri în ziua 23 și ziua 28 (Play trimite oricum email înainte de reînnoire). Arătați în paywall ce ați făcut împreună în ciclu („3 salarii repartizate, 412 lei transferați corect între voi”).
- Actualizați `TRIAL_DAYS` în `entitlements.ts` și oferta din Play Console (planurile de bază permit oferte de probă de durate diferite).

### 5.4 Referral și viralitate

1. **Bucla internă, cea mai puternică:** invitarea partenerului. Un singur abonament acoperă toată familia (ca YNAB), deci partenerul e „gratuit” și nu e o barieră. Faceți invitația un moment central, la finalul onboardingului.
2. **„Dă mai departe o lună”:** fiecare abonat Familia primește lunar un cod de ofertă Play (Play Console → coduri promoționale sau oferte pentru abonamente, cu cote trimestriale) pentru o altă familie. Dacă aceasta devine plătitoare, abonatul primește o lună gratuită (prelungire prin server, deoarece `familyEntitlements` e deja scris de server).
3. **Carduri partajabile** (4.10), cu link Play și parametru `referrer` (Install Referrer API) ca să măsurați.
4. **WhatsApp săptămânal** există. Adăugați un footer discret „făcut cu Buget Familie” cu link, dezactivabil.

### 5.5 Retenție: bucla produsului

`Salariul intră → notificare → repartizare (1 atingere) → săptămâna are sumă exactă → avertizare „merge repede” → raport înainte de salariu → „ați ajuns cu X lei rămași” → repetă`

Ce trebuie să existe ca bucla să nu se rupă: notificări fiabile (4.4), captură fără efort (4.2, 4.6), o recompensă clară la final de ciclu (mesaj de reușită, „ați pus deoparte X”) și sync fără conflicte între parteneri.

---

## 6. Lansare Play

### 6.1 ASO: cuvinte-cheie RO

Pe Play, **titlul (30 de caractere)** și **descrierea scurtă (80)** au greutatea cea mai mare. „Buget Familie” e deja un cuvânt-cheie bun.

- **Titlu propus:** `Buget Familie: Cheltuieli` (25) sau `Buget Familie – plicuri salariu` (verificați să fie ≤30).
- **Descriere scurtă propusă:** `Buget pe salariu: plicuri, cheltuieli, facturi. Fără login bancar.` (circa 68). Actuala („Plicuri pe ciclu de salariu, sync familie criptat…”) folosește termeni tehnici („sync”, „criptat”) în loc de termenii căutați („buget”, „cheltuieli”).

**Cuvinte-cheie principale:** buget, buget familie, buget personal, cheltuieli, evidență cheltuieli, aplicație buget, buget lunar, gestionare bani, economii, salariu.
**Secundare, cu concurență mică:** plicuri, metoda plicurilor, cheltuieli casă, cheltuieli cuplu, împărțire cheltuieli, tichete de masă, bonuri fiscale, facturi, rate, scadențe, RCA, impozit, fără bancă, cash.
**Long-tail în descriere:** „cât pot cheltui până la salariu”, „buget pe săptămână”, „bani de buzunar copii”, „economii Crăciun”.

Repetați natural cuvântul „buget” de 4–6 ori și „cheltuieli” de 3–5 ori în descrierea lungă. Faceți experimente de listing în Play Console (A/B pe iconiță, capturi și descriere scurtă) după 1.000 de vizitatori pe săptămână.

### 6.2 Povestea capturilor (8 capturi, 1080×1920, text mare deasupra)

1. **„Cât poți cheltui azi, până la salariu”**: Astăzi, cu cifra mare.
2. **„A intrat salariul? Se împarte singur.”**: repartizarea pe plicuri (rate → facturi → mâncare → plăți rare).
3. **„Două salarii, zile diferite, un singur plan”**: al doilea salariu completează ce lipsește.
4. **„Mâncare: 600 lei pe săptămână, exact”**: tranșele săptămânale și „mai sunt 4 zile, 37 lei pe zi”.
5. **„RCA, impozite, Crăciun: strânse lunar”**: plăți rare.
6. **„Cine plătește? Aplicația vă spune cât să transferați.”**: parteneri.
7. **„Bonul se citește pe telefon. Poza nu pleacă.”**: OCR și „De verificat”.
8. **„Fără parola băncii. Datele stau la voi.”**: încredere plus widget.

Adăugați un video scurt de 20–30 s (repartizarea salariului în 3 atingeri) și un feature graphic cu mesajul „Salariul vine, aplicația îl împarte”.

### 6.3 Planul pentru primii 1.000 de utilizatori (8–10 săptămâni)

| Etapă | Acțiuni | Țintă |
|---|---|---|
| **0. Testare închisă (acum)** | 12+ testeri × 14 zile: prieteni, familie, colegi, **cupluri reale**, măcar 3 cu iPhone ca partener. Interviu de 15 min după primul salariu. | 20 de familii, ≥10 care trec de un salariu |
| **1. Lista de așteptare** | Landing pe domeniul propriu cu „Preț de fondator 99 lei/an” și email. Link în bio, în grupuri, în semnătură. | 300 de emailuri |
| **2. Comunități (organic)** | Postări utile, nu reclame: r/romania, grupuri de Facebook de mămici pe orașe, grupuri de economisire și frugalitate, grupuri de părinți de la grădiniță sau școală, forumuri auto (RCA/ITP ca subiect). Postați un **șablon gratuit Excel „Buget pe salariu”** care trimite către aplicație. | 400 de instalări |
| **3. Conținut scurt (TikTok, Reels, Shorts)** | Serie „Plicuri pe salariu”: 3 video-uri pe săptămână. Salariu de 5.000 lei împărțit, „ultima săptămână înainte de salariu”, „cât ne costă Crăciunul, strâns din octombrie”, „inflația coșului nostru”. Publicați în jurul zilelor de salariu (1, 10, 15, 25). | 300 de instalări |
| **4. Micro-creatori** | 5–10 creatori de finanțe personale sau parenting (5–50k urmăritori): cod de fondator plus comision per abonat. Evitați concurentul direct (MiM). | 200 de instalări |
| **5. Presă și tech RO** | Story: „aplicație românească de buget fără legătură cu banca, făcută de un părinte”, cu inflația coșului ca unghi. Ținte: Start-up.ro, Playtech, Wall-Street.ro, Economica, bloguri de finanțe personale. | 200 de instalări |
| **6. Moment sezonier** | Campania „Crăciun fără card de credit” (octombrie–decembrie). „Anul familiei” pe 2–5 ianuarie. „Impozitul cu bonificație” în februarie–martie. | Vârfuri de achiziție |

**Buget de plată:** opțional, 500–1.000 lei de test pe Google App Campaigns sau Meta, doar după ce D7 ≥ 15% (altfel plătiți ca să pierdeți oameni).

---

## 7. Metrici de urmărit

Toate ca **evenimente anonime, opt-in, fără sume** (numărători), coerent cu mesajul de privacy.

| Etapă | Metrică | Țintă la 90 de zile |
|---|---|---|
| Listing | Rata de conversie vizită → instalare (Play Console) | ≥ 30% |
| Activare | % instalări cu **salariu declarat + ≥3 plicuri + prima cheltuială în 24h** | ≥ 40% |
| Activare | Timpul median până la prima repartizare | ≤ 5 min |
| „Aha” | % utilizatori care **aplică o repartizare la salariu** în primele 30 de zile | ≥ 30% |
| Obișnuință | Mișcări notate pe săptămână per gospodărie activă (median) | ≥ 10 |
| Retenție | D1 / D7 / D30 (gospodării cu ≥1 mișcare) | 35% / 15–20% / 10% |
| Retenție | **% care ajung la al doilea ciclu salarial activ** (metrica nord) | ≥ 20% din instalări |
| Familie | % gospodării cu ≥2 telefoane conectate | ≥ 15% din active |
| Monetizare | Start trial → plată | ≥ 25–35% (trial pornit la partener = intenție mare) |
| Monetizare | Instalare → plătitor | 2–4% |
| Monetizare | Pondere abonamente anuale | ≥ 40% |
| Monetizare | Churn lunar pe abonamentele lunare | ≤ 8% |
| Calitate | Crash-free / ANR | ≥ 99,5% / < 0,47% (pragul Play) |
| Calitate | Rating Play | ≥ 4,5 |
| Încredere | Conflicte de sync nerezolvate per 100 de gospodării pe săptămână | ~0 |
| Captură | % mișcări venite din notificări, bon sau import (față de manual) | în creștere, țintă 40% |

**Metrica nord recomandată:** *gospodării care au încheiat un ciclu salarial cu plan activ (repartizare aplicată și ≥10 mișcări în ciclu)*.

---

## 8. Roadmap pe 3 luni (octombrie – decembrie 2026)

### Luna 1 (octombrie): lansare cu încredere și activare
- Închiderea testării închise, trecerea în producție (fără billing).
- Domeniu propriu, email, entitate juridică în Play; politica și termenii mutați pe domeniu.
- **Onboarding cu șabloane de gospodărie** (4.1) și **mod simplu implicit** la instalare.
- **Notificarea de zi de salariu** (4.4) și notificările de scadență.
- Telemetrie opt-in anonimă cu evenimentele de activare.
- ASO: titlu și descriere scurtă noi, 8 capturi cu poveste, video.
- Cerere de recenzie in-app după prima repartizare.
- Startul conținutului „Plicuri pe salariu” și al listei de așteptare de fondator.

### Luna 2 (noiembrie): monetizare și captură
- **`BILLING_LIVE = true`** după checklist-ul din `BILLING_PLAY_PREP.md`: trial de **30 de zile pornit la al doilea membru sau telefon**, preț de fondator 99 lei/an, restaurare, downgrade fără pierderi.
- Limitele revizuite: al doilea salariu, sync, membri, modul membru; AI online Casa redus la 5/zi.
- **Captură din notificările bancare** (4.2): beta pe BT Pay, George și Revolut.
- **Partener pe iPhone prin PWA** (4.3), testat E2E.
- **Cash la bancomat** (4.7) și **introducere vocală** (4.6).
- Campania „Crăciun fără card de credit” (plicul de Crăciun, contribuția lunară).

### Luna 3 (decembrie): retenție și buclă virală
- **Calendarul anual RO** (4.5) cu impozitul local și bonificația, RCA, ITP, rovinietă; gata pentru ianuarie.
- **Împărțirea cheltuielilor între parteneri** (4.9).
- **„Anul familiei 2026”** (4.10) și cardul „inflația coșului” (4.11), lansate pe 2–5 ianuarie.
- Referral „Dă mai departe o lună” prin coduri de ofertă Play.
- Retro pe date: ce pas din activare pierde cei mai mulți oameni; A/B pe paywall (lunar vs. anual în prim-plan).
- Decizie pentru trimestrul 1 din 2027: planul pe viață (test), importuri pentru bănci suplimentare, iOS nativ (doar dacă D30 ≥ 10% și conversia ≥ 2%).

---

## Surse web (consultate 25.09.2026)

- BCR – funcții George 2026 (Spotlights, limite pe categorii, indicator buget): https://www.bcr.ro/ro/news-hub/blog/noutati/cum-te-ajuta-george-app-sa-tii-cheltuielile-sub-control-spotlights-si-indicatorul-buget-din-fin-coach și https://www.bcr.ro/ro/news-hub/blog/noutati/cum-iti-setezi-limite-de-cheltuieli-in-george
- Banca Transilvania – categorii în BT Pay: https://intreb.bancatransilvania.ro/ce-este-optiunea-bt-pay-de-urmarire-pe-categorii-a-cumparaturilor-facute-cu-cardurile-bt/
- YNAB – prețuri 2026 (14,99 USD/lună, 109 USD/an, 34 de zile probă, 6 persoane): https://getfinny.app/blog/ynab-pricing-2026 și https://www.planandmultiply.com/en/blog/ynab-pricing-2026-plans-features-alternatives
- Aplicații de buget în RO (CashControl, MiM): https://facetotibanii.ro/aplicatii-buget-personal-romania/ și https://iancuguda.ro/mim/ (pagina MiM nu a putut fi deschisă prin proxy)
- Venituri medii pe gospodărie în S1 2026 (INS, 9.444 lei): https://www.bugetul.ro/venituri-medii-de-9444-lei-pe-gospodarie-in-prima-jumatate-a-anului-2026-datele-ins-arata-discrepantele-dintre-clasele-s/
- Surse interne din repo: `docs/archive/MARKET_RESEARCH.md` (Goodbudget, Spendee, Wallet, Money Manager, CashControl, Martia, Plan & Multiply).

*Neverificate azi (din cunoștințele mele):* prețurile Wallet, Spendee, Money Lover și Monefy; ponderea iOS în RO; numărul de beneficiari de tichete de masă; detaliile politicii Play pentru `NotificationListenerService` și cotele de coduri promoționale. Verificați-le înainte de publicare sau implementare.
