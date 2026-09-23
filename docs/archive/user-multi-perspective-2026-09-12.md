# Evaluare multi-perspectivă + research piață — Buget Familie

**Data:** 12 septembrie 2026  
**Baseline produs:** `main` @ `fb2aa25` (PWA Pages + APK eventual; local-first; sync parolă familie; plicuri + ritm; CSV RO; De verificat; App Check ready; abonamente **nu** live)  
**Metodă:** **nu** este un sondaj cu utilizatori reali. Este o **evaluare multi-perspectivă** (persona-uri sintetice care „încearcă” produsul 30–90s pe Pages/APK) + research piață 2024–2026 (Wallet, Spendee, Monefy, YNAB, Honeydue, comunități RO / r/roFrugal) + audituri interne (`research-deep-2026-09-12.md`, `PRODUCT_STRATEGY.md`, `PLAY_LISTING.md`, `audit-dual-lens-2026-09-12.md`, UX Astăzi / Sync / onboarding din cod).

**Constrângeri pe care le respectă produsul (și pe care persona-urile le simt):** fără bank scraping, fără Notification Listener, fără Play Billing live; date pe telefon; sync opțional AES-GCM cu parolă ≥12.

---

## Persona-uri (8)

### 1. Cuplu tânăr (Andrei & Ioana, 28–32, București)

**Cine e:** Amândoi lucrează, împart chiria și cumpărăturile, vor „să știm amândoi cât putem cheltui la weekend” fără să-și dea parolele de la bancă.

**30s pe app:** Deschid Pages/APK → tur Calm → „Sari peste” (FirstRun rămâne) → intenție Familie → plicuri sugerate. Caută Sync: e în **Mai mult → Sync** (tab îngropat). Generatorul de parolă există; pe telefonul 2 trebuie aceeași frază ≥12.

**Ce găsesc greșit**
- Sync-ul de familie (motivul „Familie”) stă la 2+ atingeri în sertarul Mai mult (~12–13 taburi).
- Pe Astăzi încă pot apărea mai multe sume / mesaje (hero + brief + ledger); „cât putem cheltui la Lidl?” cere un răspuns unic — foaia „De ce poți folosi X?” există, dar trebuie descoperită.
- Coada **De verificat** (bon/CSV) și pozele **nu** se sincronizează complet: partenerul vede meta/rezumat, nu pozele; confirmarea rămâne pe telefonul care a creat propunerea — ușor de interpretat greșit ca „nu merge sync-ul”.
- Conflict onest pe sumă plic e bine; pe aceeași mișcare editări simultane rămân last-write-wins pe document — cuplul nu înțelege de ce „a dispărut nota mea”.

**Ce sugerează**
- După intenția Familie: deschide Sync + arată parola o dată + listă scurtă „ce se sincronizează / ce nu”.
- Feed familie pe Astăzi (cine a mișcat) fără să caute în Analiză → Gospodărie.
- Banner De verificat pe Astăzi + pe dock (deja există semnale; trebuie imposibil de ratat după bon).

**Ce și-ar mai dori**
- Comentarii pe o cheltuială (pattern Honeydue), fără conturi sociale.
- Notificare locală „partenerul a înregistrat X” (fără listener bancă).
- Roluri simple: doar vedere vs editare pe anumite surse (pattern Wallet group sharing).

---

### 2. Familie cu copii (Mihai & Elena, 35–42, Cluj)

**Cine e:** Două salarii, rate, școală, activități; vor ciclu până la salariu, nu lună calendaristică; un copil are „buzunar”.

**30s pe app:** Ajung pe Plan: plicuri pe membru/sursă, stări în plan / aproape / depășit, **ritm în avans / în ritm / în urmă**. Buzunar apare în Mai mult dacă există membru tip copil. Obligații + scadențe există, dar sunt împrăștiate față de „ce plătim săptămâna asta”.

**Ce găsesc greșit**
- Densitate: pe 360px, Astăzi cere scroll înainte de activitate; dock-ul e clar, Mai mult e aglomerat.
- Plicul e **limită**, nu sold — familia încearcă să „mute bani” ca în Excel/Goodbudget; explicația e în glosar / `+`, nu pe primul tap.
- Importul CSV bancă (BCR/BT/ING/Revolut) stă la De verificat / Mai mult, nu în Mișcări — „unde e Import?”.
- Widget-ul (APK) fără sume e bun pentru privacy pe ecranul de acasă; până nu e QA pe telefon (PLAY_CHECKLIST), rămâne promisiune.

