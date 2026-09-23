# Audit dual-lens — Buget Familie

**Data:** 12 septembrie 2026  
**Commit:** `3f2f651` (`Alb Atelier Platinum implicit: suprafețe moi, pin cald, fără ink stark`)  
**Scope:** `main` actual, fără implementare. Citite: PRODUCT_STRATEGY, REDESIGN_DIRECTION, todo.md, PLAY_CHECKLIST, Home / sync / plicuri / review / CSV / onboarding, widget Android, `package.json`, `main.tsx`, CSS, stocare.  
**Context produs:** abonamente amânate; sync Firebase cu parolă ≥12; teme slim `white` / `dark` / `aurora` / `navy` / `cyber`; contrast Ink/Alb reparat în `a7d4cb4`.

---

## Verdict executiv

Produsul are **adâncime peste media Play** (plicuri pe ciclu, familie, bon→revizuire, CSV bănci RO, sync criptat, widget). Nu pierde pe funcții. Pierde pe **prima minută pe telefon**: prea multe sume pe Astăzi, onboarding-ul se poate sări peste fluxul de 3 intenții, iar CSV/sync/„De verificat” stau în `Mai mult`.

Pentru Play, blocajul nu e Billing. Este: **claritatea soldului**, **captura în 2–3 atingeri**, **un first-paint acceptabil**, **probe pe telefon** (widget/dală/WorkManager).

---

## A) Ochii utilizatorului (familie RO, mobil)

### Ce e confuz / greu de găsit

| Problemă | Unde | De ce doare |
| --- | --- | --- |
| **5 sume diferite pe același ecran** | Astăzi | Hero „Rămas în plicuri”, stamp „Reper pentru azi”, „Disponibil prudent” (TodayLedger), „în surse acum”, „disponibili după plicuri”. Un cuplu întreabă „deci cât pot cheltui la Lidl?” și primește 3 răspunsuri. |
| **Trei grafice pe 7 zile** | Astăzi: ritm zilnic + TodayLedger pulse + TodayPulse | Aceeași săptămână, de trei ori. Contra REDESIGN: „un singur mesaj principal per ecran”. |
| **Două „următoarea acțiune”** | `advisorSignals` + `NextStepCard` + TodayBrief + „Poți cheltui?” | Decizia se diluează. |
| **CSV-ul băncii** | Mai mult → De verificat | Nu e în Mișcări. Cine exportă BCR/BT/ING/Revolut caută „Import”, nu „Instrumente”. |
| **Sync familie** | Mai mult → Sync (tab 12 din ~13) | Perechea de telefoane e funcția de familie; e la 2 atingeri + swipe într-o bandă aglomerată. |
| **Bonul nu ajunge în registru** | Receipt → `pendingReview` | Corect tehnic (poartă de confirmare). Pe telefon: salvezi bonul și nu vezi suma în Mișcări. Badge-ul pe `⋯` e ușor de ratat. |
| **„Sari peste” sare și configurarea** | `CalmOnboarding.skipTour` | Setează *și* `onboarding-complete` *și* `setup-complete`. Utilizatorul nu mai vede cele 3 intenții (START / organizează / familie). Rămâne pe Astăzi gol cu „Trei pași” — OK ca plasă, dar strategia de 3 minute e ocolită. |
| **Plic = limită, nu sold** | Plan + formular | Familia crede că „mută bani”. README o spune; ecranul o spune târziu, în explainer `+`. |
| **EN pe jumătate** | Home, Obligații, Plan | `t()` acoperit de test; texte *fără* `t()` rămân RO: „Deschide registrul”, „TRANȘA S…”, „SURSE UTILIZABILE”, „Sari peste”. |

### Ce lipsește ca să fie mulțumit orice utilizator

**Onboarding**
- Fluxul 3 intenții există (`FirstRunSetup`) și e bun. Nu e garantat: skip-ul turului îl ocolește.
- Intenția „track” cere doar numele, apoi cheltuiala — fără sold de sursă. Prima cifră de pe Astăzi rămâne 0 / „Plicuri neconfigurate”.
- Intenția „familie” creează partener + plicuri, **nu** deschide Sync și nu explică parola de 12 caractere.
- Lipsește o frază de încredere la start: „Datele stau pe telefon. Sync-ul e opțional și criptat.”

**Încredere**
- PIN local, politică/termeni/ștergere pe Pages, backup nativ reparat (audit 11.09) — bune.
- WhatsNew după update e corect; pe instalare nouă concurează cu tur + setup.
- Widgetul **nu** arată sume (privacy) — bine. Trebuie confirmat pe telefon că se instalează și deschide captura.

