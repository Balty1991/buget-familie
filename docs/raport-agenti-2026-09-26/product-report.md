# Buget Familie: audit de produs (26.09.2026)

**Versiune:** 1.1.96, commit `1935b14` · `BILLING_LIVE = false`
**Cum am lucrat:**
- Am trecut prin aplicație cu Playwright pe `127.0.0.1:5174`, la 390 px. Am făcut pornirea de la zero pe drumul „Vreau ca aplicația să-mi împartă salariul”, cu șablonul „Familie cu copii”. Apoi am încărcat date de test și am parcurs Astăzi, Mai mult, Analiză, Obiective și Obligații.
- Am citit codul: `NeedsQuickStart`, `FirstRunSetup`, `entitlements`, `review-prompt`, `settle-up`, `statement-import`, `statement-merchant`, `cycle-close`, `family-crypto`, `family-invite`, `local-notifications`, `PriceWatchPanel`, `HabitsGoals`.
- Am citit documentele: README, CHANGELOG, `play-store-listing-ro.md`, `SCREENSHOTS.md`, `PLAY_STATUS.md`.
- Am făcut două căutări web (Revolut, MiM).
- Am comparat cu raportul anterior (`docs/raport-agenti-2026-09/product-report.md`) și cu cele 78 de commituri făcute de atunci.

---

## 1. Pe scurt

Nucleul produsului e acum solid și unic în România. Plicurile merg pe ciclul de salariu, iar „Ce plătim lunar” duce la repartizarea automată a două salarii. Aplicația mai are:
- tichete de masă ținute separat;
- plăți rare, cu calendarul impozitului local;
- șabloane de gospodărie la pornire;
- abonamente detectate, inclusiv scumpirile lor;
- raportul lunii de trimis pe WhatsApp;
- notificare în ziua salariului;
- widgetul „Poți cheltui azi”;
- mod simplu;
- cerere de recenzie.

Aproape tot ce era P0 și P1 în raportul de produs anterior s-a făcut.

**Ce s-a schimbat pe piață:** **Money in Motion (MiM)** are acum **open banking pentru toate băncile din România și Revolut**, **sincronizare între membrii familiei**, e **gratuit** și a trecut de 120.000 de descărcări. Asta mută concurența. Buget Familie nu mai e „singura aplicație românească de familie”. Rămâne singura care **face planul înainte de cheltuială, pe salariu**, fără acces la bancă.

**Unde pierde acum Buget Familie:**
1. Primele două săptămâni ale unui utilizator nou sunt goale până la primul salariu (constatarea 1).
2. Transferurile între conturi proprii și retragerile de la bancomat sunt socotite cheltuieli (constatarea 2).
3. Captura e încă manuală sau prin CSV, pe când MiM o face automat.
4. Nu există nicio măsurare a activării.
5. Semnalele de încredere lipsesc încă: domeniu propriu, firmă, contact pe domeniu.

**Notă globală pentru produs: 7,5/10.** Nucleul valorează 9/10. Activarea (5/10), captura (5/10) și măsurarea (2/10) trag nota în jos.

---

## 2. Ce s-a făcut din raportul anterior (verificat în cod)