**Ce sugerează**
- Un card „Ce urmează 7 zile” pe Astăzi (scadențe + plicuri aproape).
- Check-in săptămânal cu un headline de decizie (datele există; propoziția sus e ce lipsește uneori).
- CSV din Mișcări: „Adu extrasul băncii”.

**Ce și-ar mai dori**
- Împărțire bon pe linii → plicuri diferite (mâncare vs casă) — OCR/linii există, fluxul trebuie să rămână confirmabil.
- Obiective pe an (vacanță, școală) cu progres vizibil.
- Reminder-e locale pe facturi (WorkManager) — fără SMS parsing.

---

### 3. Părinte solo (Ana, 34, Iași)

**Cine e:** Un venit, multe obligații, timp scurt; vrea un număr și o cheltuială rapidă.

**30s pe app:** Intenție „doar pe ce se duc banii” → QuickEntry. Primul tap lazy poate arăta „Pregătim…” o clipă. Hero „Poți folosi azi” + SafeSpendSheet o ajută; fără sold de sursă la start, Astăzi poate arăta 0 / plicuri neconfigurate.

**Ce găsesc greșit**
- Onboarding: intenția track cere nume apoi cheltuială, fără sold sursă → prima cifră e confuză.
- Prea multe instrumente pentru cine vrea doar jurnal + un plic „Mâncare”.
- EN pe unele ecrane adânci / texte fără `t()` pe Home — pentru utilizator RO e „app neterminată”.

**Ce sugerează**
- După prima cheltuială: prompt „Adaugă cât ai acum pe card/cash” (1 câmp).
- Un singur număr + un buton de captură deasupra fold (strategie + dual-lens).
- Empty-state-uri scurte pe Obligații/bonuri.

**Ce și-ar mai dori**
- Widget Cheltuială cu 2–3 șabloane (APK).
- Export PDF simplu pentru „bilanțul lunii” de trimis părinților / contabilului informal.
- PIN local ușor de activat din primul ecran de încredere.

---

### 4. Utilizator Monefy (Radu, 29, Timișoara)

**Cine e:** Folosește Monefy de ani; apreciază 3 atingeri, widget, sync Drive/Dropbox, Pro o dată. Vine din r/roFrugal: „manual e mai conștient”.

**30s pe app:** Compară viteza: după ce foaia QuickEntry e deschisă, e competitiv; până atunci, lazy + model plicuri/surse e „prea mult față de Monefy”. Caută sync Drive — găsește **parolă de familie**, nu Google Drive. Asta e diferit, nu neapărat rău.

**Ce găsesc greșit**
- Curba de învățare: plic ≠ sursă ≠ categorie.
- Fără bank sync (intenționat) — ok pentru el; dar așteaptă backup „în Drive-ul meu” ca la Monefy.
- Export CSV: dacă încă apare id de plic în loc de etichetă în unele exporturi, pierde încrederea Excel.

**Ce sugerează**
- Mod „doar jurnal” (ascunde plicuri până activezi Plan).
- Backup export/import + Share nativ ca default clar; „Drive” ca instrucțiune „salvează fișierul unde vrei”.
- Șabloane pe widget = feature #1 pentru retenție tip Monefy.

**Ce și-ar mai dori**
- Achiziție unică Pro (ca Money Manager / Monefy), nu doar abonament — când monetizarea trăiește.
- Multi-device fără „cameră familie” dacă e singur (același sync cu o parolă pe 2 telefoane e ok dacă e explicat).
- Grafice minimale, nu atelier editorial.

---

### 5. Skeptic privacy (Cristina, 41, Brașov)

**Cine e:** Nu dă parola de la bancă niciunei app; a citit plângeri Wallet/Honeydue despre sync bancar stricat și reclame; vrea local + criptare.

**30s pe app:** Citește listing: „fără bancă, sync criptat”. Verifică Setări → Încredere (politică, ștergere). Sync: parola nu e persistată — bine; cine știe parola poate update camera — acceptă dacă e explicat. Widget fără sume — apreciat.

**Ce găsesc greșit**
- Prima deschidere: lipsește o frază mare de încredere *înainte* de tur („Date pe telefon. Sync opțional. Fără login bancar.”).
- Firebase + App Check „ready” dar Enforce oprit — corect tehnic; pe Pages, utilizatorul tehnic întreabă „ce pleacă în cloud când conectez Sync?”.
- AI companion / asistent: dacă e online, trebuie opt-in clar; altfel sparge promisiunea local-first.

**Ce sugerează**
- Trust line în onboarding + listă „ce nu se sincronizează” vizibilă în Sync (deja parțial în UI Sync).
- Fără reclame pe ecrane financiare (aliniat PRODUCT_STRATEGY) — diferențiator vs Honeydue.
- Data safety Play aliniat 1:1 cu realitatea (allowBackup=false etc.).

