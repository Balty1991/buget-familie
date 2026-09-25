# Buget Familie: raport unificat de la 6 agenți de testare

**Data:** 25.09.2026 · **Versiune:** 1.1.96 (commit `867bb12`) · **Nimic nu a fost modificat în aplicație în timpul testării.**

Raportul adună ce au găsit 6 agenți, fiecare cu alt rol:

| Rol | Ce a făcut | Raport detaliat |
|---|---|---|
| Utilizator obișnuit | Un părinte cu 2 salarii, tichete, grădiniță și o rată. A trăit un ciclu întreg, de la instalare la o săptămână de cheltuieli. | [user-report.md](./user-report.md) |
| Tester QA | Cazuri-limită, anulări, sfârșit de lună, 5 teme, 360 și 1280 px, axe | [qa-report.md](./qa-report.md) |
| Dezvoltator senior | Arhitectură, sincronizare, bani, date, teste, Android, build | [dev-report.md](./dev-report.md) |
| Securitate și performanță | Criptare, reguli Firebase, AI, politică și Data safety, viteză cu 5.000 de mișcări | [secperf-report.md](./secperf-report.md) |
| Designer UI/UX | 146 de capturi, 3 teme, mobil și desktop: meniu, grafică, teme, animații, grafice | [design-report.md](./design-report.md) |
| Strateg de produs | Concurență în România, funcții noi, monetizare, lansare Play | [product-report.md](./product-report.md) |

---

## 1. Pe scurt

**Ce e bun, după toți cei 6:** ideea e rară și potrivită pentru România. Plicurile merg pe ciclul de salariu, iar „Ce plătim lunar” împarte singur două salarii venite în zile diferite. Mai sunt plățile rare, tichetele, „cine plătește” și faptul că nu cere login bancar. Pornirea în 3 pași primește 8/10. Propunerea de împărțire a salariului e clară și liniștitoare. „Notează” alege aproape mereu plicul corect. Cele 1.051 de teste, TypeScript și lint trec, iar criptarea de bază e corectă.

**Unde sunt problemele, în ordinea gravității:**

1. **Sincronizarea de familie are defecte de fond.**
   - Se oprește de tot după ~2.000–3.000 de mișcări, cam 1–2 ani de folosire.
   - Ștergerile nu se propagă pentru plicuri, venituri, „Ce plătim lunar” și membri.
   - Editările normale apar drept „conflict” la partener.
   - Anulările se pot pierde.
2. **Conformitate Play.** Politica de confidențialitate și Data safety nu spun tot ce pleacă la ghidul AI online. Nu apar Groq (SUA), textul bonurilor, numele membrilor și ultimele 20 de mesaje. Ecranul „Telefonul lui X” contrazice mențiunea „nu e pentru copii”.
3. **Cifre greșite sau contradictorii, care strică încrederea.**
   - Facturile plătite exact apar „DEPĂȘIT” sau „aproape de limită”.
   - „Cât pot cheltui azi” are 4 valori diferite pe ecrane diferite.
   - „Cât ai acum pe card” dublează banii.
   - Anularea primei repartizări șterge toate plicurile.
4. **Prea mult și prea greu de parcurs.** Plan are 8.000–12.000 px (10–16 ecrane). Există un bug de font, jargon peste tot („tranșă”, „S2”, „ritm”, „reper”), iar pe desktop apar două meniuri.
5. **Viteză cu multe date.** Cu 5.000 de mișcări, pe un telefon slab, Astăzi durează ~2 s la fiecare intrare, iar pornirea ~10 s până răspunde. Cauza principală e simplă: o funcție de dată apelată de mii de ori.

**Notele date:**
- Utilizator: 5,5/10. Nucleul e de 8/10, iar după reparații poate ajunge ușor la 8,5.
- Designer: C+ (6/10).
- Dezvoltator: „solidă pe un telefon, nu e gata cu sincronizarea activă”.

---

## 2. P0: de reparat înainte de lansarea în Play