**Viteză la captură**
- `QuickEntryPanel`: sumă, categorie, sursă, plic auto, șabloane — competitiv cu Monefy *după* ce foaia e deschisă.
- Foaia e lazy → primul tap poate arăta „Pregătim înregistrarea rapidă…”.
- Widget/dală există în Java; **niciun item din PLAY_CHECKLIST nu e bifat**. Fără asta, diferențiatorul Play e teoretic.
- Widgetul n-are ultimele 3 șabloane (recomandarea din analiza Play 10.09).

**Claritate solduri**
- Modelul v11 e corect (sursă = opening + venit − cheltuială; plicul e limită). Interfața nu alege *un* număr de decizie.
- Hero rotunjește fără bani (`Math.round`) — 12,40 lei dispare.
- Luna calendaristică vs ciclu salarial: corectat în Analiză (11.09); pe Astăzi, „Venit înregistrat luna asta” încă e `YYYY-MM`, nu ciclul.

**Familie**
- Cine a înregistrat: da, în jurnal. Pe Astăzi, ultimele 3 mișcări arată persoana — bine.
- Conflict de plic: banner + badge pe Plan — bine. Nu apare pe Astăzi.
- Coada „De verificat”, regulile de comerciant, cursurile, șabloanele **nu se sincronizează** (decizie conștientă în `family-crypto`). Partenerul nu vede bonul de confirmat. Trebuie spus în UI, nu doar în README.

### Design: ierarhie, densitate, încredere, a11y

- **Ierarhie:** Astăzi încalcă regula „un mesaj + o acțiune”. Kickere editoriale (PULSUL, DECIZIA, MASA DE LUCRU) concurează cu cifra.
- **Densitate:** pe 360px, utilizatorul derulează ~2–3 ecrane înainte de activitate. Dock-ul e clar (5 taburi). `Mai mult` e un sertar cu 13 taburi + swipe.
- **Încredere:** teme slim + contrast Alb reparat. Aurora / Navy / Cyber nu au același audit de etichetă pe filled ca `theme-white` din `a7d4cb4`.
- **A11y:** skip-link, focus trap, `aria-live` pe alerte — bune. Ținte <48dp semnalate în 11.09 (filtre 29–33px) — de re-măsurat. Graficele țin de culoare + înălțime; ritmul scrie `3k` fără „lei”. Contrast extra-ridicat există.

### Priorități utilizator

**P0**
1. Un singur număr de decizie pe Astăzi + o acțiune + un buton de captură.
2. „Sari peste” nu trebuie să omoare FirstRun (3 intenții).
3. După bon/CSV, „De verificat” trebuie să fie imposibil de ratat (banner pe Astăzi / badge pe dock).
4. Probe fizice: widget, dală, reamintiri, pairing (PLAY_CHECKLIST).

**P1**
5. Sync găsibil din intenția Familie + generator parolă vizibil o dată.
6. Import CSV și din Mișcări (un rând „Adu extrasul”).
7. Copie de încredere la prima deschidere (local, fără bancă).
8. Texte rămase fără `t()` pe Home / Obligații.
9. Explicație scurtă: plic ≠ cont; reper ≠ sold.

**P2**
10. Șabloane pe widget; glosar „Pe scurt” din strategie.
11. EN pe Plan Studio, ghid, rapoarte (todo deja le marchează).
12. README încă vorbește de Porcelain Studio / 4 teme — încredere de magazin.

---

## B) Ochii programatorului

### Buguri / riscuri