**Ce și-ar mai dori**
- Export total + ștergere locală demonstrată.
- Opțiune „doar offline” care ascunde Sync.
- Audit public scurt: ce e în pachetul criptat.

---

### 6. Power user Excel (Vlad, 38, remote)

**Cine e:** Ține Google Sheets; vrea CSV RO, dedupe, etichete, ciclu salarial, reconciliere. Testează import BCR/BT/ING/Revolut → De verificat.

**30s pe app:** Fluxul bon/CSV → review → registru e **corect** și rar la concurență. Caută export cu etichetă plic, search jurnal, comparare cicluri în Analiză.

**Ce găsesc greșit**
- CSV îngropat în Mai mult / De verificat.
- Dacă exportul jurnal scrie id plic, Sheets-ul lui moare.
- Hydrate LS↔IDB: există risc istoric de cursă; QuotaExceeded pe LS are acum `safeSetItem` + UI recuperare — bine, dar pe PWA cu multe bonuri/poze tot poate simți limite.
- LWW pe document sync vs conflict doar pe sumă plic — pentru el e „bug de merge”.

**Ce sugerează**
- Import/export din Mișcări; CSV cu etichetă plic (P1 din research-deep).
- Reguli comerciant locale („LIDL → Alimente”) editabile, tot prin De verificat (nu auto-silent).
- Journal search + filtre salvabile pe primul plan.

**Ce și-ar mai dori**
- Split pe linii de bon + reguli.
- OFX pe lângă CSV (mai târziu).
- API/export programatic — low priority; CSV bun e suficient.

---

### 7. Bunici / puțin tech (Ion & Maria, 64–68)

**Cine e:** Smartphone mediu; vor litere mari, puține butoane, limba română; nepoții le-au instalat APK/PWA.

**30s pe app:** Turul Calm e frumos dar abstract. „Plic”, „reper”, „sursă” îi blochează fără glosar pe primul ecran. Mai mult cu swipe „Glisează pentru mai multe” e greu. Contrast pe teme dark (Aurora/Navy/Cyber) a fost pe lista de audit; Alb Atelier e mai sigur.

**Ce găsesc greșit**
- Vocabular de atelier înainte de date.
- Prea multe taburi în Mai mult.
- Skip tur vs setup: skip-ul turului **nu** mai omoară FirstRun (fix pe main) — bine; tot trebuie „Mai târziu” foarte vizibil.
- Captură rapidă: dacă primul tap e lent, abandon.

**Ce sugerează**
- Mod „Simplu”: Astăzi + Adaugă + Plan (3 ecrane).
- Glosar „Pe scurt” la prima apariție a cuvântului plic.
- Ținte ≥48dp peste tot (filtre Mișcări au fost semnalate mici).

**Ce și-ar mai dori**
- Font mai mare / contrast ridicat default.
- Un singur membru, fără Sync.
- Ajutor telefonic / video 1 minut, nu AI.

---

### 8. Freelancer venituri neregulate (Diana, 31, Cluj / proiecte)

**Cine e:** Facturi la 2–6 săptămâni, cashflow spart; vrea „până la următorul venit”, nu 1–31. Uneori EUR + RON.

**30s pe app:** Ciclu salarial + payday track + SafeSpendSheet = **potrivire puternică** vs app-uri pe lună calendar. Surse multiple (card, cash, Revolut). Multi-currency e slab față de Spendee — așteptare realistă: app e pe lei.

**Ce găsesc greșit**
- „Venit înregistrat luna asta” pe calendar vs ciclu (semnalat în audit) — o derutează.
- Fără bank scraping: ok, dar vrea CSV Revolut + reminder pe factură client (nu e în scope).
- Abonamente detectate one-tap fără confirmare bogată — risc să creeze scadențe greșite (research P0-4).

**Ce sugerează**
- Tot UI pe ciclu, nu pe `YYYY-MM`, pe Astăzi.
- Confirmare la detecție recurentă cu previzualizare.
- Plic „Taxe / buffer” sugerat la onboarding freelancer.

**Ce și-ar mai dori**
- Proiecție 2–3 venituri viitoare (manual).
- Separare PFA vs personal (surse + plicuri).
- Când monetizarea există: Premium pe sync + OCR + rapoarte, nu pe jurnalul de bază.

---

## Top 10 probleme comune (frecvență × gravitate)

Scor relativ pe baza overlap persona + audit + pattern-uri piață (nu din survey).