| Propunere din 25.09 | Stare azi | Unde |
|---|---|---|
| 4.1 Șabloane de gospodărie la pornire | **Făcut** (Singur, Cuplu, Familie cu copii) | `NeedsQuickStart.tsx:31-35` |
| 4.4 Notificare în ziua salariului | **Făcut** („Venit mâine”, „Ziua venitului”) | `local-notifications.ts:482-494` |
| 4.5 Calendar anual RO (impozit, RCA, ITP, rovinietă) | **Făcut** (butoane pentru plăți rare în Plan) | `planned-events.ts`, `MonthlyNeedsPanel` |
| 4.11 Inflația coșului | **Făcut** („Coșul etalon”). Nu se poate partaja. | `PriceWatchPanel.tsx:55` |
| Mod simplu implicit | **Făcut** (intenția „doar să notez”) | `FirstRunSetup.tsx:275` |
| Cerere de recenzie | **Parțial**: deschide pagina din Play, nu fereastra din aplicație (constatarea 5) | `review-prompt.ts` |
| Abonamente detectate | **Făcut**, cu scumpiri și costul pe an | `household-insights.ts:247,320` |
| Raport lunar pentru familie | **Făcut** (text pentru WhatsApp) | `household-insights.ts:366,409` |
| 4.2 Captură din notificările băncii | **Nefăcut** | nu există `NotificationListenerService` în `android/` |
| 4.3 Partener pe iPhone (ghid PWA) | **Parțial**: linkul de invitație deschide aplicația web, dar nu există niciun ghid pentru iPhone | `family-invite.ts:12,45` |
| 4.6 Introducere vocală | **Nefăcut** | – |
| 4.7 Bani scoși de la bancomat → cash | **Nefăcut**. La import, retragerea devine cheltuială (constatarea 2). | `statement-merchant.ts:62` |
| 4.8 Facturi din PDF | **Nefăcut** | – |
| 4.9 Împărțire între parteneri după o regulă | **Nefăcut**. Doar în părți egale. | `settle-up.ts:10-11` |
| 4.10 „Anul familiei” | **Nefăcut**. Nu se păstrează istoricul ciclurilor. | `cycle-close.ts:146` |
| 4.12 Liste de cumpărături legate de plic | **Nefăcut** (există un catalog de produse online, fără listă) | `ProductCatalogPanel.tsx` |
| 4.13 Reamintire IRCC | **Nefăcut** | – |
| 4.14 Venituri tipice RO (alocație, pensie, al 13-lea) | **Nefăcut** | `NeedsQuickStart.tsx` are doar „Salariul meu / al partenerului” |
| Telemetrie opt-in | **Nefăcut** (zero rezultate pentru `analytics/telemetry/umami` în `client/src`) | – |
| Probă de 30 de zile, pornită la partener | **Nefăcut**: `TRIAL_DAYS = 14` | `entitlements.ts:37` |
| Ghid online pe Casa redus la 5 pe zi | **Nefăcut**: `aiOnlinePerDay: 20` | `entitlements.ts:26` |
| ASO: descriere scurtă nouă | **Nefăcut**. Au rămas „sync familie criptat”. | `docs/play-store-listing-ro.md` |
| Domeniu propriu, firmă, email pe domeniu | **Nefăcut**. Politica e tot pe `balty1991.github.io`, iar contactul e un Gmail. | `play-store-listing-ro.md`, `client/public/privacy.html` |

---

## 3. Constatări (produs)

### 1. P1: primul „aha” vine abia la salariu, adică după până la 30 de zile
- **Ce am văzut:** am făcut pornirea pe 26 septembrie, cu salariul pe 10. Pașii au fost „împarte salariul” → venit 5.200, ziua 10 → „Familie cu copii” → Gata.
  - Aplicația duce la **Plicuri: „0 plicuri · 0 RON · Așază primii lei într-un plic”**.
  - Pe Astăzi apare doar „Planul e pregătit. Când îți vine salariul (în jur de 10 octombrie), notează-l…”. Nu apare nicio cifră a zilei.
  - Drumul „salariu” **nu întreabă cât ai acum pe card**. Întrebarea există doar pe drumurile „money”, „organize” și „family” (`FirstRunSetup.tsx:310,441`).
- **De ce contează:** omul instalează aplicația când e strâmtorat, adică la mijlocul ciclului sau spre final. Timp de 14 zile nu primește nimic din ce i s-a promis („cât pot cheltui azi”). În categorie, D7 se decide în primele 48 de ore.
- **Cum se reproduce:** pornești de la zero, alegi prima intenție, completezi pașii 1–3 și apeși Gata.
- **Propunere: „Până la salariu” (ciclul de legătură)**, ca pas 3b în `NeedsQuickStart`:
  - Întrebarea: „Cât aveți acum pe card și cash?”, cu câmpurile din `FirstRunSetup` pentru `openingBalance`.
  - Se aplică o repartizare parțială pe zilele rămase până la `nextPayday`, cu aceeași logică. Suma disponibilă e soldul de acum. Mâncarea primește suma pe săptămână înmulțită cu săptămânile rămase. Obligațiile care cad înainte de salariu sunt puse deoparte primele.
  - Se face prin `proposeIncomeSplit`/`applyIncomeSplit` (`monthly-needs.ts`), cu un venit virtual „Bani de acum”.
  - Rezultatul: cifra zilei apare din prima zi, iar Astăzi arată „Până pe 10 octombrie: 84 RON pe zi”.