| # | Risc | Fișiere | Gravitate |
| --- | --- | --- | --- |
| 1 | **Cursă LS ↔ IndexedDB.** First paint din `localStorage`; apoi `readAppData()` suprascrie dacă IDB are *orice* obiect, fără comparare `updatedAt`. Dacă IDB e în urmă (quota / kill între cele 280ms), o sesiune poate pierde ultimele taste. | `Home.tsx` ~507–513, `app-storage.ts` | **P0** |
| 2 | **Skip tur = skip setup.** `CalmOnboarding.skipTour` scrie ambele flag-uri. | `home-secondary.tsx` ~223–226 | **P0** produs |
| 3 | **Sync last-write-wins pe document.** `setDoc` întreg pachetul; conflictele UI sunt doar pe *suma plicului*. Două editări simultane pe aceeași mișcare/datorie rămân LWW. Parola nu e persistată — reconnect la fiecare sesiune. Cine știe parola poate `update` camera (`firestore.rules`). | `realtime-sync.ts`, `family-crypto.ts`, `firestore.rules` | **P1** (cunoscut, atenuat) |
| 4 | **Review / merchant / FX / șabloane excluse din pachet.** Corect anti-zombie; familia crede că „totul e comun”. | `family-crypto.ts` `shareable` | **P1** UX + date |
| 5 | **CSS specificity war.** ~80 foi, **12 794** linii, **2 804** `!important` (`household-os-chrome.css` singur 726). `contrast-fix.css` e ultimul *intenționat*. Orice fix în `index.css` moare. Selectori `html.theme-ink` rămân după slim. | `main.tsx` 4–82 | **P0** Play perf + contrast |
| 6 | **First paint greu.** Toate CSS-urile în `main.tsx`. `AICompanion` (820 linii + `understand`/`analyst`) e eager. `Home` 799 + `home-secondary` 1 174. Preload Plan+secondary la 250ms consumă radio pe 4G. `framer-motion` în `package.json`, 0 importuri. | `main.tsx`, `Home.tsx`, `package.json` | **P0** WebView |
| 7 | **IDB deschis la fiecare read/write** (`openDatabase` per apel). | `app-storage.ts` | **P1** |
| 8 | **Timezone.** `isoToday`/`isoDate` locale — OK, teste în `utc-civil-date.test.ts`. Rămâne `new Date(dueDate)` fără `T12:00:00` în obiective; luna hero e calendar, nu ciclu. | `home-secondary` LongTermGoals, `Home` TodayView | **P2** |
| 9 | **Contrast teme extra.** Alb reparat (`a7d4cb4`). Aurora/Navy/Cyber: aceleași clase filled; nemăsurate. | `contrast-fix.css`, `household-os-themes.css` | **P1** a11y |
| 10 | **Widget/intent.** `consume()` o dată; `onNewIntent` pune pending. Dacă JS e deja up, trebuie `observeQuickActions` să poll-uiască — de confirmat pe device (app în fundal). | `MainActivity.java`, `quick-action-bridge.ts` | **P0** Play |
| 11 | **SW hardcodat** `sw.js?v=47`. Uitarea incrementului = update invizibil. | `main.tsx` 90 | **P2** |
| 12 | **RESTORE_HOME.md e mort.** Home are 799 linii, nu stub. | `RESTORE_HOME.md` | P2 docs |
| 13 | Flexibilitate salariu vs săptămâni (audit 10.09, nerezolvat). | `finance-data.ts` | P2 |

### Performanță

- **CSS:** nu „prea multe fișiere” ca request-uri (Vite le unește), ci **volum + !important + ordine**. 11 foi au 2 linii moarte și tot se parsează. Țintă: un core (~`index` + `household-os-*` + `contrast-fix` + `play-ready-polish`) și CSS de ecran lângă `lazy()`.
- **Re-render:** un `setData` în `Home` recalculează `planMath`, semnale, ritm, bilanț, reminder-e, sync debounce. Fără context split. Acceptabil la zeci de mișcări; se simte la mii (jurnalul e paginat 30 zile — bine).
- **IndexedDB:** dual-write LS+IDB; imagini bon separate — bine. Conexiunea nu e reținută. Hydrate fără merge — rău.
- **JS:** tesseract/jspdf/firebase în `manualChunks` — bine. Lucide *nu* e într-un chunk comun — bine. Companion-ul anulează o parte din splitting.

### Debt care blochează calitatea Play

1. Checklist hardware nebifat (widget, dală, notificări, pairing, conflict).
2. First-paint CSS + companion — WebView mid-range.
3. Astăzi nu arată ca listarea („plicuri, până la salariu, fără bancă”) — arată ca un dashboard de atelier.
4. Data safety / App Check: docs OK, Enforce oprit (corect). Metrics pe build-ul de release — încă de făcut.
5. Listing/README vs teme reale (5, nu 4 nume vechi).
6. A11y contrast pe 3 teme de noapte + ținte tactile.

### Priorități programator

**P0**
- Sursă unică de stocare + merge la hydrate.
- Nu marca setup complete la skip tur.
- Tăiere CSS mort + mutare CSS de ecran în chunk-uri lazy.
- QA nativ PLAY_CHECKLIST.

**P1**
- Lazy `AICompanion`; extrage sync/theme din `Home.tsx`.
- Reuse IDB; debounce unic.
- Contrast aurora/navy/cyber (același tratament `--cf-on-primary` ca Alb).
- UI: pendingReview pe Astăzi; CSV din jurnal; Sync din FirstRun familie.
- Mesaj explicit: ce nu se sincronizează.

**P2**
- EN adânc; șterge `RESTORE_HOME`; aliniază README.
- Scoate `framer-motion` / Radix nefolosit.
- Versiune SW din `app-version`.
- Decizie explicită allocationSpent vs ultima tranșă.

---

## C) Top 10 acțiuni concrete

Ordine: impact pe „orice utilizator mulțumit”, apoi risc de date, apoi Play.

1. **Colapsează Astăzi la 1 cifră + 1 recomandare + 1 captură.**  
   Fișiere: `client/src/pages/Home.tsx` (`TodayView`), `TodayBrief.tsx`, `TodayLedger.tsx`.  
   Elimină dublurile: un singur puls 7 zile; `NextStepCard` *sau* stiva de decizie, nu ambele; hero = „poți folosi” (reper), restul în `Cum se citește?`. Păstrează alertele plic/tranșă deasupra fold.

