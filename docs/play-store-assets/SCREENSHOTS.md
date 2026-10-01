# Capturi Play Store — note de producție

## Gata de încărcat

8 cadre cu titlu, 1080×1920, câte un set pe limbă:

- `screenshots/ro/` — pentru fișa în română
- `screenshots/en/` — pentru fișa în engleză (en-US / en-GB)
- `screenshots/tableta-ro/` — 8 cadre de tabletă 1440×2560 (`DEVICE=tablet LANGS=ro node capture.mjs && DEVICE=tablet LANGS=ro node compose.mjs`)

| # | Fișier | RO | EN |
|---|---|---|---|
| 1 | `01-today` | Cât poți cheltui azi | What you can spend today |
| 2 | `02-split` | A intrat salariul? Se împarte singur. | Payday? It splits itself. |
| 3 | `03-month` | Toată luna, într-o imagine. | The whole month, in one picture. |
| 4 | `04-plan` | Fiecare leu are un loc. | Every leu has a place. |
| 5 | `05-add` | Notezi în 3 secunde. | Log it in 3 seconds. |
| 6 | `06-journal` | Toate mișcările familiei. | Every family transaction. |
| 7 | `07-obligations` | Rate și facturi la timp. | Bills and loans on time. |
| 8 | `08-insights` | Vezi unde se duc banii. | See where the money goes. |

Date inventate (familia Andrei și Maria, `scripts/store-screenshots/seed.mjs`), scrise doar în localStorage-ul browserului de test, nu în Firebase. Refăcute pe 2 octombrie 2026, cu culorile pe categorii și imaginea lunii (cadrul 3 înlocuiește „Două salarii, zile diferite”; `raw/*-needs.png` rămâne disponibil).
Tot aici: `icon-512.png` (iconul Play) și `feature-graphic-ro.png` / `feature-graphic-en.png` (1024×500, `node feature.mjs`).

Refacere: pornește `vite --port 5174`, apoi din `scripts/store-screenshots/`:
`CHROMIUM_PATH=/opt/pw-browsers/chromium node capture.mjs && node compose.mjs`.

---

## Planul inițial

Temă: **Alb**. Telefon 1080×2340. Date inventate, nu ale tale. Fără notificări pe bară.

Versiune de listat: **1.1.96** / `versionCode` **98**. Navigația de jos: **Astăzi · Plicuri · Notează · Mișcări · Mai mult**.

## Ordine (8 cadre)

1. **Astăzi** — „Cât poți cheltui azi, până la salariu”: cifra zilei, banda zilelor cu legenda ei, butonul **Notează**.
2. **Propunerea de repartizare** — „A intrat salariul? Se împarte singur”: plicurile cu sumele propuse și „Aplică”.
3. **Două salarii, zile diferite** — „Ce plătim lunar”: salariul meu pe 10, al partenerului pe 25, cine ce plătește.
4. **Plicuri** — grupate pe Fixe, Variabile și Economii, cu tranșele S1–S5 și „+ tichete” lângă mâncare.
5. **Plăți rare** — RCA, impozit, Crăciun, strânse lunar; calendarul cu chiria și rata la ziua lor.
6. **Cine cui dă** — transferurile propuse între parteneri.
7. **Import de extras** — BT, BCR, ING, Revolut, Raiffeisen: „Fără parola băncii”.
8. **Widget** pe ecranul de start: „Poți cheltui azi”.

## Reguli

- Primele două cadre răspund la „cât pot cheltui azi” și „se împarte singur”. Scorul, graficele și temele stau la „Mai mult”.
- Fără „sync” și „criptat” pe primele două cadre; siguranța are cadrul ei (7).
- Feature graphic 1024×500 și icon 512 sunt deja în folderul ăsta.
- Textul de lipit în Console: `docs/play-store-listing-ro.md`. Fără prețuri, cât Billing e oprit.