- **Efort:** S–M.

### 2. P1: transferurile între conturi și retragerile de numerar strică cifrele
- **Ce am văzut:**
  - `TransactionKind = "income" | "expense"` (`finance-data.ts:10`). Nu există un tip pentru transfer.
  - La importul de extras, orice debit devine cheltuială (`statement-import.ts:317-320`).
  - „Retragere numerar ATM” primește doar titlul „Retragere numerar” (`statement-merchant.ts:62`), dar rămâne **cheltuială de pe card**. Dacă omul notează apoi ce a plătit cash, **aceiași bani sunt numărați de două ori**.
  - La fel se întâmplă cu:
    - alimentarea Revolut din BT;
    - plata cardului de credit;
    - „transfer între conturile proprii”;
    - banii trimiși partenerului.
- **De ce contează:** analiza, „Unde au mers banii”, bilanțul lunii și raportul pe WhatsApp arată cheltuieli umflate. Cine importă extrase de la două bănci (cazul tipic de cuplu) primește cifre greșite din prima lună. Aici se pierde încrederea.
- **Propunere:**
  1. Un nou tip `kind: "transfer"`, cu `fromSourceId`/`toSourceId`, exclus din cheltuieli și venituri, dar care mută soldul între surse.
  2. La import, recunoașterea automată a lui: retragere numerar/ATM, „transfer propriu”, „Top-up”, „Revolut”, „alimentare cont”, plata cardului de credit. Sumele egale cu semn opus în două extrase, în ±2 zile, se împerechează.
  3. În „Notează”, butonul „Am scos cash” (propunerea 4.7 din raportul anterior, ieftină odată ce tipul există).
- **Unde:** `finance-data.ts` (tipul, `sourceBalance`, filtrele de analiză), `statement-import.ts`, `ReviewCenterPanel`, `QuickEntryPanel`.
- **Efort:** M. Tipul nou atinge calculele. Trebuie teste în `finance-core.*.test.ts`.

### 3. P1: nu există nicio măsurare, iar lansarea cu Billing se face pe ghicite
- **Ce am văzut:** nu există niciun eveniment de activare sau retenție. Funcțiile de server numără doar cererile către ghid și feedbackul.
- **Propunere:** contoare agregate, **opt-in**, fără ID de utilizator și fără sume:
  - O funcție `metric` în `functions/src/index.ts` care face `increment` pe `metrics/{yyyy-mm-dd}.{event}`.
  - Aceeași limită pe telefon pe care o folosește deja `takeQuota`.
  - Evenimente propuse:
    - `onboard_done:{intent}`;
    - `first_expense`;
    - `split_applied`;
    - `cycle_closed_in_plan`;
    - `second_device`;
    - `import_done:{bank}`;
    - `review_shown/answered`;
    - `paywall_shown:{reason}`, `trial_started`;
    - `week2_active`.
  - Buton în Setări → Confidențialitate. Frază nouă în politică și în Data safety („statistici de utilizare anonime, opționale”).
- **Efort:** S–M.

### 4. P2: pasul 2 al pornirii nu arată dacă banii ajung
- **Ce am văzut:** șablonul „Familie cu copii” completează aproximativ **7.700 RON pe lună**. Calculul: 900 pe săptămână × 4,33, plus 1.400 + 350 + 200 + 120 + 150 + 800 + 400 + 400. Venitul declarat era 5.200. În pasul 2 nu există total și nici comparație, iar omul află abia la repartizare că „rămân neacoperiți” (`IncomeSplitCard.tsx:59`).
- **Propunere:**
  - O bandă lipită jos: „Venituri 5.200 · Cheltuieli ~7.700 · **lipsesc ~2.500**”, cu roșu doar peste 0.
  - Șabloanele să fie scalate după venit (proporții, nu sume fixe), cu minime pentru facturi.
- **Unde:** `NeedsQuickStart.tsx` (pasul 2), cu o funcție pură `monthlyNeedsTotal`, ușor de testat.
- **Efort:** S.

