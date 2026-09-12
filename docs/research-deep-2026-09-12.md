# Cercetare profundă — Buget Familie (12 septembrie 2026)

**Produs:** aplicație mobilă-first de buget de familie, România, Google Play  
**Constrângeri:** fără bank scraping, fără Notification Listener, fără Play Billing (abonamente amânate)  
**Baseline cod:** `main` @ `c9ce261` (Analiză light chrome, cycle compare, searchable ledger) + audit dual-lens din aceeași zi  
**Metodă:** pagini oficiale / review-uri 2025–2026 (Wallet, Spendee, Monefy, Fudget, Bluecoins, YNAB/Goodbudget, Honeydue, BCR George, ING Together, Revolut) + audit al repo-ului.

---

## 1. Ce așteaptă utilizatorii „delighțați” în 2025–2026

| Nevoie | Pattern validat de piață | Implicație locală |
| --- | --- | --- |
| **Viteză la captură** | Monefy: cheltuială în ~3 atingeri; widget pe ecranul principal; offline | Widget + QuickEntry există; primul tap lazy încă poate arăta „Pregătim…”. Șabloanele pe widget sunt deja pe `main`. |
| **Un număr: „cât pot cheltui?”** | Spendee „daily budget”; YNAB = Available pe categorie, nu soldul contului; Reddit YNAB: *category available*, nu Age of Money | Astăzi are deja „Poți folosi azi” + explainer. Lipsește o **foaie de formulă** (lichid − scadențe − ritm) pe care familia o poate citi împreună. |
| **Plic = ritm, nu doar %** | YNAB/Goodbudget: știi dacă ești *înainte* sau *în urmă* față de calendar | Avem `usage %` și alerte over/watch. **Nu** comparăm consumul cu zilele scurse din ciclu („în avans / în ritm / în urmă”). |
| **Încredere sync familie** | Honeydue: feed + comentarii; Spendee shared wallets; Bluecoins Drive sync | Sync criptat + listă „ce nu se sincronizează” există. Feed-ul bogat stă în Analiză → Gospodărie — pe Astăzi apar doar 3 mișcări. |
| **Insights fără scraping** | Wallet anomaly + reports; Bluecoins PDF; Fudget = ledger manual | Detectare abonamente + check-in săptămânal + Analiză cycle compare sunt pe `main`. Confirmarea detecției e one-tap (fără previzualizare). |
| **Offline + widget + export** | Monefy/Fudget/Bluecoins | Local-first e poziționarea corectă vs BCR/ING/Revolut (care cer cont). Export CSV/PDF există; CSV-ul jurnalului scrie **id de plic**, nu eticheta. |

### Bănci RO (context, nu competitori direcți)

- **BCR George Fin Coach:** 50/30/20 + categorii din tranzacții BCR; multibanking limitat.  
- **ING Together:** cont comun / împuterniciți — vizibilitate bancară, nu plicuri.  
- **Revolut:** bugete pe categorii + Pockets / Group Pockets.  

**Diferențiatorul nostru:** ciclu salarial + plicuri + familie pe telefon, **fără** a lega banca. CSV RO (BCR/BT/ING/Revolut) rămâne poarta corectă.

---

## 2. Gap analysis vs CURRENT buget-familie

### Deja livrat (nu reinventa)

- Un număr pe Astăzi („Poți folosi azi”) + „Cum se citește?” + banner De verificat  
- Review queue, CSV bănci RO, plicuri, sync E2E, teme slim, Analiză cycle compare, search jurnal  
- `todayBrief`, `liquidSafeToSpend`, `paydayTrack` / PaydayStrip, ritm săptămânal plicuri  
- Detectare abonamente (`detectSubscriptions`) + hunt pe Astăzi / Gospodărie  
- Weekly check-in + share + reechilibrare plicuri  
- Activitate recentă (3) pe Astăzi; feed + El/Ea în HouseholdStudio  
- Widget fără sume + 3 șabloane; glosar Pe românește; touch ≥44px pe filtre Mișcări  

### P0 — lipsă, implementabil acum (fără bancă / Billing / notification listen)

| # | Gap | De ce e P0 | Unde |
| --- | --- | --- | --- |
| P0-1 | **Burn rate plic vs calendar** (în avans / în ritm / în urmă) | Răspunde „pot cheltui la Lidl din Alimente?” mai bine decât % gol | `household-insights` + Astăzi plicuri + Plan |
| P0-2 | **Foaie „De ce pot folosi X?”** + countdown până la salariu | Explainer-ul e scurt; Spendee/YNAB-style cere formula vizibilă | Astăzi hero → sheet |
| P0-3 | **Feed familie pe Astăzi** (când ≥2 membri) | Sync trust: partenerul vede cine a mișcat, fără să caute în Analiză | Astăzi + `householdActivity` |
| P0-4 | **Confirmare la detecție recurentă** | One-tap creează scadență; UX 2026 cere confirmare explicabilă | TodayBrief / HouseholdStudio |

### P1 — ROI mare, tot local-first

| # | Gap | Note |
| --- | --- | --- |
| P1-1 | Export CSV cu **etichetă plic** (nu id) | Fix trivial, încredere Excel/RO |
| P1-2 | **Digest săptămânal** cu un headline inteligent pe check-in | Datele există; lipsește propoziția de decisie sus |
| P1-3 | Onboarding: frază de încredere „date pe telefon / sync opțional” | Audit dual-lens |
| P1-4 | A11y ritm zilnic: unități `lei`, nu doar `3k` | Contrast + citire pe telefon |
| P1-5 | Empty-state Plan deja OK; empty Obligații/bonuri — polish ușor | Backlog dacă timpul permite |

### Explicit OUT of scope (acum)

- Bank scraping / Open Banking PSD2  
- Notification Listener / SMS parsing  
- Play Billing / paywall real  
- AI cloud inventat; marketplace financiar  

---

## 3. Prioritate de implementare (această sesiune)

1. Burn pace plic vs ciclu + UI Astăzi/Plan  
2. Safe-to-spend sheet (formulă + payday)  
3. Feed familie pe Astăzi  
4. Confirmare detecție abonament  
5. CSV etichetă plic  
6. Digest headline săptămânal  
7. Trust line onboarding + lei pe ritm  

Backlog rămâne: QA nativ PLAY_CHECKLIST, merge IDB/LS la hydrate (dacă nu e deja pe main), contrast Aurora/Navy/Cyber, EN pe ecrane adânci, PDF digest.

## 4. Referințe

- Wallet BudgetBakers features; Spendee; Monefy reviews 2026; Bluecoins; Fudget offline lists  
- YNAB Available / Reddit „safe to spend” = category available  
- Honeydue couples feed; BCR George Fin Coach; ING Together; Revolut budget RO  
- Docs interne: `analiza-concurenta-roadmap-2026-09.md`, `audit-dual-lens-2026-09-12.md`, `PRODUCT_STRATEGY.md`