2. **Repară skip-ul de onboarding.**  
   `CalmOnboarding.skipTour` în `home-secondary.tsx`: scrie doar `onboarding-complete`. Lasă `FirstRunSetup` (3 intenții + Mai târziu). „Mai târziu” din FirstRun rămâne fără penalizare.

3. **Fă „De verificat” inevitabil.**  
   După `queueReceiptForReview` / import CSV: banner pe Astăzi + badge pe dock, nu doar pe `⋯`. Entry „Adu extrasul băncii” în `MovementsJournal.tsx` (deschide `more=review`). Fișiere: `Home.tsx`, `ReviewCenterPanel.tsx`, `MovementsJournal.tsx`.

4. **O singură sursă de adevăr la persist.**  
   `app-storage.ts` + hydrate din `Home.tsx`: IDB primar; LS cache; la start alege copia cu `updatedAt`/hash mai nou, nu „IDB dacă există”. Reține conexiunea IDB. Test de cursă (tastează înainte de `storageReady`).

5. **Taie first-paint CSS.**  
   `main.tsx`: șterge importurile de 2 linii moarte (`advisor-studio`, `atelier-review-final`, `bf-logo-3d`, `dark-night-premium`, `envelope-*` goale, `smart-scenario`, …). Mută `weekly-checkin`, `price-watch`, `pocket`, `review-center`, `ai-companion` lângă componentele lazy. Păstrează `contrast-fix.css` ultimul. Țintă: −50% linii pe critical path.

6. **Lazy `AICompanion` + rupe `Home.tsx`.**  
   Companionul nu e pe first paint. Extrage `useFamilySync`, `useThemeChrome`, `useUndo` din `Home.tsx` (799 linii). `applyFinancialUpdate` rămâne un modul, nu un closures de 80 de linii în render.

7. **Familie: de la intenție la pairing.**  
   `FirstRunSetup` intent `family` → după `finishFamily`, deschide Sync cu `generateFamilyPassword()` afișat o dată (deja în `family-password.ts`). Copie: „aceeași frază pe ambele telefoane; datele pleacă criptate”. Listează ce *nu* se copiază (bonuri foto, De verificat, șabloane).

8. **QA nativ înainte de AAB.**  
   Execută `PLAY_CHECKLIST.md` pe un telefon: widget Cheltuială/Bon/titlu, dală, WorkManager, pairing 12 caractere, conflict Păstrează local/remote. Fără bife, nu e build de magazin. Opțional: ultimele șabloane pe widget (`QuickAddWidgetProvider` + bridge).

9. **Contrast filled pe Aurora / Navy / Cyber.**  
   Același audit ca `a7d4cb4` pentru Alb: `--cf-on-primary` pe butoane filled, kickere, dock `is-on`. `contrast-fix.css` + `household-os-themes.css`. Măsoară 4,5:1 pe 360px.

10. **Aliniază încrederea de magazin cu realitatea.**  
    README (încă Porcelain/Ember), `RESTORE_HOME.md` (șterge sau marchează obsolete), listing teme = 5. Data safety + URL-uri privacy rămân. App Check: metrics pe release, **fără Enforce**. Billing rămâne afară.

---

## Ce e deja bine (nu strica)

- Model financiar explicabil; plicul nu e al doilea registru.
- `isoToday` local + teste UTC.
- Bon → review → registru; CSV cu dedupe; bănci RO detectate.
- Conflict de sumă pe plic (nu LWW tăcut).
- Parolă 12+ cu generator de propoziție; AES-GCM; rules `get` nu `list`.
- Undo ștergere 9s; backup nativ Filesystem+Share.
- Scor sănătate nu mai dă 80/CALM pe registru gol.
- Widget fără sume; dock 5 taburi; teme slim 5; contrast Alb reparat.
- Code-split Plan/OCR/PDF/Firebase; jurnal paginat 30 zile.
- Abonamentele corect amânate.

---

## Anexe de măsură (repo, 12.09.2026)

| Măsură | Valoare |
| --- | --- |
| CSS | 80 fișiere, 12 794 linii, 2 804 `!important` |
| Importuri CSS în `main.tsx` | 78 |
| `Home.tsx` / `home-secondary.tsx` / `AICompanion.tsx` | 799 / 1 174 / 820 |
| `finance-data.ts` / `i18n.ts` | 1 180 / 1 762 |
| Teme live | white, dark, aurora, navy, cyber |
| MoreView tabs | 13 |
| PLAY_CHECKLIST | 0 bife hardware |
| Scripts | `dev`, `build`, `build:pages`, `cap:sync`, `cap:android`, `start`, `preview`, `check`, `test`, `lighthouse`, `format` |