### 5. P2: cererea de recenzie scoate omul din aplicație și vine la momentul greșit
- **Ce am văzut:**
  - Butonul „Lasă o recenzie” deschide `PLAY_STORE_URL` (`review-prompt.ts:10`), nu fereastra de recenzie din aplicație (Play In-App Review).
  - Condiția de afișare e „21 de zile și 30 de mișcări” (`review-prompt.ts:15-19`), nu un moment de reușită.
- **Propunere:**
  - Pluginul nativ `ReviewManager` în `BugetFamilieNativePlugin.java`, apelat direct fără pre-întrebare. Politica Play descurajează întrebările de filtrare de tipul „îți place?”.
  - Declanșare după `cycle_closed_in_plan` sau după a doua repartizare aplicată.
- **Efort:** S.

### 6. P2: prima alegere are 6 intenții care se suprapun
- **Ce am văzut:** „Vreau doar să notez și să văd cât mai am” și „Vreau doar să văd pe ce se duc banii” se suprapun. La fel „Vreau să-mi organizez luna” și „Vreau ca aplicația să-mi împartă salariul”. Și „Vreau un buget pentru familie” se amestecă cu celelalte.
- **Propunere:** 3 intenții, fiecare cu drumul ei: „Împarte-mi salariul (recomandat)”, „Doar notez”, „Mă alătur familiei (am primit o invitație)”. A treia lipsește azi de pe primul ecran. Partenerul invitat trebuie să treacă prin 6 opțiuni sau prin „Mai târziu” ca să ajungă la Sync.
- **Unde:** `FirstRunSetup.tsx:267-300`.
- **Efort:** S.

### 7. P2: materialele de lansare sunt rămase în urmă față de aplicație
- `docs/play-store-assets/SCREENSHOTS.md` descrie versiunea 1.1.69: bara cu Plan, Obligații și Analiză, și Sync pe cadrul 7. Bara de azi e **Astăzi · Plicuri · Notează · Mișcări · Mai mult**.
- README-ul vorbește încă despre „5 teme … Aurora … Cyber”, deși au rămas Alb, Întunecat și Navy.
- Descrierea scurtă de pe Play are termeni tehnici.
- **Propunere:** vezi secțiunea 5.2. **Efort:** S.

### 8. P3: limita pachetului de sync cere ștergerea istoricului
- **Ce am văzut:** mesajul de la 70% spune „șterge mișcările din anii încheiați” (`useFamilySync.ts:495`, `family-crypto.ts:108`). Istoricul este chiar valoarea produsului pe termen lung. Pragul e departe (cam 27.000 de mișcări), dar soluția propusă e anti-produs.
- **Propunere:** „Închide anul”. Mișcările anului trec într-o arhivă locală (IndexedDB plus fișierul de copie), iar în pachet rămân rezumatele lunare pe categorii și pe plicuri. Analiza pe ani citește rezumatele.
- **Efort:** M.

---

## 4. Concurența pentru români: unde câștigă și unde pierde

| Concurent | Ce face bine (față de BF) | Unde câștigă Buget Familie |
|---|---|---|
| **MiM** (gratuit, ONG, open banking cu toate băncile RO și Revolut, familie, 120k+ descărcări) | Captură **automată** din toate băncile, gratuit, brand cunoscut (Iancu Guda), educație financiară | Planul **înainte** (repartizarea salariului, săptămâna de mâncare, plăți rare), fără acces la bancă, cash și tichete, „cine cui dă”. MiM arată ce s-a întâmplat, BF spune cât mai poți. |
| **YNAB** (circa 109 USD/an) | Metoda (fiecare leu are un loc), comunitate, educație, legătură cu banca în SUA/UK | Română, ciclu salarial, preț de 3 ori mai mic, tichete, plăți rare RO. YNAB nu are săptămâni exacte între salarii. |
| **Goodbudget** | Plicuri clasice cu sync, 10 plicuri gratuit | UI modern, repartizare automată, RO, ghid |
| **Monefy** | Notare în 2 atingeri, plată unică | Plan, familie. **BF pierde la viteza notării fără sumă precompletată** (vezi 5.1, ideea 5). |
| **Wallet (BudgetBakers)**, **Spendee** | Sincronizare bancară CEE, ASO puternic, grafice | Ciclu salarial, plicuri săptămânale, confidențialitate, cuplu |
| **George (BCR)** | Limite pe categorii, „Spotlights”, zero efort | Vede doar BCR. Nu vede cash, tichete, al doilea partener sau planul. |
| **BT Pay** | Categorii automate, gratuit | La fel: doar trecutul, doar BT |
| **ING Home'Bank** | Categorisire de bază | La fel |
| **Revolut** (buget lunar cu limită pe zi, cont comun, Pockets) | **Cifra pe zi**, cont comun cu parteneri, Pockets ca plicuri reale | Revolut pornește de la luna calendaristică și vede doar banii din Revolut. BF vede toate băncile și ciclul real. |