| # | Problemă | De ce doare | F × G |
|---|---|---|---|
| 1 | **Mai multe sume / mesaje pe Astăzi** — „cât pot cheltui?” are încă concurență pe ecran | Toate persona-urile de decizie zilnică | ★★★★★ |
| 2 | **Sync familie îngropat în Mai mult** | Cuplu / familie = job-to-be-done principal | ★★★★★ |
| 3 | **De verificat / CSV greu de găsit** (nu în Mișcări) | Power user + familie cu extrase RO | ★★★★☆ |
| 4 | **Plic = limită, nu sold** — model corect, UI târziu | Familie, Excel, bunici | ★★★★☆ |
| 5 | **Așteptări sync „totul e comun”** vs realitate (poze, coadă confirmare, șabloane) | Cuplu tip Honeydue | ★★★★☆ |
| 6 | **Captură: primul tap lazy / widget neconfirmat pe device** | Monefy-switchers, părinte solo | ★★★★☆ |
| 7 | **Onboarding fără frază de încredere + intenție track fără sold** | Skeptic + utilizator nou | ★★★☆☆ |
| 8 | **Densitate Mai mult (~13 taburi) + scroll Astăzi** | Bunici, mobil mid-range | ★★★☆☆ |
| 9 | **Riscuri stocare** (istoric LS↔IDB; QuotaExceeded — atenuat cu `safeSetItem` + UI) | Power user cu bonuri | ★★★☆☆ |
| 10 | **EN / texte fără i18n pe zone adânci** | Utilizator RO „app neterminată” | ★★☆☆☆ |

**Notă piață:** plângerile YNAB/Wallet/Honeydue pe **bank sync stricat**, **preț abonament**, **reclame** — Buget Familie le evită intenționat. Nu le transforma în gap-uri false; gap-ul local e claritate + discoverability + viteză manuală.

---

## Top 10 dorințe / features cerute

| # | Dorință | Surse (persona + piață) | Potrivire produs |
|---|---|---|---|
| 1 | **Un număr + o acțiune + captură** pe Astăzi | Toți; Spendee daily budget; YNAB Available | Parțial livrat (hero + SafeSpendSheet) — de colapsat restul |
| 2 | **Sync familie găsibil + explicat** (parolă, ce nu se sync) | Cuplu; Honeydue/Spendee shared | Există crypto; UX de pairing lipsește din first run |
| 3 | **Feed „cine a plătit” pe Astăzi** | Cuplu; Honeydue activity | Activitate 3 pe Astăzi; feed bogat în Gospodărie |
| 4 | **Import CSV din Mișcări + etichetă plic la export** | Excel; RO banks | CSV RO + review există |
| 5 | **Widget + șabloane rapide (APK)** | Monefy | Widget fără sume există; QA + șabloane |
| 6 | **Ritm plic vs calendar** (în avans / în ritm / în urmă) | Familie; YNAB/Goodbudget | **Livrat** pe Plan/TodayLedger — păstrează |
| 7 | **Confirmare la detecții / OCR** (nimic silent în registru) | Privacy; Monarch review | De verificat = diferențiator; confirmare recurente de întărit |
| 8 | **Check-in săptămânal cu headline** | Familie; research-deep | Check-in există; digest headline |
| 9 | **Fără ads / fără paywall pe datele deja introduse** | Skeptic; anti-YNAB price rage | Strategie freemium — Billing încă afară |
| 10 | **Mod simplu / glosar pe scurt** | Bunici; PRODUCT_STRATEGY | Glosar în Ghid; nu pe first paint |

**Explicit nu cerem acum (OUT):** Open Banking PSD2, Notification Listener, Play Billing live, AI cloud inventat.

---

## Ce e deja apreciat (nu strica)

1. **Local-first + fără login bancar** — diferențiator real vs Wallet/Spendee/Honeydue când sync-ul bancar e plin de furie pe review-uri.
2. **Plicuri pe ciclu salarial** (nu doar 1–31) + **SafeSpendSheet** („De ce poți folosi X”) + ritm plic.
3. **De verificat** (bon → review → registru; CSV RO cu dedupe) — încredere > viteză oarbă.
4. **Sync AES-GCM cu parolă de familie**, generator frază, listă „ce nu se sincronizează”, conflict pe sumă plic (nu LWW tăcut pe bani).
5. **Widget fără sume** + PIN local + politică/ștergere pe Pages.
6. **Română / lei**, surse card·cash·bonuri de masă, El/Ea pe mișcări.
7. **Dock 5 taburi** (Astăzi / Mișcări / Plan / Obligații / Analiză) — clar; Mai mult ca sertar e ok dacă esențialul iese afară.
8. **Abonamente amânate** — corect: nu plăti înainte ca Astăzi + Sync + captură să fie „imposibil de greșit”.
9. **App Check ready, Enforce oprit** — nu bloca utilizatorii Pages prematur.
10. **Fix QuotaExceeded (`safeSetItem` + UI recuperare)** și **skip tur ≠ skip setup** — semnale că feedback-ul tehnic se închide.