| # | Problemă | Găsit de | Unde (fișier) | Efort |
|---|---|---|---|---|
| P0-1 | **Politica și Data safety sunt inexacte** despre ghidul online. Nu apar: Groq (SUA) ca rezervă, textul OCR al bonului (până la 5.000 de caractere, poate conține cifre de card), numele membrilor și veniturile pe persoană, ultimele 20 de mesaje, reCAPTCHA, copiile automate în Descărcări (rămân după dezinstalare). Mai sunt: `SCHEDULE_EXACT_ALARM` și Umami, care nu mai există; pozele declarate „colectate” deși nu pleacă; `dataExtractionRules`. | Securitate | `client/public/privacy.html` (+ copia din `android/.../assets`), `docs/PLAY_CONSOLE_DATA_SAFETY.md`, `functions/src/index.ts`, `understand.ts:1166` | S |
| P0-2 | **„Telefonul lui X”**: se iese fără PIN, pe telefon rămân cheia și tot registrul, „Notează” arată toate sursele și plicurile familiei, iar după ieșire telefonul rămâne înregistrat pe copil (cheltuielile părintelui ajung pe Ana). Ecranul arată „0 RON” când persoana nu are plic. Declarația despre copii din politică contrazice modul. | QA BF-06, Securitate R7, Utilizator #14 | `MemberModeScreen.tsx`, `MemberModeSetup.tsx`, `member-mode.ts`, `app-lock.ts` | S |
| P0-3 | **Pachetul de sync depășește 1 MiB** (limita unui document Firestore) la ~2.100–3.100 de mișcări. De acolo sync-ul eșuează permanent, cu un mesaj generic. Regula `< 2000000` nu protejează nimic. | Dezvoltator #1, Securitate R1 | `family-crypto.ts:57-87`, `realtime-sync.ts:152`, `firestore.auth.rules` | M: compresie gzip + verificare de mărime + mesaj clar. L: documente pe lună |
| P0-4 | **Ștergerile nu se sincronizează** pentru plicuri, transferuri, reguli, aplicări de salariu, „Ce plătim lunar”, venituri, evenimente, membri și categorii. Tot ce ștergi reapare la prima unire. | Dezvoltator #2 | `finance-data.ts:134` (`DeletedRecord`), `family-crypto.ts:202-248, 363-385` | M |
| P0-5 | **Merge doar între două copii:** o editare făcută doar pe telefonul A apare drept „conflict” pe B, iar B își păstrează valoarea veche. | Dezvoltator #3 | `family-crypto.ts:218-231, 286-306` | M (merge în 3 căi, sub flag) |
| P0-6 | **Anularea repartizării salariului:** (a) anularea primei, după ce ai aplicat-o pe a doua, **șterge toate plicurile ciclului**; (b) cu sync se poate aplica de două ori și scade sumele de două ori; (c) pune la loc suma absolută, deci pierde editările făcute între timp. | QA BF-01, Dezvoltator #5-#6 | `finance-data.ts:714-735`, `monthly-needs.ts` | S–M |
| P0-7 | **„Anulează” după o ștergere se pierde** dacă ștergerea a fost deja trimisă: rândul dispare din nou. | Dezvoltator #4 | `undo-delete.ts:32-61` | S (`updatedAt = now` la restaurare) |
| P0-8 | **Limita ghidului AI se poate ocoli:** App Check e opțional, contul anonim e gratuit, cererea trece dacă Firestore cade, iar IP-ul e luat din `X-Forwarded-For`. Rezultat: cheia Gemini/Groq, comună tuturor, poate fi consumată până la epuizare. | Securitate R2, Dezvoltator #21 | `functions/src/index.ts` (`takeQuota`, `appCheckTrusted`) | S |

---

## 3. P1: cifre greșite și bug-uri mari (încrederea utilizatorului)