**Concluzie:**
- Cu MiM gratuit și automat, **captura manuală a devenit dezavantajul principal**. Rezolvarea potrivită cu poziționarea „fără bancă” e **citirea notificărilor bancare pe telefon** (ideea 3) și importul mai deștept (constatarea 2). Open banking ar însemna cost, contract și contrazicerea mesajului.
- Nișa de apărat e **„bugetul pe plicuri pentru cuplu, pe salariu”**. Nimeni altcineva nu face repartizarea automată a două salarii în zile diferite.

---

## 5. Funcții noi, prioritizate după impact și efort

Efort: **S** ≤ 1 săptămână · **M** 2–4 săptămâni · **L** peste o lună.
Nu am repetat funcțiile care există deja.

| # | Funcție | Impact | Efort | Plan |
|---|---|---|---|---|
| 1 | Ciclu de legătură „până la salariu” (constatarea 1) | Foarte mare: D1/D7 | S–M | Gratuit |
| 2 | Tip „transfer”, bancomat, conturi proprii (constatarea 2) | Mare: încredere, analiză | M | Gratuit |
| 3 | Captură din notificările băncii | Foarte mare: retenție D30 | M | 1 card gratuit, mai multe în Familia |
| 4 | Telemetrie opt-in (constatarea 3) | Mare: decizii | S–M | – |
| 5 | „Notează” pornit din notificare, cu suma propusă | Mare: frecvență | S | Gratuit |
| 6 | Istoricul ciclurilor și „seria” sănătoasă | Mare: retenție lunară | S | Gratuit |
| 7 | Împărțire între parteneri după o regulă | Mare pentru cupluri, motiv de plată | S–M | Familia |
| 8 | Fond de siguranță calculat | Mediu | S | Gratuit |
| 9 | Venituri tipice RO (alocație, pensie, al 13-lea, încărcarea tichetelor) | Mediu: se simte local | S | Gratuit |
| 10 | Partener pe iPhone, ghidat | Mare pentru conversia în Familia | S | Familia |
| 11 | Notare vocală în română | Mediu | M | Gratuit |
| 12 | Card „Ciclul nostru” partajabil, fără sume | Mediu: achiziție | S–M | Gratuit |
| 13 | Lista de cumpărături legată de plic | Mediu | M | Familia |
| 14 | Anunț la scumpirea unui abonament | Mic-mediu | S | Gratuit |
| 15 | Închiderea anului (constatarea 8) | Mic acum, mare în anul 2 | M | Gratuit |

### Detalii

**3. Captură din notificările băncii („Plăți văzute”)**
- **Problema:** notarea manuală scade după săptămâna 2, iar MiM aduce totul automat.
- **Cum ar arăta:**
  - Un comutator în Setări, „Citește notificările aplicațiilor băncii”, cu un ecran de informare explicit.
  - Filtrul acceptă doar pachetele cunoscute: BT Pay, George, ING, Revolut, Raiffeisen Smart Mobile, CEC, BRD YOU.
  - Suma, comerciantul și cardul se extrag local. Propunerea ajunge în „De verificat”, cu plicul ghicit de `merchant-rules`/`learned-rules`.
  - Notificarea proprie oferă „Mâncare · 145 RON la Kaufland · [Confirmă] [Alt plic]”.
- **Unde în cod:**
  - `android/.../BankNotificationListener.java` (un `NotificationListenerService` nou);
  - punte în `BugetFamilieNativePlugin.java`;
  - parsere în `client/src/lib/bank-notification-parse.ts`, cu fixture-uri de text real pe bancă;
  - coada în `ReviewCenterPanel`.
- **Atenție:** declarația Play pentru acces la notificări. Nimic nu pleacă de pe telefon. Trebuie adăugat în politică.

