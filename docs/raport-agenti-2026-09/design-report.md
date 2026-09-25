# Buget Familie: critică de design și direcție de redesign

**Perspectivă:** designer senior de produs și UI pentru aplicații mobile de finanțe (YNAB, Monzo, Revolut, Wallet).
**Metodă:** am rulat aplicația local (http://127.0.0.1:5174), cu o familie realistă: Andrei și Maria, 2 salarii (5.200 și 3.400), 7 plicuri (unul săptămânal), 3 surse de plată, 2 datorii, 2 obiective, 3 scadențe și 4 luni de istoric. Am făcut capturi la 390×844 și 1280×800, în temele `white`, `dark` și `navy`, plus contrast ridicat. Am inclus first-run, „Vreau ca aplicația să-mi împartă salariul” și modul „Telefonul lui Ana”. Am mai măsurat țintele de atingere, textul mic și fonturile efectiv randate, și am parcurs CSS-ul din `client/src`.

Capturile sunt în `scratchpad/agents/design/` (cale absolută: `/tmp/claude-0/-home-user-buget-familie/6251941a-2f52-5fdd-bb21-2d9641b66e0b/scratchpad/agents/design/`). Numele urmează tiparul `<ecran>-<temă>-<lățime>-<segment>.png`. Scripturile de captură se pot rerula: `cap.mjs`, `env2.mjs`, `onb.mjs`, `measure.mjs`.

---

## 1. Rezumat

**Nota generală: C+ (6/10).**

Fundația de produs e foarte bună și rară pe piață. „Poți folosi azi X RON” e un erou excelent, iar tranșele săptămânale sunt o idee bună. Plicurile explică „de ce”, ghidul lucrează offline, iar modul „Telefonul lui X” e un diferențiator real. Temele dark și navy au caracter.

Execuția vizuală e însă fragmentată. Designul a crescut prin straturi de „pass”-uri: **117 fișiere CSS, ~20.300 de linii, 2.403 `!important`, `--cf-primary` redefinit de 20 de ori**. Rezultatul: carduri în carduri, prea mult text explicativ, mesaje contradictorii între ecrane și câteva buguri vizuale evidente.

Ecranul **Plan** are 12.300 px de scroll pe mobil, adică ~16 ecrane. Ecranul **Mișcări** arată ~2 tranzacții pe ecran.

### Cele mai mari 5 câștiguri, în ordinea impactului

1. **Reparați stiva de fonturi (bug, efort de o zi).**
   - `fonts-local.css` declară sub același nume `"IBM Plex Sans"` trei fonturi diferite: IBM Plex Sans (400–700), **IBM Plex Serif** 600/700 și **Outfit** 400–700.
   - De aceea unele cifre ies aleator cu serif: „320” în tranșe, totalurile pe zi din Mișcări, „237,70 RON” pe plic. Pe Mișcări, 61 de noduri text sunt randate în IBM Plex Serif.
   - În plus, `font-display: optional` face ca la prima încărcare (onboarding, modul membru) textul să apară în fontul de sistem, adică DejaVu sau Arial. Vezi `onb4-after-white.png` și `member-white.png`.
   - Fix: o familie reală de sans (Plex Sans sau Inter) cu `font-variant-numeric: tabular-nums` pentru toate sumele, plus Fraunces doar pentru H1. Folosiți `font-display: swap` și preload pe fișierul latin-ext.
2. **Plan: din „ecran de 16 pagini” în „listă de plicuri + foaie de editare”.**
   - Formularul „Adaugă plic” are ~12 câmpuri și stă inline *înaintea* listei de plicuri.
   - Suma nerepartizată apare de 3 ori: în header, în „Repartizare ghidată” și în „Repartizare lunară”.
   - Fix: lista de plicuri în primul ecran; restul în bottom sheet-uri sau sub-pagini (detalii în §2 și §3).
3. **O singură sursă de adevăr pentru „cât pot cheltui”.**
   - Astăzi spune „Poți folosi azi 35,50 RON” și, în aceeași frază, „din 1.315,50 rămași… pe 5 zile”. Asta înseamnă 263 RON/zi, cifră pe care o arată și cardul Mâncare.
   - Utilizatorul vede două cifre care se contrazic. Dacă 35,50 include compensarea pentru Transport depășit, spuneți asta explicit și vizual: „263 − 227 acoperă Transport depășit = 35,50”, cu un mini-waterfall.
4. **Navigație desktop dublă și shell nefolosit.**
   - La 1280 px apar *simultan* tabs sus și dock jos. Vezi `today-white-1280-0.png`.
   - Conținutul e o coloană de ~1.050 px întinsă. Fix: la ≥1024 px un sidebar stâng și un layout în 2 coloane (§3).
5. **Densitate și ierarhie pe Mișcări și Astăzi.**
   - Mișcări: fiecare zi e un card în card în card, cu buton „Șterge” permanent pe fiecare rând.
   - Astăzi: 9 carduri de „acțiuni” în stivă (backup, transfer, reconciliere, scadență întârziată, 2 detectări de abonamente, bilanț…).
   - Fix: rânduri de listă plate de 56–64 px, ștergere prin swipe sau în detaliu, și un singur „inbox” colapsabil pe Astăzi.

---

## 2. Probleme vizuale și de UX pe fiecare ecran

> Legendă severitate: 🔴 blocant sau bug vizibil · 🟠 ierarhie sau claritate · 🟡 finisaj

### 2.1 Astăzi

Capturi: `today-white-390-0..3.png`, `today-dark-390-0/1.png`, `today-navy-390-0.png`, `today-white-1280-0.png`

| # | Ce e greșit | Fix concret |
|---|---|---|
| 🔴 | „35,50 RON azi” contrazice textul de dedesubt („1.315,50 rămași… pe 5 zile” = 263/zi) și cardul Mâncare („cel mult 263,10 RON pe zi”). | O singură formulă, cu explicație expandabilă: „263 ritm − 227,50 recuperăm Transport = **35,50**”. Pe ecran apare o bară stacked mică. |
| 🔴 | „Bilanțul săptămânii” e lipit de propoziția următoare („săptămâniiMută lei…”) și centrat pe 2 rânduri inegale (`today-white-390-2.png`). | Titlul și corpul în elemente block separate, aliniate la stânga, cu un CTA „Mută lei” în loc de text. |
| 🟠 | Data e stivuită pe 3 rânduri în colțul eroului („25 / SEPTEMBRIE / 2026”), iar zona dintre badge și „Poți folosi azi” rămâne goală (~90 px). | O singură linie „Vineri, 25 sept.” lângă badge. Eroul urcă cu 100 px și tranșele intră above-the-fold. |
| 🟠 | Chip-urile zilelor (VIN 36 / SÂM 320…) au cifra în serif, din cauza bugului de font, iar mini-barele verticale nu au scală: 36 vs 320 arată la fel de plin. | Sans tabular. Bara arată *procentul din ziua respectivă*. Ziua curentă e evidențiată cu un contur, nu cu un bloc plin. |
| 🟠 | 9 carduri de acțiune în stivă, fiecare cu alt stil: chenar verde, bară laterală, fundal gri, text 9,6 px la „Pare abonament”. | Un card „De rezolvat (5)” cu rânduri uniforme (icon, titlu, CTA). Primele 2 sunt vizibile, restul sub „Vezi toate”. Backup-ul intră în Setări sau într-un toast unic. |
| 🟠 | Cardul „Plic depășit” e un banner persistent deasupra eroului, care concurează cu cifra principală. | Integrat în erou ca linie de status („⚠ Transport depășit cu 288 RON · Rezolvă”). |
| 🟡 | „Notează” e un buton de 60 % lățime, ne-aliniat cu nimic. Pe desktop e un pill de 500 px. | Pe mobil un FAB sau un buton în dock (vezi §3). În erou, CTA full-width sau deloc. |
| 🟡 | În „Ultimele mișcări”, suma atinge marginea dreaptă a cardului (fără padding), iar titlul secțiunii are o iconiță pătrată fără sens. | Padding simetric de 16 px. Titlul secțiunii fără icon. |
| 🟡 | Logo-ul (plicul) stă într-o dală crem care, în dark și navy, strălucește ca o gaură luminoasă. | Variantă monocromă sau „on-dark” a mărcii, cu fundal `--surface-2`. |

### 2.2 Mișcări

Capturi: `miscari-white-390-0..2.png`, `miscari-navy-390-0.png`, `miscari-white-1280-0.png`

| # | Ce e greșit | Fix concret |
|---|---|---|
| 🔴 | Pe desktop, header-ul sticky al zilei („Astăzi −284,50”) acoperă rândul Lidl (`miscari-white-1280-0.png`). | `top` al header-ului sticky calculat din înălțimea reală a app-bar-ului: `--appbar-h`. |
| 🔴 | Ierarhie de 3 containere (secțiune › card-zi › card-rând) și un buton Șterge de 44×44 pe fiecare rând. Rezultă ~2 tranzacții pe ecran. | Listă plată: separator de zi sticky (text 13 px, total la dreapta) și rânduri de 60 px. Ștergerea se face prin swipe-left cu Undo, sau în foaia de detaliu. Țintă: 8–9 rânduri pe ecran. |
| 🟠 | Două controale segmentate (Toate/Ieșiri/Intrări și Toate/Comune/Personale), plus căutare, plus „Filtre”, plus o bandă de 7 zile: ~420 px de filtre înainte de date. | Căutare și un buton „Filtre (2)” care deschide o foaie. Chip-urile active apar orizontal sub căutare. Banda de zile devine un „jump to date”. |
| 🟠 | Totalul zilei „−38 RON” vs rândul „−38,00 RON”: formate diferite, fonturi diferite (serif vs sans). | Același formatter peste tot. Zecimalele se ascund doar când sunt ,00, consecvent. |
| 🟡 | Metadatele se taie („Andrei · Card BT · Alimente · …”). | 2 linii: categorie și plic pe linia 1, persoană și sursă pe linia 2 (sau avatar). Iconița de categorie o înlocuiește pe cea generică. |
| 🟡 | Căutarea din desktop are chenar dublu (input în input). | Un singur câmp. |

### 2.3 Plan (inclusiv carduri de plic expandate)

Capturi: `plan-white-390-0..4.png`, `envlist-white-390-0.png`, `env0..6-white-390.png`, `envcard-open-white-390.png`, `envfood-open-white-390.png`, `plansec-*.png`, `planenv-dark-390-*.png`, `plan-white-1280-0.png`

| # | Ce e greșit | Fix concret |
|---|---|---|
| 🔴 | **12.300 px de scroll.** Ordinea: explicație, progres, „Pornește rapid”, 2 acordeoane fără chevron, tranșa curentă, perioada, checkbox nestilizat, repartizare ghidată, **formular de 12 câmpuri**, abia apoi lista de plicuri, transfer, „Ce plătim lunar”, repartizare lunară, instrumente. | Structură nouă: **(1) antet** „Nerepartizat X · Repartizează”, **(2) lista de plicuri** grupată (Fixe / Variabile / Economii), **(3) „+ Plic”** care deschide o foaie. Ritm, perioadă, „Ce plătim lunar”, ritual și istoric trec într-un meniu „⋯” al paginii sau în sub-pagina „Configurare plan”. |
| 🔴 | Butonul „Mută 505,16 RON în săptămânile următoare” e strivit într-o cutie de ~60 px, cu text pe 4 rânduri (`envfood-open-white-390.png`). | Buton full-width, secundar, cu textul „Mută 505 RON mai departe”. |
| 🔴 | Checkbox-ul „Am venituri neregulate (PFA, freelancer)” e nativ, de 13×13 px, cu textul lipit de descriere (`plan-white-390-1.png`). | Componentă `Switch` cu rând de 56 px: etichetă și descriere pe două linii. |
| 🔴 | Status contradictoriu pe același plic: „ÎN PLAN” + „ÎN URMĂ · 32 % AȘTEPTAT”; „APROAPE DE LIMITĂ” + „DEPĂȘIT”. Rata casei, plătită integral (1.900/1.900), apare ca *depășită/avertisment*. | Un singur chip de stare. Stările sunt diferite pentru plicurile *fixe* (Neplătit / Plătit ✓) și cele *variabile* (În ritm / Atenție / Depășit). |
| 🟠 | Cardul de plic: numele în stânga, suma serif în dreapta, apoi 2 casete de proză (~60 de cuvinte), bara „TOT PLICUL” care arată *cheltuitul*, în timp ce cifra mare arată *rămasul*. Ochiul face zig-zag. | Anatomie nouă (vezi mai jos). |
| 🟠 | Ilustrația-plic are un badge „OK / ! / X” de ~10 px suprapus. Pe cardurile roșii, banda colorată de sus taie ilustrația. | Plicul devine *indicator de umplere*, fiecare stare cu icon și culoare. Badge-ul se scoate. |
| 🟠 | Edit și Șterge (roșu) sunt permanente pe fiecare plic. | Tap pe card deschide detaliul. Edit și Șterge stau în foaia de detaliu sau într-un meniu „⋯”. |
| 🟠 | Acordeoanele „Alege ritmul casei.” și „Unelte: propunere, simulare, ghid” nu au chevron și arată ca niște carduri goale. | Toate `summary`-urile folosesc componenta `Disclosure` (chevron de 20 px, rotație animată). |
| 🟠 | Pill-ul „7 plicuri · 8.600 RON” are jumătatea stângă goală (un slot fără conținut). | Eliminat sau completat cu o mini-bară segmentată de repartizare. |
| 🟡 | Selectul „Membru” e mai înalt decât „Plătit din”, iar grila formularului e neregulată. | Toate câmpurile au 48 px și grilă de 2 coloane cu gap de 12 px. |
| 🟡 | Desktop: inelul decorativ din header iese peste cardul următor (`plan-white-1280-0.png`). | `overflow: clip` pe hero. |
| 🟡 | 129 de noduri text sub 12 px pe Plan (40 la 9 px). | Minimum 12 px, iar 13 px pentru meta. |

**Anatomie propusă pentru cardul de plic (închis, 88–96 px):**

```
[●] Mâncare                               1.315 RON
    săpt. S2 · 284 / 1.600      ▓▓▓▓░░░░░░  rămas
    Chip: În ritm   ·  ~263 RON/zi
```

Expandat sau în detaliu: burn-down (vezi §7), tranșe S1–S5 ca bandă orizontală, „Pe luni” ca sparkline cu 6 bare, iar Edit și Mută bani ca acțiuni.

### 2.4 Obligații

Capturi: `obligatii-white-390-0..2.png`, `obligatii-navy-390-1.png`, `obligatii-white-1280-0.png`

| # | Ce e greșit | Fix concret |
|---|---|---|
| 🔴 | RCA (anuală) apare sub „ABONAMENTE · În fiecare lună” cu textul „în fiecare lună · Ziua 5”. E eroare de conținut. | Grupare pe frecvență, sau badge „anual · 5 mar.”. |
| 🟠 | Tabelul de abonamente are suma în stânga și numele în dreapta: aliniere inversată față de restul aplicației. | Nume în stânga, sumă în dreapta (tabular), iar ziua ca meta. |
| 🟠 | Totalurile („Sold datorii 21.700”, „Economii 6.000”) stau la *finalul* paginii. | Un header de rezumat: „Luna asta: 1.050 RON de plătit · 1 întârziată”, plus un inel sau o bară. |
| 🟠 | Lista nu are ritm temporal: întârziat, apoi 3 oct., 12 oct., 15 oct., iar obiectivele pe 2027 sunt amestecate cu ratele. | Secțiuni „Întârziate / Săptămâna asta / Luna asta / Mai târziu”. Obiectivele au tab-ul sau segmentul lor. |
| 🟠 | Butoanele „Confirmă plata” au iconița *deasupra* textului, iar rândurile de rate 1–5 au ținte de 32×32. | Icon inline, înălțime 44 px, iar chip-urile de rate au minimum 44×44. |
| 🟡 | „Simulează o plată în plus” e un card-acordeon fără chevron, iar iconița de clopoțel e folosită pentru datorii. | `Disclosure` standard. Icon distinct pentru rată (card sau bancă). |

### 2.5 Analiză (Istoric, „Pe luni”, distribuție)

Capturi: `analiza-white-390-0..4.png`, `analiza-navy-390-1.png`, `analiza-navy-1280-0.png`

| # | Ce e greșit | Fix concret |
|---|---|---|
| 🔴 | 5 straturi de filtre (tab Istoric/Gospodărie/Asistent, select lună, Lună calendar/Ciclu, Familie/Andrei/Maria, Toate/Comun/Personal) ocupă ~500 px înainte de prima cifră. | Un rând sticky: „‹ Sept. 2026 ›” cu un chip „Familie ▾” care deschide o foaie cu toate opțiunile. |
| 🟠 | Donut-ul folosește 3 verzi și 3 maronii foarte apropiate: „Alimente” se confundă cu „Casă & facturi”, iar „Rate produse” cu „Transport”. | Paletă categorială validată (8 culori, ΔE > 20, sigură pentru daltonism), fixă pe categorie în toată aplicația. Vezi §7. |
| 🟠 | Aceeași informație apare de 3 ori: donut, legendă în grilă, „categoria selectată” și listă cu bare. | Donut cu legendă directă (top 5 + „Altele”), apoi lista cu bare. Selecția e doar un highlight. |
| 🟠 | „Ritm lună cu lună” e un grafic îngust (~40 % din lățime). Etichetele „M I I A S” sunt ambigue (iunie/iulie), barele au 16 px și nu poți atinge o lună. | Grafic full-width, cu etichete „mai iun iul aug sep”. Barele grupate venit/cheltuieli au ≥ 24 px, iar tap-ul afișează valoarea. Linia pentru „economisit” e opțională. |
| 🟠 | „Luna rămâne în echilibru” (verde) apare pe același ecran cu „Decizie necesară: un plic a trecut peste limită”. | Mesaj de sinteză unic, prioritizat: întâi riscul, apoi rezultatul. |
| 🟡 | În celulele de statistică (Mișcări 13 / Cheltuieli 4.057,29 RON / De revizuit 4), numărul atinge separatorul. | Grilă 3 col. cu padding de 12 px. Sumele mari sunt compacte („4,06k”) sau pe rând propriu. |
| 🟡 | Header-ul „Înțelege schimbarea.” e un card decorativ de 150 px fără informație. | Eliminat. Titlul paginii intră în app-bar. |

### 2.6 „Mai mult”, Setări, Aspect

Capturi: `mai-white-390-0/1.png`, `setari-white-390-0..4.png`, `aspect-white-390-0..2.png`

| # | Ce e greșit | Fix concret |
|---|---|---|
| 🟠 | „Mai mult” e o pagină, nu o foaie. Fiecare rând are o bară colorată în stânga și stă în card în card, cu headere-pill. | Listă grupată iOS/Material: titlu de grup de 13 px, apoi rânduri de 56 px într-un singur container. Fără barele laterale. |
| 🟠 | În Setări, header-ul „Mai mult” se repetă, apoi „Înapoi la instrumente”. Chevron-ul din „Deschide tutorialul ›” cade pe rândul următor. | App-bar cu „‹ Setări”. Rândurile de navigare au chevron la dreapta. |
| 🟠 | În Aspect, tema cere „Aplică”, dar fundalul se aplică instantaneu (textul chiar o recunoaște). | Totul se aplică instant, cu preview live și „Anulează” 5 s. Sau totul trece prin „Aplică”. |
| 🟠 | Contrastul extra-ridicat e îngropat la finalul foii, iar vizual schimbă foarte puțin (`planenv-dark-hc-390-0.png` vs non-HC). | Secțiune „Accesibilitate” separată, sus în Setări (§8). |
| 🟡 | Checkbox-ul „Copil” are 17×17 px, iar „Șterge membrul” 32×32. | Rând de membru: avatar, nume și meniu „⋯”. Rolul se alege într-o foaie. |

### 2.7 Ghid / asistent

Captura: `ghid-white-390-0.png`

- 🟠 Bara „100/100 azi” arată ca o bară de progres și pare un scor. Fix: text meta „100 întrebări rămase azi” sau ascunsă până la <20.
- 🟠 Chip-urile de sugestie sunt tăiate la dreapta, fără indiciu de scroll. Fix: fade-mask pe margine sau wrap pe 2 rânduri.
- 🟡 Primul mesaj amestecă 2 alerte într-o frază. Fix: carduri-răspuns structurate (alertă, apoi acțiune), cu butoanele „Deschide plicul” și „Confirmă plata”.
- 🟡 Iconița de robot e generică. Fix: o variantă a mărcii-plic („plicul care vorbește”) ca avatar al ghidului, pentru identitate.

### 2.8 Notează (modal de captură)

Capturi: `noteaza-white-390-0.png`, `noteaza-dark-390-0.png`

- 🔴 **Ordinea e inversă.** Categoria (grilă de 8), recentele, *apoi* suma. Aplicațiile rapide (Wallet, Monzo, Spendee) pun **suma sus, mare (40 px), cu tastatura numerică deschisă automat**. Fix: sumă (autofocus), comerciant (autocomplete care alege categoria), categoria ca un chip pre-selectat modificabil, apoi Gata. Un singur ecran, fără scroll.
- 🟠 „Cheltuială” e un segment **roșu**: culoarea de alarmă pentru acțiunea normală. În dark, segmentul e mint cu contur coral. Fix: segmentul folosește culoarea primară neutră, iar roșul rămâne doar pentru depășiri.
- 🟠 Două rânduri „Folosite recent”, unul pentru categorii și unul pentru sume. Fix: un singur rând „Repetă: Lidl 284,50 · Bolt 38”, cu tranzacții întregi.
- 🟡 „Consumabile copil” trece pe 2 rânduri. Iconița „+” de la „Adaugă notiță…” e despărțită de text.

### 2.9 Căutare / acțiuni rapide

Captura: `quick-white-390-0.png`

- 🟡 Toate mișcările recente au aceeași iconiță „document”, deși Mișcări folosește iconițe de categorie. Fix: aceeași componentă `TxRow` peste tot.

### 2.10 First-run și „Vreau ca aplicația să-mi împartă salariul”

Capturi: `onb0-white.png`, `onb1-dark.png`, `onb1b-white.png`, `onb2-white.png`, `onb3-white.png`, `onb4-after-white.png`

- 🔴 Pe prima încărcare, fontul cade pe fontul de sistem (DejaVu): titluri și butoane în alt font decât restul aplicației. Cauza e `font-display: optional` (vezi Rezumat #1).
- 🟠 Nu există indicator de progres pe pașii 1–2 (doar „Pasul 3 din 3” apare vizibil). Fix: un stepper cu 3 segmente sus, sticky.
- 🟠 „Înapoi” e dublat (sus și jos), iar titlul pasului 1 alunecă sub bara sticky (`onb1b`). Fix: „‹” sus, CTA primar jos și titlul în afara zonei de scroll.
- 🟠 Pasul 2 e o listă lungă de checkbox-uri de 58 px, fără sume sugerate. Fix: chip-uri „Chirie · Rată · Lumină…” care, la tap, se transformă în rânduri cu sumă. Sumele se pre-completează din medii RO (editabile).
- 🟠 După „Gata”, utilizatorul ajunge pe Plan cu „0 RON nerepartizați · 0 %” și „Totul are un loc.” Pe ecran nu vede plicurile tocmai create. Fix: un ecran de **succes** („Am creat 5 plicuri pentru 8.600 RON”) cu previzualizarea împărțirii (bară stacked animată), apoi Astăzi.
- 🟡 Cele 4 intenții de start au titluri în serif bold, lungi. Fix: carduri cu ilustrație mică, titlu scurt („Împarte salariul”, „Doar notez”, „Vreau să văd”) și subtitlu.

### 2.11 Modul „Telefonul lui X”

Captura: `member-white.png`

- 🟠 Ecranul e nestilizat: font de sistem, fără card, dock gol vizibil jos și „Ieși din modul acesta” ca link albastru implicit.
- 🟠 Copy: „Telefonul lui Ana” trebuie să fie „Telefonul Anei”. Genitivul feminin trebuie tratat (sau formularea „Telefonul: Ana”).
- 💡 Oportunitate: un ecran „copil/adolescent” vesel, cu un plic mare ilustrat care se golește, cifra zilei, un buton mare „Am cheltuit” și istoric de 3 rânduri. Ieșirea se face prin long-press, cu PIN.

---

## 3. Navigație și meniu

### Starea actuală

- Dock-ul de jos are 5 taburi: Astăzi, Mișcări, Plan, Obligații, Analiză.
- Sus-dreapta e un pill cu 3 iconițe (căutare, „⋯” = Mai mult, ghid).
- „Notează” nu are un loc fix. E în erou, pe Astăzi, e un „+” pe Mișcări și un link în căutare.
- Pe desktop apar tabs sus *și* dock jos.
- Taburile „Obligații” și „Analiză” sunt consultative. „Notează”, cea mai frecventă acțiune, e ascunsă.

### Structura propusă (mobil)

```
┌──────────────── App bar ────────────────┐
│ [Titlu ecran]              [🔍] [👤/⚙]  │   ← avatar familie → Setări/Membri/Sync
└─────────────────────────────────────────┘
Dock (4 + acțiune centrală):
  Astăzi · Plicuri · [ ＋ Notează ] · Mișcări · Mai mult
                     (FAB 56px, long-press = venit/transfer/bon)
```

- **Astăzi:** cifra zilei, inbox-ul „De rezolvat” și următoarele 3 scadențe (preview din Obligații).
- **Plicuri** (fost Plan): lista de plicuri, cu „Repartizează” și „Configurare” în „⋯”.
- **＋ Notează:** acțiunea principală, mereu la un deget distanță.
- **Mișcări:** jurnalul și căutarea.
- **Mai mult:** foaie (bottom sheet la 60 %) cu grupe.
  - **Bani:** Obligații și scadențe, Obiective, Datorii, Analiză.
  - **Cumpărături:** Bonuri, Catalog, Prețuri, Reguli comerciant.
  - **Familie:** Membri, Telefonul lui X, Sincronizare.
  - **Aplicație:** Aspect, Accesibilitate, Limbă, Backup, Ghid, Tutorial, Feedback.

De ce Obligații și Analiză ies din dock: Obligații e surfațat pe Astăzi (următoarele plăți) și are badge în „Mai mult”. Analiza e lunară, nu zilnică: YNAB ține „Reflect” în afara fluxului zilnic, iar Monzo ține „Trends” sub un card. Dacă datele de uz arată altfel, alternativa e dock-ul Astăzi · Plicuri · ＋ · Mișcări · Analiză, cu Obligații pe Astăzi.

**Ghidul** devine un buton contextual („Întreabă”) în app-bar sau un chip pe Astăzi, nu un al treilea icon permanent. Pe desktop devine un panou lateral drept.

### Desktop (≥ 1024 px)

- Sidebar stâng de 240 px (marcă, cele 5 destinații, grupele „Mai mult” colapsate) și **fără dock**.
- Astăzi pe 2 coloane: erou și tranșe în stânga (7/12), inbox și scadențe în dreapta (5/12).
- Plicuri ca listă master-detail: plicul selectat se deschide în panoul din dreapta.
- Mișcări ca tabel dens, cu filtre în panou lateral.

### Reguli de navigație

- Un singur tip de „înapoi” (chevron în app-bar). Fără butoane „Înapoi la instrumente” în conținut.
- Foile (bottom sheets) primesc handle, titlu, butonul ✕ la 44 px și swipe-down, cu snap la 50 % și 92 %.
- Deep-link-urile din alerte („Vezi” la Plic depășit) deschid *direct* plicul, cu highlight de 1,2 s.

---

## 4. Sistem vizual

### 4.1 Tipografie (scară unică, 7 trepte)

| Token | Mărime / line-height | Font | Folosire |
|---|---|---|---|
| `--t-display` | 44/48, -0.03em | Plex Sans 600, tabular | cifra zilei, sold erou |
| `--t-h1` | 28/34 | Fraunces 600 | titlu de ecran (doar unul pe ecran) |
| `--t-h2` | 20/26 | Plex Sans 600 | titlu de card sau secțiune |
| `--t-body-lg` | 17/24 | Plex Sans 500 | nume de plic, titlu de rând |
| `--t-body` | 15/22 | Plex Sans 400 | text |
| `--t-meta` | 13/18 | Plex Sans 400 | metadate, etichete |
| `--t-overline` | 12/16, +0.06em, uppercase | Plex Sans 600 | kicker (rar) |

- **Interzis sub 12 px.** Acum există 8, 9, 9,6, 10, 10,4 și 11 px: ~180 de apariții în CSS și 129 de noduri doar pe Plan.
- Toate sumele folosesc `font-variant-numeric: tabular-nums`. Moneda apare la 0,6× din mărime, cu aceeași greutate, iar „RON” vs „lei” se alege consecvent (acum ambele sunt amestecate).
- Serif (Fraunces) **doar** pentru H1 și ilustrativ. Scoateți-l din sume, totaluri de zi și titluri de card. Serif-ul în cifre scade lizibilitatea și sugerează „bug”.
- Kicker-ele uppercase cu tracking sunt acum pe aproape fiecare card („PE SCURT”, „CATEGORII”, „ACUM · TRANȘA S2”, „REPARTIZARE GHIDATĂ”…). Păstrați-le la maximum unul pe ecran.

### 4.2 Culoare: tokenuri semantice

Acum `--cf-*` și `--bf-*` sunt definite în zeci de fișiere, iar `--cf-primary` are 20 de definiții. Propunere: 3 straturi.

```css
/* 1. primitive (per temă) */
--pine-50…900; --honey-50…900; --coral-50…900; --ink-0…1000;
/* 2. semantice (singurele folosite în componente) */
--bg, --surface-1, --surface-2, --surface-sunken,
--text, --text-muted, --text-on-accent,
--accent, --accent-strong, --accent-soft,
--line, --line-strong, --focus,
--pos (venit/în ritm), --warn (atenție), --neg (depășit/întârziat), --info
/* 3. categorii (fixe, în toate temele, ajustate pe luminanță) */
--cat-1 … --cat-8, --cat-other
```

- **Roșu doar pentru „depășit/întârziat”**, nu pentru toate cheltuielile. Acum „−4.057,29 RON” ieșit, fiecare sumă din Mișcări și segmentul „Cheltuială” sunt roșii. YNAB și Monzo afișează cheltuielile în culoarea textului neutru, iar venitul în verde.
- **Culoarea de categorie** e asociată stabil: Mâncare are mereu aceeași nuanță în donut, rând, chip și plic. Asta înlocuiește maronii și verzii care se confundă.

### 4.3 Spațiere, raze, elevație

- Spațierea urmează o grilă de 4: 4 / 8 / 12 / 16 / 24 / 32 / 48. Gutter-ul pe mobil e de 16 px (acum 14–32 între ecrane).
- Raze: 8 (chip), 12 (câmp, buton), 16 (card), 24 (foaie). Acum sunt ~10 valori diferite.
- Elevație: 3 niveluri: `flat` (bordură 1 px), `raised` (card) și `overlay` (foaie sau meniu). **Carduri în carduri sunt interzise.** Un card conține rânduri, nu alte carduri. Asta rezolvă Mișcări, Mai mult, Setări și Plan.
- Accentele de bară laterală stângă (2–4 px) apar pe Mai mult, Mișcări, Astăzi și Analiză. Rezervați-le doar pentru stări (întârziat).

### 4.4 Componente de unificat (inventar țintă)

`AppBar`, `Dock`, `Sheet`, `Card`, `ListGroup`, `ListRow` (icon, titlu, meta, trailing), `TxRow`, `EnvelopeRow`, `Amount` (formatare, semn, culoare), `StatusChip` (4 stări, fiecare cu icon), `Meter` (bară liniară cu marker „azi”), `Segmented`, `Switch`, `Disclosure` (cu chevron), `Field` / `Select` (48 px), `EmptyState`, `Toast` (cu Undo), `InboxItem`.

Fiecare are o singură foaie CSS, iar pass-urile istorice (atelier-*, *-pass.css, *-fix.css) se consolidează. Ținta: sub 25 de fișiere CSS și `!important` sub 50.

### 4.5 Iconografie și marca-plic

- Iconițele sunt Lucide-like, cu linie de 1,75 px, la 20 px în rânduri și 24 px în dock. Pentru categorii folosiți un set dedicat (coș, casă, autobuz, biberon, inimă, bilet, card), pe `--cat-n` la 12 % opacitate.
- Marca-plic e frumoasă, dar e folosită ca ilustrație statică de 48 px peste tot. Propunere: **plicul ca metaforă vie**.
  - Pe cardul de plic, în locul badge-ului „OK / ! / X”, plicul are o „umplere” care scade cu rămasul.
  - Clapa se închide când plicul e gol.
  - Sigiliul capătă culoarea stării.
  - Iconul aplicației și logo-ul au o versiune monocromă pentru dark, navy și HC.

### 4.6 Empty states

Acum, în starea goală, apar cifre de 0 („0 RON nerepartizați · 0 %”, „Totul are un loc.”) care sună a succes.

Fiecare ecran primește un `EmptyState`: ilustrație-plic de 96 px, o propoziție și un CTA.

- **Plicuri:** „Niciun plic încă” și „Împarte salariul”.
- **Mișcări:** „Nimic notat azi” și „＋ Notează”, plus „Importă extras”.
- **Obligații:** „Nicio plată programată” și „Adaugă o rată sau factură”.
- **Analiză:** sub 2 săptămâni de date, „Revin cu grafice după primele 14 zile”, cu un placeholder schelet.

---

## 5. Teme

| Temă | Verdict | Motiv și îmbunătățiri |
|---|---|---|
| **Alb (Platinum)** | Păstrează, ca implicită | Se citește bine. Reduceți textura grilă din erou (zgomot sub cifre) și unificați nuanțele de verde. |
| **Întunecat (verde)** | Păstrează | Contrast bun, CTA mint foarte vizibil. Logo-ul crem și butonul „Cheltuială” coral+mint trebuie corectate. Suprafețele pot folosi `#121614` / `#1A1F1C` / `#232A26` pentru straturi mai clare. |
| **Navy (auriu)** | Păstrează, ca temă „premium” | Cea mai distinctă. Auriul pe CTA e excelent. Verificați auriul pe text mic (kicker 12 px): contrastul e la limită, așa că folosiți auriu deschis `#E6C27A` pentru text. |
| **Aurora, Cyber** | Tăiați definitiv | Sunt deja ascunse (`visibleThemeOptions`), dar CSS-ul lor e încă livrat. Eliminați codul. |
| **Fundaluri** (Lumină curată, In, Hartă, Auroră, Ceață) | Reduceți la 2 | „Curat” și „Hârtie”. Texturile se luptă cu datele, iar „Auroră profundă” pe alb e în afara brandului. |
| **Contrast extra-ridicat** | Refaceți ca mod, nu ca toggle cosmetic | Acum diferența e aproape invizibilă. HC trebuie să aibă text 100 % ink, linii de 2 px, fără texturi, fără transparențe, focus ring de 3 px și toate stările cu icon și subliniere. Declanșare automată pe `prefers-contrast: more` și `forced-colors`. |
| **Auto zi/noapte** | Păstrează | Adăugați opțiunea „Urmează sistemul” (`prefers-color-scheme`) ca implicit, cu orarul ca opțiune avansată. |

**Idei noi**

- **„Calm / Sepia”**: hârtie caldă cu contrast redus, pentru seara în pat. Ar putea înlocui textura „In de registru”.
- **„Copil”** (doar pentru modul membru): culori saturate prietenoase și plic ilustrat mare.
- **Accent personalizabil** pe membru (Andrei = pin, Maria = prună). Colorează avatarele și filtrele „Personal”, nu UI-ul întreg.

---

## 6. Animații și micro-interacțiuni

Toate folosesc doar `transform` și `opacity`, pot fi întrerupte și sunt dezactivate sub `@media (prefers-reduced-motion: reduce)`: durata trece la 0 ms, iar numărătorile arată direct valoarea finală.

Tokenuri propuse:

```css
--ease-out: cubic-bezier(.2,.8,.2,1);
--ease-emph: cubic-bezier(.3,1.3,.5,1);   /* doar confirmări */
--ease-in-out: cubic-bezier(.4,0,.2,1);
--dur-1: 120ms; --dur-2: 200ms; --dur-3: 320ms; --dur-4: 480ms;
```

| Moment | Animație | Durată / easing |
|---|---|---|
| Apăsare buton sau rând | scale 0,97 și overlay | 120 ms `--ease-out`, revenire 160 ms |
| Deschidere foaie (Notează, Mai mult) | translateY 100 % → 0, cu backdrop 0 → 40 % | 320 ms `--ease-out`. Închiderea: 200 ms `--ease-in-out`. Drag urmărit 1:1. |
| Salvare cheltuială („Gata”) | foaia se închide, noul rând intră în listă de sus (translateY −8 px, fade), cifra zilei **numără** de la valoarea veche la cea nouă | 200 ms, apoi rândul 240 ms, count-up 480 ms `--ease-out` |
| Plic: umplere după repartizare | meterul crește de la 0, în cascadă pe carduri (stagger 40 ms) | 480 ms `--ease-out` |
| Aplicare împărțire salariu | bara stacked „8.600 RON” se împarte în segmente care „zboară” în plicuri, cu toast „Anulează” | 600 ms total, max. 6 segmente |
| Depășire plic | un singur „shake” orizontal de 4 px pe chip, la prima apariție; apoi static | 240 ms |
| Confirmare plată | bifă desenată (stroke-dashoffset), apoi rândul colapsează | 320 ms `--ease-emph`, colapsul 200 ms |
| Swipe pe rând (șterge) | acțiunea se revelează progresiv, cu prag haptic la 40 % | 1:1 cu degetul, snap 200 ms |
| Disclosure (chevron) | rotație 180°, conținut cu fade și translateY 4 px | 200 ms |
| Schimbare temă | crossfade pe `color-scheme` prin View Transitions API | 280 ms |
| Tab în dock | indicatorul pill alunecă între taburi (FLIP) | 240 ms `--ease-out` |
| Skeleton la încărcare | shimmer 1,2 s, liniar, doar dacă încărcarea depășește 300 ms | — |
| Haptice (Capacitor) | `light` la salvare, `success` la plată confirmată, `warning` la depășire | — |

---

## 7. Grafice și vizualizări

Principii:

- Fiecare grafic răspunde la o întrebare scrisă în titlu („Ajung banii de mâncare până pe 16?”).
- Etichetele stau direct pe grafic, nu doar în legendă.
- Culorile de categorie sunt stabile.
- Ținte de tap de minimum 24 px pe bare.
- Pentru cititoarele de ecran există un tabel alternativ (sau `aria-label` cu cifre).

| Grafic | Unde | Ce face | Stare |
|---|---|---|---|
| **Burn-down plic** | detaliu plic | Linia ideală (buget → 0 la salariu), linia reală cumulată, punctul „azi” și proiecția punctată. Zona de sub ideal e verde, peste e coral. Răspunde la „se termină pe 6 oct.”, care acum e doar text. | **Nou, prioritar** |
| **Bandă de tranșe S1–S5** | cardul unui plic săptămânal | O bară orizontală cu 5 segmente: fiecare segment umplut proporțional cu cheltuitul, săptămâna curentă conturată și sume sub fiecare segment. Înlocuiește lista text „S4 07 oct.–13 oct. 0 RON…”. | Redesign |
| **Meter plic** | rând de plic | Bară liniară cu *marker vertical „ar trebui să fii aici azi”* (32 % din perioadă). Arată rămasul, nu cheltuitul. Cu textul „32 % așteptat” citit vizual, chip-ul de stare devine redundant. | Redesign |
| **Cashflow calendar** | Obligații / Astăzi | O lună în grilă 7×5: fiecare zi are puncte colorate pentru scadențe, iar salariile apar ca bandă verde. Sub grilă, curba soldului proiectat pe 30 de zile, cu zona sub 0 marcată. | **Nou** |
| **Donut categorii** | Analiză | Maximum 6 felii (top 5 + „Altele”). Culorile vin din `--cat-n`, centrul arată totalul, iar tap pe felie filtrează lista de dedesubt. Legenda-grilă duplicată dispare. | Redesign |
| **Comparație lună vs lună** | Analiză | Bare orizontale pe categorie: luna curentă plină, media ultimelor 3 luni ca *tick*, Δ% la dreapta („Alimente +12 %”). Răspunde la „unde am cheltuit mai mult ca de obicei”. | **Nou** |
| **Ritm lună cu lună** | Analiză | Grafic full-width cu 6–12 luni, bare grupate venit/cheltuieli și o linie pentru economisit. Etichete „ian feb…”, iar tap afișează valorile. | Redesign |
| **Pe luni (plic)** | detaliu plic | Sparkline cu 6 bare verticale și o linie pentru media plicului. Luna curentă e hașurată ca „în curs”. Acum sunt bare orizontale cu etichete gri de 10 px. | Redesign |
| **Waterfall „cifra zilei”** | Astăzi (la „Cum se citește?”) | Ritm plic → minus depășiri de recuperat → minus scadențe → **azi**. Explică vizual cifra de 35,50. | **Nou** |
| **Progres obiectiv** | Obiective | Inel cu ETA („la ritmul actual: iun. 2027”) și marcaj pentru data-țintă. | Redesign |
| **Datorie: payoff** | Datorii | Arie descrescătoare pentru sold în timp, cu 2 scenarii (rata curentă vs +200 RON/lună) și data de final. Înlocuiește „Simulează o plată în plus” ca acordeon textual. | **Nou** |

Implementarea poate folosi SVG inline sau o bibliotecă ușoară (uPlot sau visx). Paleta se validează pentru contrast ≥ 3:1 față de suprafață în toate cele 3 teme.

---

## 8. Accesibilitate

Măsurători la 390 px, tema Alb:

| Ecran | Ținte < 44 px | Text < 12 px |
|---|---|---|
| Plan | **47** (checkbox-uri 13×13, Editează 83×36, Șterge 72×36) | **129 noduri** (40 × 9 px, 31 × 10 px, 58 × 11 px) |
| Obligații | 17 (rate 32×32) | 5 |
| Setări | 16 (checkbox 17×17, șterge membru 32×32) | 23 (16 × 9 px) |
| Analiză | 10 (barele graficului 16 px) | 9 |
| Astăzi | 9 („Vezi” 44×36, „Mai târziu” 71×36) | 2 (9,6 px) |

Recomandări:

1. **Ținte minime de 44×44** (48 în dock), inclusiv chip-uri, bifele de rate, „✕” din alerte și barele din grafice. Pentru elementele mici vizual se poate extinde zona de atingere cu `::after`.
2. **Text minim de 12 px** (13 recomandat pentru meta). Sub `font-size: 200 %` din sistem, layoutul trebuie să rămână utilizabil: testați cu Android „Font size: Largest” și iOS Dynamic Type (Capacitor). Folosiți `rem`, nu `px` fix, și ramificați layoutul pe `min-width` în `em`.
3. **Culoarea nu e singurul semnal.** Stările de plic au deja icon (!, X), dar microscopic. Folosiți chip cu icon de 16 px și text.
4. **Contrast.** Textul gri pe carduri gri (meta de 10–11 px pe `#EEF1EE`) și auriul pe navy la 12 px sunt la limită. Țintă AA de 4,5:1 pentru tot textul < 18 px. Verificați automat cu axe în CI pe cele 3 teme (există deja `scratchpad/audit/axe.mjs`).
5. **Focus vizibil**: inel de 2 px `--focus` cu offset de 2 px, pe toate temele. Checkbox-urile native mici n-au focus coerent.
6. **Cititoare de ecran.**
   - Cifra zilei are `aria-live="polite"` la schimbare.
   - Graficele au `role="img"` și `aria-label` cu datele cheie.
   - Chip-urile zilelor („VIN 36”) au etichete complete („Vineri, 36 RON disponibili”).
   - Denumirile interne apar ca etichete (`Bilanțul săptămâniiMută…` e citit lipit).
7. **Mișcare redusă.** 60 de reguli `prefers-reduced-motion` există, dar sunt împrăștiate. Centralizați-le într-un singur loc, pe tokenurile `--dur-*`.
8. **Limbaj.** Mai puțină proză pe ecran: explicațiile de 40–60 de cuvinte din fiecare card (Plan, plic, Setări) cresc încărcarea cognitivă. Mutați-le în „ⓘ” sau într-o foaie „Cum funcționează”, o singură dată.

---

## 9. Roadmap de design în 3 etape

### Etapa 1: „Igienă” (1–2 săptămâni)

Nu schimbă structura, doar repară și unifică.

- [ ] Stiva de fonturi: o singură familie Sans reală, tabular-nums pe toate sumele, `font-display: swap` și preload. Serif-ul iese din cifre.
- [ ] Bugurile vizibile:
  - header-ul sticky din Mișcări pe desktop;
  - „Bilanțul săptămânii” lipit;
  - butonul „Mută 505 RON” strivit;
  - checkbox-ul „venituri neregulate”;
  - chevron-ul din Setări pe rând separat;
  - pill-ul gol „7 plicuri”;
  - dock-ul dublu pe desktop;
  - RCA marcat „în fiecare lună”.
- [ ] Scara tipografică cu 7 trepte și minimum 12 px. Țintele de atingere la 44 px.
- [ ] Roșul doar pentru depășit sau întârziat. Cheltuielile în ink neutru. Segmentul „Cheltuială” trece pe culoarea neutră.
- [ ] Un singur chip de stare pe plic, cu stări separate pentru plicuri fixe și variabile.
- [ ] Toate `summary`-urile primesc chevron și `Disclosure`.
- [ ] Ștergerea codului pentru Aurora, Cyber și 3 din cele 5 texturi.

### Etapa 2: „Structură” (3–5 săptămâni)

IA nouă și componente unificate.

- [ ] Tokenuri semantice pe 3 straturi. Consolidarea celor 117 CSS-uri în ~20 de foi de componentă, cu `!important` sub 50.
- [ ] Dock nou: Astăzi · Plicuri · ＋ · Mișcări · Mai mult. „Mai mult” devine foaie. Pe desktop, sidebar și layout pe 2 coloane.
- [ ] **Plan → Plicuri:** lista pe primul ecran, formularul „+ Plic” în foaie, configurarea în sub-pagină. Țintă: primul plic vizibil fără scroll, pagina < 3 ecrane.
- [ ] **Mișcări:** listă plată și swipe-to-delete cu Undo. Filtrele stau într-o foaie. Țintă: 8 rânduri pe ecran.
- [ ] **Notează:** sumă-întâi, comerciant cu autocategorie, un singur ecran.
- [ ] **Astăzi:** erou compact, waterfall-ul „cum se calculează”, inbox unic „De rezolvat” și un preview cu următoarele 3 plăți.
- [ ] **Analiză:** un singur rând de filtre, paleta de categorii stabilă, donut simplificat.
- [ ] Onboarding: stepper, sume pre-completate, ecran de succes cu animația împărțirii. Modul membru stilizat, iar copy-ul folosește genitivul corect.
- [ ] Empty states pe toate ecranele.

### Etapa 3: „Încântare și insight” (4–6 săptămâni)

- [ ] Grafice noi:
  - burn-down pe plic;
  - bandă de tranșe;
  - meter cu marker „azi”;
  - cashflow calendar;
  - comparație lună vs lună;
  - payoff pentru datorii.
- [ ] Plicul ca metaforă animată (umplere, clapă, sigiliu în culoarea stării) și icon de aplicație pe variante de temă.
- [ ] Setul complet de micro-interacțiuni din §6, cu haptice pe Capacitor și View Transitions la schimbarea de temă și de tab.
- [ ] Mod HC real, „Urmează sistemul”, temă Sepia/Calm și accent pe membru.
- [ ] Ghidul cu răspunsuri-card acționabile și avatar din marca-plic.
- [ ] Audit a11y automat (axe) și teste de regresie vizuală (Playwright snapshot) pe 3 teme × 2 lățimi × 8 ecrane în CI.

---

### Anexă: indexul capturilor

- Ecranele principale, tema Alb, 390 px: `today|miscari|plan|planenv|obligatii|analiza|mai|setari-white-390-{0..4}.png`, `aspect|ghid|noteaza|quick-white-390-*.png`
- Dark și navy, 390 px: `*-dark-390-{0,1}.png`, `*-navy-390-{0,1}.png`
- Desktop 1280 px: `*-white-1280-{0,1}.png`, `*-navy-1280-{0,1}.png`
- Contrast ridicat: `today|planenv|analiza-{white,dark}-hc-390-0.png`
- Plicuri individuale: `env0..6-white-390.png` (Lumină & gaz, Rată casă, Grădiniță, Abonamente, Mâncare, Transport, Ieșiri), `envcard-open-white-390.png`, `envfood-open-white-390.png`, `plansec-*.png`
- Onboarding: `onb0..3-{white,dark}.png`, `onb1b-*.png`, `onb4-after-*.png`
- Modul membru: `member-{white,dark}.png`