| # | Problemă | Găsit de | Unde |
|---|---|---|---|
| P1-1 | **Factura plătită exact înseamnă alarmă falsă.** Rata 1.400/1.400 dă „APROAPE DE LIMITĂ” zile întregi și „DEPĂȘIT · 25% AȘTEPTAT”. Bilanțul arată „1.094 lei peste plan”, iar la Lumină apare „cel mult 0,25 RON pe zi”. Plicurile de facturi sunt judecate după ritm, ca mâncarea. | Utilizator #1, Designer 2.3 | `household-insights.ts` (`weeklyCheckIn`, `envelopeBurnPace`, `envelopeRunOut`), `finance-data.ts` (`envelopeDecisionStatus`) |
| P1-2 | **4 cifre diferite pentru „cât pot cheltui azi”**: Astăzi 80 sau 35,50, Plan 68,57, ghid 85,71 și 352,84/zi. Ghidul „ceartă” pentru că media include rata și grădinița. „Pe zi” se calculează cu 5 reguli de rotunjire diferite. | Utilizator #3, Designer #3, Dezvoltator 2.2 | `household-insights.ts:512,527`, `allowance.ts:97`, `calendar-budget.ts:92`, `analyst.ts:408` |
| P1-3 | **„Cât ai acum pe card?” dublează banii.** Suma e salvată ca sold inițial, iar pe Astăzi mai e un card care întreabă același lucru. | Utilizator #2 | cardurile „SOLD REAL” / reconciliere pe Astăzi |
| P1-4 | **Plic cheltuit exact până la ultimul ban apare „depășit”** (eroare de rotunjire float): 126,33 + 155,77 + 83,18 din 365,28. | Dezvoltator #7 | `finance-data.ts:876-895` |
| P1-5 | **Ciclul pornit la mijlocul lunii se întinde pe 6,5 săptămâni:** instalare pe 25, salariu declarat pe 10, rezultă „600 × 6 săpt. + 5 zile = 4.029”. | Utilizator #4 | `monthly-needs.ts` (`nextPaydayAfter`, pragul de 20 de zile) |
| P1-6 | **Salarii pe 1 și pe 25** sunt tratate ca două cicluri. Al doilea propune din nou chiria, iar Mâncarea scade de la 1.100 la 100. | QA BF-02 | `monthly-needs.ts:28` (`CYCLE_WINDOW_DAYS`) |
| P1-7 | **În ziua salariului:** salariul notat intră în ciclul care se încheie, iar Astăzi arată „Poți folosi azi 5.200 RON”. | QA BF-04 | `finance-data.ts:857` (`inPlanPeriod`), `todayBrief` |
| P1-8 | **Repartizarea care deschide un ciclu nou păstrează mutările din ciclul vechi**, între plicuri și între săptămâni. | QA BF-05 | `monthly-needs.ts` (obiectul `cycle`), față de `cycle-close.ts:175` |
| P1-9 | **Cu planul depășit, ghidul spune „Poți folosi azi 4.457 RON”**, adică deficitul. | QA BF-03 | `analyst.ts` (`answerPace`) |
| P1-10 | **„Ce plătim lunar” și Obligații nu se văd una pe alta.** Rata declarată nu apare în Obligații („Nu ai datorii”). | Utilizator #6 | `ObjectivesView`, `monthly-needs` |
| P1-11 | **După pornire, Astăzi cere exact ce ai făcut deja** („Fă primul plic”, „Spune când vine salariul”, „Ciclul se închide”). Butonul „Notează” lipsește până la prima mișcare. | Utilizator #5, #11 | `TodayView`, `TodayBrief` |
| P1-12 | **Performanță:** `isoToday()` creează un formatter de dată la fiecare apel, de 90–180× mai lent, și e apelat în bucle. Calculele de pe Astăzi și Plan nu sunt memorate. Cu 5.000 de mișcări: TBT 7 s, Astăzi ~2 s la fiecare intrare. | Securitate §4, Dezvoltator §5 | `finance-data.ts:238`, `TodayView`, `PlanStudio` (0 `useMemo`), `allocationWeeksStatus` |

---

## 4. P2: bug-uri medii și mici