**5. „Notează” din notificare**
- **Problema:** notarea cere deschiderea aplicației.
- **Cum ar arăta:** la check-in-ul de seară (`local-notifications.ts:530`) apar acțiunile „+ 50”, „+ 100” și „Altă sumă”, cu răspuns direct (RemoteInput pe Android). Se salvează în ultimul plic folosit.
- **Unde:** `ReminderWorker.java`, `QuickActions.java`.

**6. Istoricul ciclurilor („Ați ajuns la salariu în plan în 5 din ultimele 6 cicluri”)**
- **Problema:** nu există nicio recompensă la finalul ciclului, deci nicio buclă de obicei.
- **Cum ar arăta:**
  - `startNextCycle` (`cycle-close.ts:146`) salvează `cycleOutcomes[]`: perioada, dacă ciclul a fost în plan sau nu, cât s-a pus deoparte și plicurile depășite.
  - Pe Astăzi, în ziua salariului: „Ciclul 6 încheiat în plan. Seria: 3 🟩🟩🟩”, fără sume.
  - Seria se rupe blând: „Un ciclu greu nu șterge restul.”
  - Aceleași date alimentează „Anul familiei” (ideea 12).
- **Gamificare sănătoasă:**
  - Se măsoară ajunsul la salariu și banii puși deoparte, niciodată numărul de deschideri.
  - Nu există clasamente.
  - Nu apar notificări de tipul „ai pierdut seria”.

**7. Împărțire între parteneri după o regulă**
- **Problema:** `settle-up.ts` împarte doar în părți egale („orice altă regulă ar fi o părere”, `settle-up.ts:10`). Cuplurile cu salarii diferite împart proporțional sau pe categorii.
- **Cum ar arăta:** `settings.splitRule: { mode: "equal" | "income" | "custom", shares: Record<memberId, number> }`.
  - Varianta „income” calculează procentele din `salaryPlan.incomes`.
  - Cardul spune: „Ana a plătit 1.240, partea ei e 42% din 2.600 = 1.092 → îi trimiți 148 RON”.
- **Unde:** `settle-up.ts:44` și `SettleUpCard.tsx`.

**8. Fond de siguranță calculat**
- **Problema:** Obiectivele sunt goale („Alege un obiectiv care contează”).
- **Cum ar arăta:** o propunere cu o singură atingere, „Fond de siguranță: 3 luni de obligații = 3 × {total fixe din Ce plătim lunar}”. Contribuția lunară vine din `savingsSuggestion`.
- **Unde:** `HabitsGoals.tsx` (starea goală) și `GoalForms.tsx`.

**9. Venituri tipice RO**
- **Cum ar arăta:** în pasul 1 și în „Adaugă un venit” apar butoanele „Alocația copilului”, „Pensie”, „Chirie încasată”, „Al 13-lea / prima de Crăciun” și „Tichete (încărcare lunară)”.
- **Comportament:**
  - Alocația are opțiunea „merge în plicul copilului” (`allowance.ts`).
  - Prima merge direct la plăți rare și obiective.
  - Tichetele primesc sursa „Bonuri de masă” și ziua încărcării.
- **Unde:** `NeedsQuickStart.tsx` și `MonthlyNeedsPanel.tsx`.

**10. Partener pe iPhone, ghidat**
- **Situația azi:** linkul de invitație deschide aplicația web (`family-invite.ts:12`), dar textul trimis (`family-invite.ts:45`) nu spune nimic pentru iPhone.
- **Cum ar arăta:**
  - Textul primește rândul „Pe iPhone: deschide în Safari → Distribuie → Adaugă pe ecranul principal”.
  - Pe iOS Safari, fără mod standalone, apare o bandă cu aceiași pași.
  - Pe iOS nu se promit notificări decât după instalarea pe ecranul principal.
- **Efort:** S, plus un test pe un iPhone real.

**11. Notare vocală**
- **Cum ar arăta:** un microfon în „Notează”. Recunoașterea de vorbire Android (on-device unde se poate) trimite textul la parserul local `understand.ts`, care deja înțelege „45 la Lidl pe card”.
- **Unde:** plugin Capacitor și `QuickEntryPanel.tsx`.