---

## Recomandare: fix vs feature vs monetizare timing

### A) Fix acum (înainte de feature noi și înainte de paywall)

Ordine sugerată (impact × risc):

1. **Colapsează Astăzi** la 1 cifră de decizie + 1 next step + captură; restul în „Cum se citește?” / SafeSpendSheet.  
2. **Discoverability Sync + De verificat + CSV** (FirstRun Familie → Sync; Mișcări → „Adu extrasul”; badge inevitabil).  
3. **Mesaj trust** la prima deschidere + „ce nu se sync” la pairing.  
4. **Confirmare detecție abonament/recurent** cu previzualizare.  
5. **CSV export cu etichetă plic**; UI pe ciclu peste tot pe Astăzi.  
6. **QA nativ PLAY_CHECKLIST** (widget, dală, pairing, conflict) — fără asta, APK-ul e teoretic.  
7. Continuă harden stocare (IDB primar, merge `updatedAt`) — QuotaExceeded e atenuat, cursa hydrate rămâne pe radar.  
8. Polish a11y: ținte ≥48dp, contrast teme dark, i18n resturi.

### B) Feature (după fix-urile de claritate)

- Feed familie pe Astăzi; digest săptămânal cu headline.  
- Șabloane pe widget; reguli comerciant locale → tot prin De verificat.  
- Împărțire linii bon pe plicuri (consolidare OCR existent).  
- Mod Simplu / „doar jurnal”.  
- Reminder-e locale pe scadențe (fără SMS).

### C) Monetizare — **nu acum**

**Timing:** după ce (1) Astăzi e clar, (2) Sync e găsibil și înțeles, (3) captura pe APK e măsurată pe telefon, (4) listing Play + Data safety sunt aliniate.

**Model (din PRODUCT_STRATEGY, încă valid):** freemium **fără ads pe ecrane financiare**. Gratuit: jurnal, plicuri de bază, un plan, export simplu, datele rămân accesibile la downgrade. Premium (când Billing trăiește): sync familie, OCR avansat, rapoarte, backup automat, teme extra, planuri multiple.

**De ce nu acum:** piața e sensibilă la preț (YNAB) și la sync stricat; Buget Familie câștigă pe **încredere**. Un paywall pe Sync înainte ca pairing-ul să fie evident = review-uri 1★ pe „nu găsesc familia”. Un paywall pe jurnal = contradictorie cu local-first.

**Semnal de „gata de monetizat”:** ≥N cupluri reale cu Sync stabil 14 zile; time-to-first-expense <30s pe mid-range; De verificat folosit fără suport; zero incidente „am pierdut datele” pe quota/hydrate.

---

## Anexă — research piață (2024–2026), pe scurt

| App | Ce cer / se plâng utilizatorii | Lecție pentru Buget Familie |
|---|---|---|
| **YNAB** | Preț mare; bank sync fragil; learning curve; mobile limitat; privacy pe planuri shared | Nu copia prețul; păstrează plicuri + available explicat; offline/local e avantaj |
| **Spendee** | Shared wallets bune; free tier restrictiv; bug-uri card/credit/currency | Familie fără bancă; UX shared clar |
| **Wallet** | Group sharing Premium; bank sync lung „mort” pe review-uri | Evitarea scraping = poziționare, nu lipsă |
| **Monefy** | Viteză manuală, widget, sync Drive, preț mic o dată | Competitor pe viteză; BF trebuie 2–3 tap-uri după open |
| **Honeydue** | Cuplu + privacy granular; sync bancar lent/greșit; ads; certuri din notificări false | Feed + privacy fără ads; confirmare înainte de „alertă partener” |
| **RO (r/roFrugal etc.)** | Spendee / Monefy / Money Manager / Wallet; mulți preferă manual; bănci = George/ING/Revolut analytics | CSV RO + lei + română; nu concura cu banca pe extrase live |

---

## Disclaimer final

Acest document este **evaluare multi-perspectivă + research piață**, nu rezultatul unui studiu cu utilizatori recrutați. Persona-urile sunt sintetice, ancorate în capacitățile reale ale aplicației la data de mai sus. Pentru validare: 5–8 interviuri scurte (cuplu, familie cu copii, Monefy-switcher, skeptic privacy) pe build-ul Play closed testing.
