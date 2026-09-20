# UI MAX PASS — 2026-09-20

Modernizare vizuală maximă pe `main` (GitHub MCP, fără clone). CSS nou încărcat **la final** în `loadDeferredStyleSheets`.

## Lanț deferred (ordine)

1. deferred-atelier / contrast / visual-polish / apk-safe-area / display-fixes
2. `ui-modern-pass.css` (a1…c2)
3. `ui-modern-pass-aggressive.css` — dock, empty gri, tab-uri, anti-glow, CTA
4. `ui-screens-modern-2026.css` — Astăzi, Mișcări, Plan, Obligații, Analiză, Mai mult, Sync, Settings, FirstRun, Premium/Household/Assistant, quick-add/sheets
5. **`ui-themes-modern-2026.css`** — LAST (white/dark/aurora/navy/cyber)

## Suprafețe atinse

| Zonă | Ce s-a modernizat |
|------|-------------------|
| Astăzi | aer card, CTA, dock clear |
| Mișcări | header/day cards, add CTA, filter sheet |
| Plan | period/guidance/builder/list/sim/sheet, CTA filled |
| Obligații | timeline air + dock |
| Analiză / Insights | snapshot/control air |
| Mai mult | tabs fill, list row height, section labels |
| Sync / Settings | card pad, primary pill |
| FirstRun | chrome, intents, actions, presets |
| Premium / Household / Assistant | card chrome |
| Sheets / quick-add | bottom pad safe-area |
| Empty states | fără pătrat gri, titlu sans, copy max-width |
| Teme ×5 | vezi `THEMES_MODERN_2026.md` |

## Cache bust

`APP_VERSION` → **1.1.46** / code **48** (`client/src/lib/app-version.ts`).

## Constrângeri respectate

- `BILLING_LIVE` neatins (false)
- Fără rewrite `Home.tsx`
- `clarity-rebuild.css` nedeleted / nerescris
- `prefers-reduced-motion` onorat
- Logică bani neatinsă

## Verificare

1. Hard refresh Pages / unregister SW.
2. Așteaptă **6–10 s** (deferred idle).
3. Parcurge Astăzi → Mișcări → Plan → Obligații → Analiză → Mai mult → Sync.
4. Schimbă toate 5 temele; dock fără glow violet; CTA pline.
