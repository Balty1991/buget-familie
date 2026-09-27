# Buget Familie: audit de design UI/UX, runda a treia (27.09.2026, v1.1.96, commit 5b63e2a)

**Perspectivă:** designer senior de produs pentru aplicații fintech.

**Metodă:**
- Am rulat aplicația locală (http://127.0.0.1:5174), fără Firebase, cu aceeași familie demo ca în runda trecută: Andrei și Maria, 2 salarii, 7 plicuri (Mâncare pe săptămâni), 4 scadențe, 2 datorii, 2 obiective, 3 luni de istoric și o lună din 2025 (ca să apară „Închide anul”).
- Am făcut capturi pentru 18 ecrane și foi în temele Alb, Întunecat și Navy:
  - telefon la 390×844, cu derulare pe tot ecranul;
  - telefon la 360×780 și 320×640, în tema Alb;
  - tabletă la 800×1280, în Alb și Navy;
  - desktop la 1280×900, cu bara laterală nouă (apare de la 1200 px), în toate cele trei teme.
- Am capturat separat stările goale, prima pornire, dialogul de confirmare, eroarea și succesul din Notează.
- Am măsurat automat contrastul WCAG (inclusiv pe fundaluri în gradient), textul sub 12 px, țintele sub 44 px, sumele scrise cu serif și depășirile pe orizontală.
- Am citit CSS-ul și TSX-ul pentru fiecare problemă.
- Am comparat capturile de magazin din `docs/play-store-assets/screenshots/ro` și `tableta-ro` cu aplicația.

**Capturi:** `/tmp/claude-0/-home-user-buget-familie/6251941a-2f52-5fdd-bb21-2d9641b66e0b/scratchpad/agenti3/design/`. În raport, prescurtarea **`S/`** înseamnă acest director.
- `S/shots/<ecran>-<temă>-<m|m360|m320|t|d>[-sN].png`: `m` = 390 px, `t` = tabletă, `d` = 1280 px, `sN` = pagina N a derulării.
- `S/mont/*.png`: planșe cu mai multe capturi alăturate.
- Scripturile se pot rula din nou: `cap.mjs` (capturi), `measure.mjs` (contrast, text mic, ținte, serif), `empty.mjs` și `first.mjs` (stări goale, prima pornire), `dlg.mjs` (dialoguri), `probe4.mjs` (unde apare „Notează” la fiecare lățime), `side.mjs` (culorile barei laterale), `zoom.mjs` și `cls.mjs` (detaliu și clase CSS).

---

## 1. Pe scurt

**Nota de design: B (7,5/10).** Runda trecută: B− (7/10), deci o jumătate de punct în plus.

**De ce crește nota:**
- Contradicțiile de fond au dispărut. Cifra zilei (160,30) e aceeași în erou, în notă, în plic și în „Cum se citește?”. Cascada are acum eticheta corectă (−64,20 → 160,30), iar Chirie nu mai are trei stări diferite.
- Desktopul are, în sfârșit, o structură proprie: bară laterală cu „+ Notează”, Astăzi pe două coloane, plicurile pe trei coloane, iar Notează se deschide ca modal centrat.
- Navy are accentul auriu propriu, iar Întunecatul nu mai are roșu ilizibil. Automat am găsit un singur text sub AA pe temele închise, un kicker (D3).
- Căutarea are iconițe de categorie, abonamentele au suma la dreapta, iar „Detalii” din plicuri au chevron.
- „+ Plic” e foaie de jos pe telefon, checkbox-ul „venituri neregulate” nu mai are textul lipit, iar prima pornire are trei intenții clare plus „Alte moduri”.

**De ce nu e încă A:**
1. **Trei scăpări noi de contrast, toate sub 2:1:**
   - elementul activ din bara laterală pe Navy (1,9:1);
   - linkul „Arată toate cele N rate”, mint pe alb (1,4:1, 10 px);
   - kickerul „PROIECȚIA SCENARIULUI”, invizibil pe blocul verde sau auriu în toate temele.
2. **Zona dintre 761 și 1199 px (tabletă, laptop mic) e tratată ca „nici telefon, nici desktop”:**
   - nu există „Notează” global, decât pe Astăzi și în Mișcări;
   - „De rezolvat” pe Astăzi nu mai are padding;
   - pe Sincronizare apare un card gol de 658 px.
3. **Finisajul semnalat de două ori tot n-a fost făcut:**
   - pagina „Mai mult” are tot un hero, iar sub-paginile au „Înapoi la instrumente”;
   - 7 acordeoane n-au chevron;
   - Analiză are 4 straturi de filtre, iar „Ritm lună cu lună” are tot 25 % din lățime și etichetele „I I A S”;
   - data eroului e tot pe 3 rânduri;
   - „Confirmă plata” are tot iconul deasupra textului;
   - grila din „+ Plic” e ruptă la 390 px.
4. **Tipografia depinde de temă.** Pe Întunecat și Navy, suma „Nerepartizați” și titlurile din Setări trec pe Fraunces, iar pe Alb sunt sans. Marca e „FAMILIE” pe Alb și „Familie” pe temele închise.
5. **Capturile de magazin sunt reale, dar două dintre ele se contrazic singure:**
   - „Două salarii, zile diferite” arată ambele salarii pe 18;
   - „A început săptămâna 2 … 560 RON pentru 7 zile” stă deasupra lui „216,60 pentru 1 zi”.

---

## 2. Ce s-a reparat din runda trecută (D1–D24 din `docs/raport-agenti-2026-09-26/design-report.md`)

| # | Constatare 26.09 | Stare verificată azi | Dovadă |
|---|---|---|---|
| D1 | Trei cifre pentru „cât pot azi” | ✅ Peste tot 160,30 (erou, notă, plic, cascadă) | `S/mont/today-w.png`, `S/mont/plicdet.png` |
| D2 | Cascada minte | ✅ „Cheltuit azi −64,20 → 160,30” | `S/shots/citeste-white-m.png` |
| D3 | Chirie cu 3 stări | ✅ „Plătit” în plic și abonament normal în Obligații | `S/mont/plicuri-w-a.png`, `S/mont/obl-w-a.png` |
| D4 | Bloc închis pe Alb | ✅ Nu mai apare | — |
| D5 | Roșu ilizibil pe Întunecat și Navy | ✅ Coral lizibil (măsurat: niciun text roșu sub AA) | `S/meas2-dark.log`, `S/meas2-navy.log` |
| D6 | Accentul Întunecat pe Navy | ✅ Navy are auriu | `S/mont/navy-a.png` |
| D7 | Serif pe sume | ⚠️ Pe Alb e rezolvat aproape peste tot. Pe Întunecat și Navy, „Nerepartizați” e Fraunces. Pe Obiective, „40 %”, „12.600 RON” și „165,23 RON” sunt Fraunces în toate temele. | `S/meas2-*.log` (SERIFNUMS) |
| D8 | Paletă cu 3 verzi | ⚠️ Baza e bună. „Copii” (categorie proprie) primește un violet din hash, aproape identic cu „Timp liber”. | `S/mont/an-w-a.png` (donut) |
| D9 | Fâșia de 24 px pe desktop | ✅ | `S/shots/today-white-d.png` |
| D10 | Layout de desktop | ✅ La ≥1200 px: bară laterală, două coloane, modal. ❌ Între 761 și 1199 px lipsește (D4, D5 noi). | `S/mont/d-today.png`, `S/mont/t-a.png` |
| D11 | Cardul plicului | ✅ Compact, cu chevron la „Detalii”. ❌ Banda „ATENȚIE” e ruptă (D8 nou). | `S/shots/z-atentie2.png` |
| D12 | Trei totaluri pe Plicuri | ✅ O singură ecuație: „17.298,80 disponibili = 3.914,30 în plicuri + 13.384,50 liberi” | `S/mont/plicuri-w-a.png` |
| D13 | Obligații | ⚠️ Suma e la dreapta ✅. Iconul din „Confirmă plata” e tot deasupra textului ❌. „Simulează o plată în plus” n-are chevron ❌. | `S/mont/obl-w-a.png` |
| D14 | Analiză | ❌ Tot 4 straturi de filtre, „Ritm” îngust, iar hero-ul are o linie goală | `S/mont/an-w-a.png`, `S/mont/an-w-b.png` |
| D15 | Setări | ⚠️ Grupuri pliabile cu chevron ✅. Hero-ul „Mai mult” și „Înapoi la instrumente” au rămas ❌. | `S/mont/more-w.png` |
| D16 | „+ Plic” | ⚠️ Foaie de jos pe telefon ✅. Grila e ruptă la 390 px, iar pe tabletă și desktop formularul e tot inline ❌. | `S/shots/plicnou-white-m.png`, `S/mont/d-b.png` |
| D17 | „Cum se citește?” | ✅ | `S/shots/citeste-white-m.png` |
| D18 | Mișcări | ⚠️ Meta nu mai e dublată ✅. Tot „−145 RON” în antet față de „−145,00 RON” pe rând, coș pe fiecare rând și ~290 px de filtre. | `S/mont/misc-w.png` |
| D19 | Text sub 12 px | ⚠️ Mai rar, dar tot 9 px la „Plătit”, 8–10 px în previzualizarea din Aspect și 10 px la „Arată toate ratele” | `S/meas2-white.log` |
| D20 | Gri 3,6:1 | ✅ Nu mai apare în măsurători | — |
| D21 | Ghid și căutare | ⚠️ Căutarea are iconițe ✅. Chip-urile din Ghid sunt tot tăiate fără estompare. | `S/mont/sheets-w.png` |
| D22 | First-run cu 6 intenții | ✅ 3 intenții + „Alte moduri de a începe” | `S/mont/first.png` |
| D23 | Hero fals de sync | ✅ | — |
| D24 | Datoria de CSS | ⚠️ 80 de fișiere, 2.257 de `!important` (erau 2.296) | `grep -c important client/src/*.css` |

**Bilanț:** 12 reparate, 9 parțial, 3 nereparate. Reparațiile de fond (cifre, stări, teme, desktop) au intrat toate. Au rămas, din nou, detaliile de finisaj.

---

## 3. Ecran × temă × dispozitiv

Legendă: ✅ fără probleme vizibile · ⚠️ probleme mici · ❌ problemă clară. Numărul trimite la constatare.

| Ecran | Alb 390 | Întunecat 390 | Navy 390 | 360 / 320 | Tabletă 800 | Desktop 1280 |
|---|---|---|---|---|---|---|
| Astăzi | ⚠️ D13 | ⚠️ D12 (marca) | ⚠️ D12 | ❌ 320: cifra începe la y=525, D13 | ❌ D5, D4 | ⚠️ 2× „Notează”; ❌ Navy D1 |
| Plicuri | ⚠️ D8, D9 | ⚠️ D12 serif | ⚠️ D12 | ⚠️ „NEREPARTIZAȚI13.384” lipit la 320 | ❌ D4 | ⚠️ goluri în grila pe 3 coloane |
| Foaia „+ Plic” | ❌ D7 grila | ❌ D7 | ❌ D7 | ✅ o coloană | ❌ inline, D7 | ❌ inline, D7 |
| Ce plătim lunar | ⚠️ D9 | ⚠️ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| Detaliu plic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Notează | ⚠️ D18 | ✅ | ✅ | ⚠️ 320: magazinul sub pliu | ❌ D4 (lipsește în afara Astăzi) | ✅ modal |
| Mișcări | ⚠️ D16, formate | ⚠️ iconițe roșii | ⚠️ | ⚠️ „Caută miș…” tăiat | ⚠️ filtre inegale | ✅ |
| Obligații | ❌ D2, D16 | ⚠️ | ⚠️ | ⚠️ | ❌ D4 | ⚠️ sumă la 700 px de nume |
| Analiză | ❌ D11 | ❌ D11 | ❌ D11 | ❌ D11 (depășire la 320) | ❌ D11 | ❌ D11 |
| Obiective | ❌ D3, D12 | ❌ D3 | ❌ D3 | ⚠️ | ⚠️ | ❌ D3 |
| Mai mult | ❌ D10 | ❌ D10 | ❌ D10 | ⚠️ | ❌ D10 | ❌ D10 (dublează bara laterală) |
| Setări | ⚠️ D10, D20 | ⚠️ D12 titluri Fraunces | ⚠️ D12 | ⚠️ | ⚠️ | ⚠️ |
| Copii de siguranță + Închide anul | ⚠️ D20 | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ |
| Ghid | ⚠️ D21 | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ |
| Aspect | ⚠️ D17, D19 | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Familie / Sincronizare | ⚠️ D6 (CTA departe) | ⚠️ | ⚠️ | ⚠️ | ❌ D6 card gol | ❌ D6 card gol |
| Prima pornire | ✅ | ⚠️ D21 (ignoră tema) | — | ✅ | — | ✅ |
| Stări goale | ✅ | — | ✅ | — | — | — |
| Dialoguri și erori | ⚠️ D17, D18 | — | ✅ | — | — | — |

---

## 4. Constatări

Legendă: **P0** blocant · **P1** important · **P2** mediu · **P3** minor. Efort: S = sub o zi, M = 1–3 zile, L = peste 3 zile.

### D1 · P1 · Navy, desktop: elementul activ din bara laterală are contrast 1,9:1

**Ce am văzut:** „Astăzi” (sau orice ecran activ) apare cu text aproape negru #111 pe ardezie rgb(59,68,78). Pare un buton dezactivat. Măsurat: **1,91:1** (minimul AA e 4,5:1).

**Captură:** `S/shots/side-navy.png`, `S/mont/navy-d.png`.

**Cauza:**
- `contrast-fix.css:376–379` forțează `color: var(--cf-on-primary)`, adică textul pentru fundal auriu, pe `.os-desktop-nav button.is-on`.
- Fundalul vine însă din `household-os-chrome.css:625` (`background: var(--os-mint-dim)`), care pe Navy e ardezie, nu auriu.

**Propunere:**
- Pe Navy, scoate `.os-desktop-nav button.is-on` din regula din `contrast-fix.css` (rămâne doar pentru dock).
- Stil activ: `color: var(--cf-primary)` (auriu) pe `color-mix(in srgb, var(--cf-primary) 14%, transparent)`, cu bara de 2 px auriu deja existentă.
- Adaugă cazul în testul de contrast.

**Efort:** S.

### D2 · P1 · Obligații: „Arată toate cele N rate” e mint pe alb, 1,4:1, 10 px

**Ce am văzut:** sub scadențarul fiecărei datorii apare un link aproape invizibil, măsurat la 1,43:1 și 1,49:1. E singurul mod de a vedea toate ratele.

**Captură:** `S/mont/an-w-b.png` (dreapta, sub „Rata 06”), `S/meas2-white.log`.

**Cauza:** `visibility-safety.css:268`: `.bf-schedule-more{…color:#70e5bd;font:600 10px…}`. E o culoare scrisă direct, din tema Întunecat, fără token.

**Propunere:** `color: var(--cf-link); font: 600 13px/1.2 "IBM Plex Sans"`, cu un chevron. Caută `#70e5bd` în tot CSS-ul: mai apare de 2 ori.

**Efort:** S.

### D3 · P1 · Obiective: kickerul „PROIECȚIA SCENARIULUI” e invizibil în toate temele

**Ce am văzut:** eticheta de deasupra lui „165,23 RON” are aceeași culoare ca blocul pe care stă: verde pe verde (Alb, 1,34:1), mint pe mint (Întunecat, 1,23:1), auriu pe auriu (Navy, 1,27:1).

**Captură:** `S/mont/obj.png` (1 și 3).

**Cauza:** `.bf-scenario-result` (`deferred-atelier.css:1015`) are gradient `--cf-primary-strong → --cf-primary`, iar `.bf-kicker` rămâne `var(--cf-primary)`.

**Propunere:** `.bf-scenario-result .bf-kicker { color: var(--cf-on-forest); opacity: .8 }`. Mai general: orice kicker pus pe un bloc plin moștenește textul „on-”.

**Efort:** S.

### D4 · P1 · Între 761 și 1199 px nu există „Notează” global

**Ce am văzut:**
- La 761, 768 (iPad), 800, 1000, 1024 și 1199 px, pe Plicuri și Obligații nu există niciun buton de adăugare (`probe4.mjs`: `[]`). La 760 px, „Notează” e în dock, iar de la 1200 px e în bara laterală. Granița e exactă: 760 px are buton, 761 px nu mai are.
- Dock-ul dispare la 760 px, iar bara laterală apare abia la 1200 px. Între ele, „Notează” există doar în eroul de pe Astăzi și ca „+” în Mișcări.
- Pe o tabletă de 10″ în picioare (exact formatul capturilor „tableta-ro”), acțiunea principală a aplicației lipsește de pe 4 din 5 ecrane.

**Captură:** `S/mont/t-a.png`, `S/mont/t-b.png`, `S/shots/nav-800.png`.

**Cauza:** `household-os-today.css:775`: `.os-desktop-add { display:none }`, care se activează doar în `@media (min-width:1200px)`.

**Propunere:** afișează `.os-desktop-add` și în antetul orizontal, de la 761 px: un buton compact „＋ Notează” la dreapta taburilor, înaintea uneltelor. Alternativa: coboară bara laterală la 1024 px și, între 761 și 1023 px, folosește un FAB fix.

**Efort:** S.

### D5 · P2 · Tabletă: „De rezolvat” de pe Astăzi n-are padding

**Ce am văzut:** la 800 px, kickerul „DE REZOLVAT” stă lipit de marginea cardului (x=15), iar cardul „Copie de siguranță” din interior e lipit de marginea din stânga a containerului.

**Captură:** `S/shots/today-white-t.png` (jos).

**Cauza:** `section.bf-today-brief` are `padding: 0px` la 800 px (`cls.mjs`). Paddingul de 16–18 px e dat doar în media-query-ul de desktop (`household-os-today.css:770`).

**Propunere:** `.bf-today-brief { padding: 16px }` în afara oricărui media-query.

**Efort:** S.

### D6 · P2 · Familie / Sincronizare: card gol de 658 px și acțiunea principală îngropată

**Ce am văzut:**
- Pe tabletă și desktop, coloana din stânga are un card alb gol cu „Nu este conectat” jos, la 600 px de sus.
- Pe telefon, „Creează camera” și „Intră în familie” apar abia la al treilea ecran de derulare, după un hero cu o treime goală și după listele „Ce se sincronizează” și „Ce nu se sincronizează”.

**Captură:** `S/mont/d-c.png` (dreapta jos), `S/mont/t-b.png` (4), `S/mont/sync-w.png` (1 și 2).

**Cauza:** `.bf-sync-state.idle` se întinde pe înălțimea rândului din grilă (`align-self: stretch`).

**Propunere:**
- `.bf-sync-state { align-self: start }`.
- Ordinea pe telefon: starea (o linie), apoi două butoane mari („Creează familia”, „Am primit o invitație”), apoi „Ce se sincronizează” într-un `<details>`.

**Efort:** S.

### D7 · P2 · Foaia „+ Plic”: grila e ruptă la 390 px și formularul e inline pe ecranele late

**Ce am văzut:**
- La 390 px, „PLĂTIT DIN” stă sus în dreapta, iar „MEMBRU” e cu 70 px mai jos, în stânga, cu un gol deasupra lui.
- Selectul e tăiat: „Card BT · 17.184 l”.
- Nota „Din 17.298,80 RON ai deja 115 RON în plicuri” contrazice pagina de dedesubt, care spune 3.914,30 în plicuri (nota se referă doar la cardul BT și nu spune asta).
- „Alege perioada **mai sus**” trimite la ceva ce nu există în foaie.
- La 360 și 320 px formularul trece corect pe o coloană.
- Pe tabletă și desktop, „+ Plic” deschide tot un formular inline lung în pagină, nu un modal ca Notează.

**Captură:** `S/shots/plicnou-white-m.png`, `S/mont/m360.png` (2), `S/mont/d-b.png` (1).

**Propunere:**
- O singură coloană sub 480 px.
- Peste 480 px: rânduri pereche aliniate la bază (`align-items: end`), cu ajutorul pus sub rând, nu lângă câmp.
- Textul devine: „Pe Card BT mai sunt liberi 17.183,80 RON”.
- Pe ecranele late, același modal ca Notează (max. 560 px).

**Efort:** M.

### D8 · P2 · Plicul „ATENȚIE”: banda colorată taie suma, iar bara rămâne verde la 90 %

**Ce am văzut:**
- Banda de 28 px se termină în mijlocul sumei „42 RON”: jumătatea de sus e pe bej, cea de jos pe alb.
- Bara de progres e verde la 358/400 (90 %), deși cardul spune „ATENȚIE”.

**Captură:** `S/shots/z-atentie2.png`.

**Cauza:** `deferred-atelier.css:2261–2277`: `linear-gradient(… 0 28px, var(--cf-surface) 28px)`, cu înălțime fixă indiferent de conținut.

**Propunere:**
- Scoate banda. Păstrează doar chip-ul „ATENȚIE” (auriu pe fundal auriu 12 %) și bordura laterală.
- Bara de progres trece pe `--cf-warning` de la 80 % și pe `--cf-danger` peste 100 %. Pragul „Avertizează la 80 %” există deja în plic.

**Efort:** S.

### D9 · P2 · Plicuri și Obligații: 7 acordeoane fără chevron, lângă altele care îl au

**Ce am văzut:**
- Pe aceeași pagină, „Detalii ⌄” și „Instrumente pentru perioade repetate ⌄” au chevron.
- „Plic nou”, „Alege ritmul casei.”, „Unelte: propunere, simulare, ghid”, „Perioada salariului…”, „Ritual de salariu și istoric”, „Ce plătim lunar — repartizare automată la salariu” și „Simulează o plată în plus” arată ca niște carduri albe goale, fără semn că se deschid.
- „Plic nou” dublează butonul „+ Plic” de sus.

**Captură:** `S/mont/plicuri-w-a.png` (4), `S/mont/plicuri-w-b.png` (2), `S/mont/obl-w-a.png` (3).

**Propunere:**
- O singură componentă `Disclosure`: titlu 15/600, chevron de 16 px la dreapta, rotit la `[open]`, și minimum 52 px înălțime.
- Scoate „Plic nou” (inline) de sub listă.
- Mută „Alege ritmul casei”, „Perioada salariului” și „Ritual de salariu” într-un singur grup „Setările ciclului”.

**Efort:** S.

### D10 · P2 · „Mai mult” și sub-paginile arată tot ca un meniu vechi

**Ce am văzut:**
- Pagina are un hero „Mai mult” de 70 px, cu un gradient-pată în dreapta.
- Rândurile au bare laterale colorate de 3 px și stau în carduri din alte carduri.
- Fiecare sub-pagină (Setări, Sincronizare) păstrează hero-ul „Mai mult” și are butonul „‹ Înapoi la instrumente” în conținut. Titlul real al paginii (Setări) nu apare nicăieri.
- Pe desktop, „Mai mult” repetă Obligații și Analiză, care sunt deja în bara laterală.

**Captură:** `S/mont/more-w.png`, `S/mont/d-c.png` (2 și 3), `S/mont/sync-w.png`.

**Propunere:**
- Pe telefon, o bară de aplicație „‹ Setări”. Pe desktop, titlul în pagină și intrarea „Setări” evidențiată în bara laterală.
- Listă grupată fără bare colorate (iconiță + titlu + descriere + chevron), fără hero.
- Pe desktop, scoate din „Mai mult” ecranele care sunt deja în bara laterală.

**Efort:** M.

### D11 · P2 · Analiză: filtrele sunt tot în 4 straturi, „Ritm lună cu lună” tot îngust, iar o statistică iese din casetă

**Ce am văzut:**
- Filtrele sunt, în ordine: tab-uri Istoric / Gospodărie / Asistent, selectul lunii, Lună calendar / Ciclu salariu, Familie / Andrei / Maria, Toate / Comun / Personal. Ocupă ~450 px înainte de prima cifră.
- „Ritm lună cu lună” are ~70 px de grafic din 300 disponibili și etichetele „I I A S”, iar barele sunt butoane de 16×132 px.
- În „Situație lunară”, „4.119,20 RON” atinge separatorul, iar „2” de la „Plicuri de revizuit” cade pe rândul următor.
- Hero-ul „Înțelege schimbarea.” are sub el o liniuță verde și ~60 px goi.
- Pe 320 px, rândul „Toate / Comun (familie) / Personal” iese din ecran (r=326).
- Capturile de magazin pe tabletă (08) arată același grafic „Ritm” cu o singură bară și mult spațiu gol.

**Captură:** `S/mont/an-w-a.png`, `S/mont/an-w-b.png` (1), `S/mont/m320-b.png` (2), `S/mont/ps-tab.png` (4).

**Propunere:**
- Un singur rând sticky: `[sept. 2026 ▾] [Ciclu ▾] [Toți ▾]`. Tab-ul „Asistent” se mută în Ghid.
- „Ritm” pe toată lățimea, cu etichete „iun, iul, aug, sept” și bare de ≥24 px.
- Statisticile pe 3 coloane egale cu `min-width: 0`, iar sumele la 15 px cu `white-space: nowrap` (sau două rânduri: 2 + 1).
- Scoate liniuța și hero-ul. Titlul paginii ajunge.

**Efort:** M.

### D12 · P2 · Tipografia și marca se schimbă odată cu tema

**Ce am văzut:**
- Pe Întunecat și Navy, „Nerepartizați 13.384,50 RON” e Fraunces, iar pe Alb e IBM Plex Sans.
- Pe Întunecat și Navy, titlurile secțiunilor din Setări („Limba aplicației”, „Doar jurnal și esențialul”) sunt Fraunces (15 texte serif, față de 2 pe Alb).
- Pe Obiective, „40 %”, „12.600 RON” și „165,23 RON” sunt Fraunces în toate temele, iar restul sumelor din aplicație sunt sans.
- Marca de lângă logo e „FAMILIE” (verzale, spațiere largă) pe Alb și „Familie” (litere mici, mai mare) pe Întunecat și Navy.

**Captură:** `S/meas2-dark.log` (SERIFNUMS), `S/mont/obj.png` (4, Setări pe Întunecat), `S/mont/dark-a.png` (3), `S/mont/today-w.png` față de `S/mont/dark-a.png` (antetul).

**Propunere:**
- Regulă de sistem: Fraunces doar pentru titlurile de pagină (h1) și accentul italic. Toate cifrele în Plex Sans, cu `tabular-nums`.
- Fă o căutare după `Fraunces` în selectorii `html.theme-dark` / `html.theme-navy` și în `.bf-goal*`, `.bf-scenario-result strong` (`deferred-atelier.css:1015`).
- Marca: o singură variantă pentru toate temele.

**Efort:** S–M.

### D13 · P2 · Astăzi: primul ecran e aglomerat, iar cifra zilei se repetă de 4 ori

**Ce am văzut:**
- La 390 px, banner-ul are kickerul „SE TERMINĂ ÎNAINTE DE / SALARIU” pe 2 rânduri (3 rânduri la 320 px). Urmează un link separat „Încă o alertă…”. Data e pe 3 rânduri („27 / SEPTEMBRIE / 2026”).
- 160,30 apare în erou, în „Azi poți 160,30 lei. În plicul săptămânii mai sunt 160,30 pentru 1 zi.”, în rândul „dum · Azi · 160,30 lei rămași” și în nota „Mai rămân 160,30… toți pentru azi.”.
- La 320×640, cifra zilei începe la y=525, deci e aproape sub pliu.
- Pe tabletă și desktop apar 2 butoane „Notează” unul lângă altul (bara laterală și eroul).

**Captură:** `S/mont/today-w.png`, `S/mont/m320-a.png` (1), `S/mont/d-today.png`.

**Propunere:**
- Alerta ca o linie în erou („⚠ Transport: 42 RON până pe 15 oct.”) cu „+1” pentru restul.
- Data pe o linie („dum., 27 sept.”).
- O singură propoziție sub cifră („Ultima zi din săptămâna 2 — tot ce a rămas e pentru azi”). Scoate rândul duplicat de sub banda de zile.
- Pe desktop, butonul din erou devine secundar sau dispare.

**Efort:** S.

### D14 · P2 · Capturile de magazin: sunt reale, dar două promisiuni se contrazic cu imaginea

**Ce am văzut:**
- Capturile folosesc aplicația reală, cu aceleași componente, iar aspectul se potrivește cu ce livrează aplicația. E un lucru bun.
- **04 „Două salarii, zile diferite.”** arată ambele venituri cu „Ziua 18”. Promisiunea e contrazisă chiar de imagine.
- **01 „Cât poți cheltui azi”**: banner-ul spune „A început săptămâna 2 · Săptămâna aceasta are 560 RON pentru 7 zile”, iar dedesubt scrie „216,60… pentru 1 zi” (27 septembrie e ultima zi a săptămânii). Kickerul „A ÎNCEPUT SĂPTĂMÂNA / 2” rupe cifra pe rândul următor.
- **07 „Confirmi cu o atingere”** arată pe primul card „Rată bancă · Întârziată” în roșu, cu butonul „Deschide”, nu „Confirmă plata”. Primul lucru pe care îl vede un cumpărător e o restanță.
- **tableta-ro/08**: graficul „Ritm lună cu lună” are o singură bară (D11), iar 01 are „De rezolvat” fără padding (D5).
- Pe tabletă, toate cadrele arată aplicația fără „Notează” global (D4), deși 05 promite „Notezi în 3 secunde”.

**Captură:** `S/mont/ps-ro-a.png`, `S/mont/ps-ro-b.png`, `S/mont/ps-tab.png`, `S/mont/ps01-crop.png`.

**Propunere:**
- În `scripts/store-screenshots/seed.mjs`, pune salariile în zile diferite (de ex. 10 și 25).
- Data capturii pentru 01 să fie o zi de marți, cu banner-ul închis.
- Pentru 07, o scadență „mâine” cu „Confirmă plata”.
- Refă capturile de tabletă după D4, D5 și D11.

**Efort:** S.

### D15 · P2 · Paleta de categorii: categoriile proprii pot lua culoarea uneia de bază

**Ce am văzut:** în donut și în legendă, „Copii” (violet) și „Timp liber” (#8A5CC2) arată ca aceeași culoare.

**Captură:** `S/mont/an-w-a.png` (4).

**Cauza:** `lib/category-color.ts:8–14`. `EXTRA` se alege după hash și conține `#7E6BC4` și `#9C4F9E`, apropiate de `Timp liber` și `Educație`. Nu se verifică nici distanța față de culorile deja folosite pe același grafic.

**Propunere:**
- Scoate violetele din `EXTRA`.
- Pe grafice, dă culorile după rang (primele 6 categorii ale lunii primesc 6 culori distincte, garantat), iar restul intră în „Altele”.

**Efort:** S.

### D16 · P3 · Roșul se folosește încă pentru lucruri normale

**Ce am văzut:**
- Pe Astăzi, toate sumele din „Ultimele mișcări” și „Ieșit −4.119,20” sunt roșii.
- Pe temele închise, iconițele din Mișcări au fundal roșu-coral.
- În Analiză, Δ-urile pozitive (+90 la Timp liber) sunt roșii.
- „Confirmă plata” la cardul de credit e un buton plin, coral.
- „Sold datorii 21.700 RON” e roșu, deși datoria e în grafic.

**Captură:** `S/mont/today-w.png` (3), `S/mont/dark-b.png` (1), `S/mont/an-w-b.png` (4).

**Propunere:** cheltuielile în cerneală neutră, cu „−”. Roșul doar pentru depășit sau întârziat. Butonul principal e mereu culoarea primară a temei.

**Efort:** S.

### D17 · P3 · Microcopy și consecvență

**Ce am găsit:**
- „lei” și „RON” amestecate: „Azi poți 160,30 **lei**”, „8,6 mii lei”, „Soldul anului: 10.079 lei”, iar lângă ele „160,30 **RON**”. Alege una (recomand „lei” în propoziții și „RON” doar ca unitate după cifrele mari, sau „lei” peste tot).
- Dialogul „Ești sigur?” are butoanele „Anulează / **Da**”. Butonul distructiv ar trebui să spună ce face: „Șterge plicul”. (`S/mont/dlg.png`)
- „Vezi **M**ișcările ↘” (majusculă în mijlocul frazei, săgeată în jos pentru o navigare).
- „Obiectiv · 14 iunie 2027 · Obiectiv” și „Factură / abonament · … · Abonamente” au repetiții în meta.
- „Mai mult din ziua asta” nu spune ce deschide.
- Starea goală din Mișcări pentru un utilizator nou spune „pentru această **selecție**”, iar cea din Plicuri: „Alege o categorie **de mai sus**”.
- Aspect folosește jargon intern: „Zi · Platinum”, „Atelier Platinum — hârtie caldă, pin”.

**Efort:** S.

### D18 · P3 · Notează: „Gata” cu suma goală nu face nimic

**Ce am văzut:** apăs „Gata” fără sumă și nu se întâmplă nimic: nu apare niciun mesaj, câmpul nu se colorează, nu se aude nicio vibrație. Succesul e bun: bara „Notat · Alimente · 45 RON · Anulează”.

**Captură:** `S/mont/dlg.png` (2 și 3).

**Propunere:** câmpul primește bordură `--cf-danger` și mesajul „Scrie suma”, focusul revine pe el și se aude o vibrație scurtă. Alternativ, „Gata” rămâne dezactivat până există o sumă.

**Efort:** S.

### D19 · P3 · Text mic și ținte mici (măsurat la 390 px, Alb)

| Ce | Măsură | Unde |
|---|---|---|
| „Plătit” | 9 px | `span.bf-paid-check` |
| Media pe luni în plic | 11 px | `b` în `.bf-allocation*` |
| Previzualizarea din Aspect | 8–10 px | „SURSE UTILIZABILE”, „PUS DEOPARTE” |
| „Total pe perioadă / Pe săptămână întreagă” | 11 px | foaia „+ Plic” |
| Bifele ratelor | 32×32 | `.bf-schedule-check` (`design-system-37.css:451`) |
| Ștergere obiectiv, „Editează” | 30×30, 84×30 | Obiective |
| Barele din „Ritm” | 16×132 | Analiză |
| Ștergere membru | 32×32 | Setări |

**Propunere:** minimum 12 px pentru text și 44×44 px pentru ținte (cu `::after` extins, ca la rate).

**Efort:** S.

### D20 · P3 · Copii de siguranță și Setări: aranjament rupt

**Ce am văzut:**
- „Trimite o copie” stă într-o casetă de 130 px înălțime. Lângă ea, „Copie automată o dată pe săptămână” e un checkbox nativ, cu text de 11 px înghesuit pe 5 rânduri într-o coloană de 101 px.
- În „Pe scurt”, chevron-ul de la „Deschide tutorialul de folosire ›” cade singur pe rândul următor.
- „Închide anul 2025” arată bine: kicker, explicație clară, buton secundar.

**Captură:** `S/mont/more-w.png` (2–4), `S/mont/m360.png` (3).

**Cauza:** `.bf-backup-actions` e o grilă pe 2 coloane cu `LABEL.bf-auto-backup-toggle` ca a doua celulă, iar `.bf-usage-jump` n-are `white-space: nowrap`.

**Propunere:** acțiunile pe o coloană (Salvează / Trimite / Alege / Lipește), copia automată ca rând cu Switch pe toată lățimea, iar `.bf-usage-jump { display: inline-flex; white-space: nowrap }`.

**Efort:** S.

### D21 · P3 · Ghid și prima pornire: finisaj

**Ce am văzut:**
- În Ghid, chip-urile sunt tăiate la marginea ecranului („Cât mai am la Ch”), fără estompare. Eticheta câmpului e scrisă cu verzale, pe 2 rânduri. Sub panou, între el și dock, se văd cifrele benzii de zile.
- Prima pornire cu tema Întunecat setată apare pe Alb. Cardul de la pasul 1 e centrat vertical, iar cel de la pasul 0 umple ecranul, așa că butoanele „Înapoi” și „Mai târziu” sar.

**Captură:** `S/mont/sheets-w.png` (2), `S/mont/first.png`.

**Propunere:**
- `mask-image: linear-gradient(90deg, #000 85%, transparent)` pe șirul de chip-uri.
- Eticheta: „Scrie-mi orice despre banii tăi” (cu literă mică, pe o linie).
- Panoul ghidului acoperă tot, până la dock.
- Prima pornire respectă tema salvată, iar toți pașii folosesc același cadru, pe toată înălțimea.

**Efort:** S.

### D22 · P3 · Mărunțișuri și datoria de CSS

**Ce am găsit:**
- Cardul „Pornește rapid” de pe Plicuri are ~40 px goi și un separator deasupra titlului (`S/mont/plicuri-w-a.png`, 4).
- La 320 px, „NEREPARTIZAȚI13.384,50 RON” e lipit, fără spațiu (`S/mont/m320-a.png`, 2).
- Pe desktop, grila cu 3 coloane din Plicuri lasă goluri: Fixe are 2 carduri, Economii 1.
- Datoria de CSS: 80 de fișiere, 2.257 de `!important`. Aproape fiecare problemă de mai sus (D1, D2, D5, D8, D12) vine dintr-o regulă „de reparație” într-un fișier separat, care suprascrie alta.

**Propunere:** la fiecare reparație din acest raport, șterge regula veche în loc să adaugi una peste.

**Efort:** continuu.

---

## 5. Top 5, pentru cel mai mare câștig cu cel mai mic efort

1. **Cele trei scăpări de contrast (D1, D2, D3).** Toate sunt sub 2:1, fiecare se rezolvă cu o linie de CSS, iar testul de contrast trebuie extins la temele Navy și Întunecat și la blocurile pline. (S)
2. **„Notează” și layoutul între 761 și 1199 px (D4, D5, D6).** Butonul global în antet, padding pe „De rezolvat”, `align-self: start` pe starea de sync. Capturile de tabletă din magazin arată exact această lățime. (S)
3. **Finisajul restant de două runde (D9, D10, D7).** Chevron pe toate acordeoanele, bară de aplicație „‹ Setări” în loc de hero și „Înapoi la instrumente”, o coloană în „+ Plic” sub 480 px. (S–M)
4. **Analiză într-un singur rând de filtre și „Ritm” pe toată lățimea (D11), plus paleta pe rang (D15).** Analiza e ecranul care „vinde” în magazin (08). (M)
5. **Astăzi mai curat și capturile de magazin corectate (D13, D14).** Alerta integrată în erou, data pe o linie, o singură propoziție sub cifră, apoi capturile refăcute cu salarii în zile diferite și o zi fără contradicția „7 zile / 1 zi”. (S)

---

## 6. Ce e deja foarte bine

- Cifra zilei e acum de încredere: aceeași valoare peste tot și o cascadă care o explică corect.
- Detaliul plicului (burn-down, tranșele S1–S5, „Mai ai nevoie de bani 18 zile…”) e cel mai bun ecran din aplicație.
- Notează: sumă întâi, „Folosit recent”, modal pe desktop, bară de „Anulează” după salvare.
- Stările goale („Trei pași și cifrele devin ale tale”, „Așază primii lei într-un plic”) și prima pornire cu 3 intenții.
- Navy cu auriu și Întunecat cu mint sunt coerente, fără roșu ilizibil.
- Bara laterală de pe desktop este clară și are „+ Notează” sus.
- „Închide anul” este explicat simplu și are un singur buton.

---

## 7. Numărătoare

| Prioritate | Număr | Constatări |
|---|---|---|
| P0 | 0 | — |
| P1 | 4 | D1, D2, D3, D4 |
| P2 | 11 | D5–D15 |
| P3 | 7 | D16–D22 |
| **Total** | **22** | |