**12. „Ciclul nostru”, card partajabil**
- **Cum ar arăta:** o imagine PNG generată local, cu procente și fără sume („am ajuns la salariu cu plicurile în plan · mâncarea -8% față de luna trecută”), plus linkul din Play cu `referrer`.
- **Unde:** lângă `formatMonthlyReportShare` (`household-insights.ts:409`).
- **Momente de lansare:** 2–5 ianuarie („Anul familiei”).

**13. Lista de cumpărături legată de plic**
- **Cum ar arăta:**
  - Lista e comună și trece prin sync.
  - Estimarea vine din `price-history`: „Lista: ~240 RON · în săptămâna asta mai ai 310”.
  - La bifarea din magazin se propune cheltuiala.
- **Unde:** `ProductCatalogPanel`, sau un `ShoppingListPanel` nou care folosește catalogul.

**14. Anunț la scumpirea unui abonament**
- **Situația azi:** `recurringPriceChanges` există, dar se vede doar în aplicație.
- **Cum ar arăta:** o notificare locală o singură dată pe scumpire: „Netflix s-a scumpit: 49,99 → 59,99 (+120 RON/an)”.
- **Unde:** `local-notifications.ts`, în `buildAlerts`.

**Ce NU aș face acum:** open banking, reclame, produse financiare, altă temă sau o aplicație iOS nativă.

---

## 6. Monetizare și lansare în Play

### 6.1 Ce e gratuit și ce e plătit (ajustat față de MiM gratuit)

Principiul „eu gratuit, noi plătit” rămâne corect. Cu MiM gratuit, **planul Casa trebuie să fie generos**. Se plătește doar valoarea de cuplu și confortul.

| | Casa (gratuit) | Familia |
|---|---|---|
| Plicuri, ciclu, „Ce plătim lunar”, repartizare, notificări, widget, import CSV/Excel, OCR bon | Da (10 plicuri) | Nelimitat |
| **Al doilea venit în repartizare** | Doar propunerea (vezi cum s-ar împărți) | Se aplică. Trebuie adăugat `UpgradeReason: "income2"` în `entitlements.ts:15`. |
| Sync, al doilea telefon, membri, modul copil/bunic | – | Da (6 persoane) |
| Împărțire între parteneri după o regulă (ideea 7), transferuri propuse | – | Da |
| Captură din notificări | 1 aplicație bancară | Toate |
| Ghid online | **5 pe zi** (azi 20, `entitlements.ts:26`) | 100 pe zi |
| Istoricul ciclurilor, „Anul familiei”, PDF, inflația coșului | Rezumat | Complet |

### 6.2 Prețuri și probă
- **19,99 lei pe lună și 149 lei pe an** rămân în regulă ca preț de listă.
- **Preț de fondator de 99 lei pe an** pentru primii 1.000 de plătitori (ofertă Play „introductory price”, cu acces la oferte limitat la eligibili).
- **Proba:** 30 de zile, configurată în Play Console pe planul de bază, pornită **când se conectează al doilea telefon**. `TRIAL_DAYS` trebuie trecut la 30 în `entitlements.ts:37`, ca textele să spună adevărul.
- **Opțiune „pe viață”** la 349 lei, de testat din luna 4, cu date de churn.

### 6.3 ASO

**Titlu (30 de caractere):** `Buget Familie: plicuri salariu` (verificat: 30 de caractere)

**Descriere scurtă (80):**
- varianta A: `Buget pe salariu, pe plicuri. Cheltuieli, facturi, rate. Fără parola băncii.` (76);
- varianta B, pentru test A/B: `Salariul vine, aplicația îl împarte pe plicuri. Fără legătură cu banca.` (71).

**Descrierea lungă:**
- să înceapă cu „cât poți cheltui azi până la salariu”;
- să conțină natural de 4–6 ori „buget” și de 3–5 ori „cheltuieli”;
- să aibă o secțiune „Pentru cupluri” (două salarii, cine cui dă);
- să aibă o secțiune „Merge și pe iPhone, din browser”;
- **să nu conțină** „sync” și „criptat” în primele 3 rânduri.

**Capturi (8), cu navigația de acum:**
1. Astăzi: „Cât poți cheltui azi, până la salariu”.
2. Propunerea de repartizare: „A intrat salariul? Se împarte singur”.
3. Două salarii, zile diferite.
4. Plicuri, grupate pe Fixe, Variabile și Economii, cu banda S1–S5.
5. Plăți rare și calendarul impozitului.
6. „Cine cui dă”.
7. Import de extras de la BT, BCR, ING, Revolut sau Raiffeisen: „Fără parola băncii”.
8. Widgetul „Poți cheltui azi”.