**Bani și plicuri**
- Două cheltuieli lunare cu același nume se suprascriu într-un singur plic (QA BF-07).
- La trecerea unei cheltuieli din săptămânal în lunar, plicul rămâne pe tranșe săptămânale (QA BF-08).
- O cheltuială fără plic, dintr-o categorie comună (Lumină și Apă pe „Casă & facturi”), e scăzută din ambele plicuri (QA BF-12).
- Regula „cheltuiala aparține plicului” are 4 copii care se contrazic (Dezvoltator 2.2).
- `Home.tsx:191` mută în plicuri și cheltuielile marcate explicit „În afara plicurilor”, la fiecare randare (Dezvoltator #10).
- Tichetele și cash-ul pornesc de la 0 și ajung pe minus. Cumpărătura cu tichete consumă plicul de Mâncare finanțat din salariu (Utilizator #10).
- Venitul declarat pe 31 are o dată invalidă în lunile scurte („3 martie”) (QA BF-13).
- Reportul săptămânal nu se vede în lista S1…S5 (Utilizator #19).
- „IEȘIT −0,00 RON” (QA BF-18).

**Sync și date**
- Data salariului se poate pierde la editări offline: planul are un singur `updatedAt` (Dezvoltator #8).
- Cursurile valutare sunt doar locale, deci partenerii văd solduri diferite (Dezvoltator #9).
- Ceasul telefonului decide conflictele (Dezvoltator #15).
- `setDoc` nu are precondiție (Dezvoltator #14).
- Camerele vechi cu parolă au ID = SHA-256 nesărat al parolei, deci parola se poate ghici rapid (Securitate R4, Dezvoltator #13).
- Regulile Firestore nu leagă scrierile de membri: oricine are un cont anonim poate crea documente (Securitate R3).
- Aplicația web stă pe originea comună `balty1991.github.io`, pe care o pot citi și alte site-uri Pages ale contului (Securitate R6).

**Import și ghid**
- La import, două mișcări cu aceeași dată și sumă, dar comercianți diferiți: a doua se pierde (QA BF-09).
- Ghidul:
  - alegerea plicului înainte de zi se pierde;
  - după salvare conversația dispare, fără confirmare;
  - un salariu notat de două ori trece fără avertisment;
  - nu înțelege „cardul Anei” sau „pe tichete”;
  - pe web, fără internet, apare un ecran de eroare.

  (Utilizator #7–#9, #15)
- Ghidul răspunde despre alt plic când cel întrebat nu există (QA BF-11).
- Formularul de venit nu propune salariile declarate („Salariul meu · 4.700”) (Utilizator #17).
- Categoriile sunt greșite, deși plicul e corect: grădinița ajunge la „Consumabile copil”, rata la „Rate produse” (Utilizator #18).

**Astăzi și alerte**
- Banda unică de alertă ascunde „se termină înainte de salariu” și nu numără plicurile (QA BF-10).
- Memo-urile nu se reîmprospătează după miezul nopții, așa că apar două zile pe același ecran (Dezvoltator #11).
- Widgetul arată cifra de ieri fără eticheta „veche” (Dezvoltator #12).
- Anularea repartizării dispare de pe Astăzi la repornire (Utilizator #16).

**Securitate (scăzut)**
- Copiile automate stau necriptate în Descărcări publice, fără rotație (Securitate R5).
- PIN-ul nu are limită de încercări. Widgetul și notificările arată sume și cu PIN activ. Lipsește `FLAG_SECURE` (R8).
- `playRtdn` nu verifică OIDC, iar `verifyPlayPurchase` nu are limită de cereri (R9).
- Lipsește CSP, iar `file_paths.xml` e prea larg (R10).
- Invitația e o credențială permanentă (R11).

**Accesibilitate**
- Plan are 47 de ținte sub 44 px și 129 de texte sub 12 px (unele de 9 px). Contrastul ridicat aproape nu schimbă nimic (Designer §8).
- Butoanele din `<summary>` sunt încălcări axe „serious” (QA BF-15).
- Focusul se pierde după „Aplică repartizarea” (QA BF-16).
- Copia automată se oprește dacă data ultimei copii e în viitor (QA BF-17).

**Limbaj**
- „Telefonul lui Ana” → „Telefonul Anei”; „Salariu Ana” → „Salariul Anei”; „SOLD INITIAL” fără diacritică; „1 mișcări”; lunile cu majusculă.
- Jargonul (tranșă, S2, ritm, reper, repartizare, perspectivă) trebuie redus la: **plic, săptămâna, bani liberi, card/cash/tichete**.
- Tabelul complet e în raportul utilizatorului.

---

## 5. Design: meniu, grafică, teme, animații, grafice

**Buguri vizuale de reparat repede**
- **Fontul:** același nume de font acoperă 3 fonturi (Plex Sans, Plex Serif, Outfit), de aceea unele sume ies cu serif. `font-display: optional` arată fontul de sistem la prima deschidere.
- **Desktop:** apar două meniuri (sus și jos), iar antetul de zi din Mișcări acoperă primul rând.
- „Bilanțul săptămânii” e lipit de textul următor.
- „Mută 505 RON” e strivit pe 4 rânduri.
- Checkbox-ul de 13 px de la „venituri neregulate”.
- RCA apare „în fiecare lună”.
- Pe același plic apar două etichete de stare care se contrazic.
- „Cheltuială” e roșu alarmant.

**Meniu nou propus (mobil)**
- Jos: `Astăzi · Plicuri · [＋ Notează] · Mișcări · Mai mult`. „Notează” e buton central fix.
- „Mai mult” devine o foaie care se ridică de jos. Conține: Obligații, Obiective, Datorii, Analiză, Bonuri, Familie și Sync, Aspect, Backup, Ghid.
- Desktop: bară laterală stângă și 2 coloane, fără bara de jos.

**Ecrane**
- **Plan → „Plicuri”.** Lista de plicuri e pe primul ecran, grupată: Fixe, Variabile, Economii. „+ Plic” deschide o foaie. Setările (perioadă, ritm, „Ce plătim lunar”, istoric) se mută într-o sub-pagină. Ținta: sub 3 ecrane.
- **Cartonașul de plic** are 88–96 px: nume, rămas, bară cu marcajul „aici ar trebui să fii azi” și o singură etichetă de stare. Stările sunt diferite pentru **fixe** (Neplătit / ✓ Plătit) și **variabile** (În ritm / Atenție / Depășit).
- **Mișcări:** listă plată, cu rânduri de 60 px (8 pe ecran), ștergere prin glisare cu „Anulează” și filtrele într-o foaie.
- **Notează:** suma întâi (mare, cu tastatura deschisă), apoi comerciantul, iar plicul se alege singur.
- **Astăzi:** erou compact, un singur bloc „De rezolvat (N)” în loc de 9 carduri și următoarele 3 plăți.
- **Analiză:** un singur rând de filtre, culori stabile pe categorie, donut simplificat.

**Sistem vizual**
- Scară tipografică cu 7 trepte, niciun text sub 12 px, cifre `tabular-nums`, serif doar la titluri.
- Culori pe 3 straturi (primitive, semantice, categorii). Roșu doar pentru depășit sau întârziat.
- Grilă de spațiere de 4, 4 raze, 3 niveluri de elevație, fără carduri în carduri.
- CSS: de la 117 fișiere și ~2.400–3.400 `!important` la ~20 de foi de componentă.

**Teme**
- Se păstrează: Alb (implicită), Întunecat, Navy (premium).
- Se șterge codul temelor Aurora și Cyber, plus 3 din cele 5 texturi.
- Contrastul ridicat trebuie refăcut ca mod real, pornit automat pe `prefers-contrast`.
- Opțiunea „Urmează sistemul” devine implicită.
- Idei noi: Sepia/Calm, „Copil” pentru modul membru, o culoare de accent pentru fiecare membru.

**Animații** (doar `transform`/`opacity`, oprite la `prefers-reduced-motion`)
- Apăsare: 120 ms. Foaie: 320 ms.
- După salvare, cifra zilei numără la noua valoare (480 ms).
- Plicurile se umplu în cascadă la repartizare, iar la aplicarea salariului segmentele „zboară” în plicuri (600 ms).
- Bifă desenată la plată.
- Glisare cu vibrație (haptic).
- View Transitions la schimbarea temei.

**Grafice noi sau refăcute**
- **Burn-down pe plic:** linia ideală, linia reală și proiecția.
- **Bandă S1–S5:** în locul listei de text.
- **Meter cu marcaj „azi”.**
- **Calendar de bani:** scadențe, salarii și soldul proiectat.
- **Comparație lună vs. medie**, pe categorii.
- **Waterfall „cum se calculează cifra zilei”:** explică 35,50.
- **Payoff datorie.**
- **Donut cu maximum 6 felii.**

---

## 6. Produs: funcții noi, monetizare, lansare

**Poziționare:** *„Salariul vine, aplicația îl împarte. Voi doar notați.”* Aplicația nu vinde categorisire, pe care băncile o dau deja gratis (George, BT Pay, Revolut). Vinde ce nu poate face o bancă: toate sursele (2 bănci, cash, tichete), ambii parteneri, planul făcut *înainte* de cheltuială și plățile rare. Cel mai mare concurent real e **caietul sau Excelul**. Cea mai mare amenințare de brand e **MiM** (gratuit, RO).

**Ce lipsește ca să fie „top” în România** (prioritizat)
1. **Încredere:** domeniu propriu, persoană juridică (PFA sau SRL) în Play, email pe domeniu și o pagină de o ecran „cum vă protejăm datele”. (P0)
2. **Pornire din șabloane de gospodărie RO**, cu sume tipice: „2 salarii + rată + copil”, „singur, chirie”, „pensionar”. (P0)
3. **Telemetrie minimă, opt-in, anonimă, fără sume.** Fără ea nu se poate măsura activarea sau conversia. (P0)
4. **Modul simplu ca implicit pentru utilizatorii noi**, cu funcțiile avansate ascunse până la al doilea ciclu. (P0)
5. **Captură din notificările băncii** (BT Pay, George, ING, Revolut), fără login bancar, ca propuneri în „De verificat”. Are cel mai mare efect pe retenție. Cere o declarație Play separată. (P1)
6. **Partenerul cu iPhone** folosește varianta web, cu instrucțiuni „Adaugă pe ecranul principal”. (P1)
7. **Notificare în ziua salariului:** „A intrat salariul? Apasă și vezi împărțirea.” (P1)
8. **Calendar anual RO:** impozit local cu bonificație până pe 31 martie, RCA, ITP, rovinietă, școală, Paște, Crăciun. (P1)
9. **Notare vocală în română.** (P1)
10. **Cererea de recenzie in-app** după prima repartizare aplicată. (P1)
11. Mai sunt:
    - „am scos cash de la bancomat” (transfer card → cash);
    - facturi din PDF sau poză;
    - împărțirea cheltuielilor între parteneri (50/50, proporțional);
    - cardul partajabil „Anul familiei”;
    - „inflația coșului vostru”;
    - liste de cumpărături legate de plic;
    - alertă IRCC pentru rate variabile;
    - șabloane de venit RO: alocația, pensia, tichetele, al 13-lea salariu.

**Ce NU e recomandat acum:** open banking, reclame, credite sau asigurări, funcții sociale, încă o temă.

**Monetizare**
- **Casa (gratuit) = „eu”**, iar **Familia (plătit) = „noi”**. Momentul clar pentru plată: **al doilea salariu în repartizare**, sync, membri, modul membru, „cine plătește”.
- Prețurile 19,99 lei/lună și 149 lei/an sunt bune. Propunere: **preț de fondator de 99 lei/an** pentru primii 1.000 de plătitori.
- **Trial de 30 de zile** (14 e prea scurt, nu acoperă un salariu), pornit **la conectarea celui de-al doilea telefon**.
- Ghidul online în Casa scade de la 20 la 5 pe zi. Nu se lansează Family+. Un plan „pe viață” se testează mai târziu.
- **Referral:** invitarea partenerului, plus coduri Play „Dă mai departe o lună”.

**Lansare Play**
- **Titlu:** „Buget Familie: Cheltuieli”. **Descriere scurtă:** „Buget pe salariu: plicuri, cheltuieli, facturi. Fără login bancar.”
- **8 capturi cu poveste:** cifra zilei, salariul se împarte singur, două salarii, mâncare 600 pe săptămână, plăți rare, cine plătește, bonul, fără parola băncii. Plus un video de 20–30 s.
- **Primii 1.000 de utilizatori:**
  - testare închisă cu cupluri reale;
  - listă de așteptare cu preț de fondator;
  - grupuri de părinți sau economii și un șablon Excel gratuit;
  - video-uri scurte în zilele de salariu;
  - micro-creatori;
  - presă tech RO;
  - campanii „Crăciun fără card de credit”, „Anul familiei”, „impozitul cu bonificație”.
- **Metrica nord:** gospodării care încheie un ciclu salarial cu plan activ (repartizare aplicată și cel puțin 10 mișcări). Ținte: D7 15–20%, D30 10%, rating ≥ 4,5, crash-free ≥ 99,5%.

---

## 7. Plan propus, pe etape

**Etapa A: siguranță și conformitate (1–2 săptămâni).** Blochează lansarea.
1. Politica și Data safety corectate (P0-1). Decizia despre copii (P0-2).
2. „Telefonul lui X”: ieșire cu PIN, `selfMemberId` restabilit, „Notează” restrâns la persoană, fără Sync, Backup și Invitație în modul acesta.
3. Anularea repartizării: fără ștergerea plicurilor, fără dublă aplicare, cu delta în loc de sumă absolută (P0-6). „Anulează” după ștergere (P0-7). Rotunjirea banilor (P1-4).
4. Limitele ghidului AI: fail-closed, IP corect, plafon global, cheie API restricționată (P0-8).
5. Sync: compresie, verificare de mărime și mesaj clar (P0-3, pasul rapid). Tombstone-uri pentru toate tipurile (P0-4).

**Etapa B: cifre corecte (1–2 săptămâni)**

6. Plicurile fixe (facturi, rate) primesc starea „✓ Plătit”, fără ritm pe zi și fără alarme (P1-1).
7. O singură regulă pentru „pe zi” și o singură cifră a zilei peste tot (P1-2). Ghidul nu mai folosește media ciclului cu rate incluse.
8. Ciclul și salariul:
   - pornirea la mijlocul lunii (P1-5);
   - salariile pe 1 și pe 25 (P1-6);
   - ziua salariului (P1-7);
   - mutările din ciclul vechi (P1-8);
   - „cât ai acum pe card” ca ajustare de sold (P1-3).
9. Bug-urile QA medii (BF-07…BF-13) și cele ale ghidului.
10. Performanță: cache pe formatterul de dată, `allocationWeeksStatus` într-o singură trecere, memorare pe Astăzi și Plan (P1-12).

**Etapa C: redesign (3–5 săptămâni)**

11. Fontul, dublul meniu pe desktop, bugurile vizuale, niciun text sub 12 px, ținte de 44 px.
12. Meniul nou cu „＋ Notează” central. Plan → Plicuri compact. Mișcări plat. Notează cu suma întâi. Astăzi cu „De rezolvat”.
13. „Ce plătim lunar” legat de Obligații, cu bifa „✓ Plătit” și scadența.
14. Limbajul simplificat și genitivul corect.
15. Teme reduse, contrast ridicat real, CSS consolidat.

**Etapa D: creștere (după lansare)**

16. Încrederea: domeniu și firmă. Telemetrie opt-in. Șabloane la pornire. Notificarea de zi de salariu. Cererea de recenzie.
17. Billing cu trial de 30 de zile la al doilea telefon și preț de fondator.
18. Captura din notificările băncii (beta). Partenerul pe iPhone (web). Notarea vocală. Calendarul anual RO.
19. Grafice noi (burn-down, calendar de bani, lună vs. medie) și animații.
20. Sync pe documente lunare și merge în 3 căi (P0-5, soluția de durată).

---

*Rapoartele detaliate (cu pași de reproducere, fișiere și linii, capturi și măsurători) sunt în acest folder. Capturile și scripturile agenților au rămas în mediul de lucru și nu sunt în repo.*