`SCREENSHOTS.md` trebuie rescris (constatarea 7).

**Încredere pe listing:** domeniu propriu, email de contact pe domeniu, entitate (PFA/SRL) și o pagină „Cum vă protejăm datele” pe un singur ecran. Rămâne P0 de lansare, pentru că e nefăcut.

### 6.4 Metrici (fără a încălca confidențialitatea)
Contoare zilnice agregate, opt-in, fără ID și fără sume (constatarea 3), plus Play Console.

| Metrică | Țintă la 90 de zile |
|---|---|
| Pornire terminată, pe intenție | ≥ 70% |
| **Cifra zilei văzută în ziua 1** (după ideea 1) | ≥ 60% |
| Repartizare aplicată în 30 de zile | ≥ 30% |
| **Ciclu încheiat în plan (metrica principală)** | ≥ 20% din instalări |
| Al doilea telefon conectat | ≥ 15% din gospodăriile active |
| Pondere mișcări importate sau capturate față de cele manuale | în creștere, spre 40% |
| Probă → plată | 25–35% |
| Rating Play | ≥ 4,5 |
| ANR / crash-free | < 0,47% / ≥ 99,5% |

Pentru retenția D1/D7/D30 se folosesc statisticile Play Console („utilizatori activi” și „păstrare”). Nu e nevoie de ID propriu.

---

## 7. Ce ar lipsi ca să fie „cea mai bună aplicație de buget de familie din România”

1. **Valoare din prima zi, nu de la primul salariu** (constatarea 1).
2. **Cifre corecte pentru banii care doar se mută**: bancomat, conturi proprii, Revolut (constatarea 2).
3. **Captură aproape automată fără bancă**, din notificările băncii, ca răspuns la MiM.
4. **Cuplul ca cetățean de rangul întâi**:
   - împărțire proporțională;
   - partener pe iPhone;
   - „Mă alătur familiei” pe primul ecran;
   - recompensă comună la final de ciclu.
5. **O buclă de obicei pe ciclu**: istoricul și seria ciclurilor, „Anul familiei”.
6. **Încredere vizibilă**: domeniu, firmă, contact pe domeniu, recenzii.
7. **Măsurare minimă** înainte de Billing.
8. **Detalii românești** încă lipsă:
   - alocația copiilor;
   - pensia;
   - al 13-lea salariu;
   - IRCC;
   - facturi de utilități din PDF;
   - importuri BRD, CEC și UniCredit (azi merg doar prin coloanele generice).

---

## 8. Ce e deja foarte bine
- Repartizarea „Ce plătim lunar” pentru două salarii, cu tichetele excluse și anularea posibilă. Nimeni din piață nu o face.
- Pornirea în 3 pași cu șabloane: din pasul 2 lista e completă dintr-o atingere.
- Importul de extras pentru bănci RO: BT, BCR, ING, Raiffeisen și Revolut, cu `.xlsx`, Windows-1250 și numele magazinului curățat.
- Abonamentele detectate cu scumpiri, raportul lunii pe WhatsApp și inflația coșului, toate din date locale.
- Notificările de ritm, de zi de salariu și de scadență, plus widgetul cu cifra zilei.
- Poziționarea „fără parola băncii”, dublată de o arhitectură care o respectă (pachet criptat, OCR local).

---

**Surse web (26.09.2026):**
- MiM, open banking pentru toate băncile RO și Revolut (Finqware), familie, 120k+ descărcări: https://www.piatafinanciara.ro/money-in-motion-devine-prima-aplicatie-mobila-care-integreaza-open-banking-pentru-toate-bancile-din-romania-si-revolut-in-parteneriat-cu-finqware/ și https://iancuguda.ro/mim/
- Revolut, buget lunar cu limită pe zi și conturi comune în RO: https://www.revolut.com/en-RO/best-budget-planner și https://www.revolut.com/en-RO/joint-accounts/
- Celelalte prețuri de concurență (YNAB, Goodbudget, Wallet, Spendee, Monefy) sunt preluate din raportul din 25.09 și nu le-am reverificat azi.
