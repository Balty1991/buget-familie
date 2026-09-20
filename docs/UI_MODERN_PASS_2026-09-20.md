# UI modern pass — 2026-09-20

## Ce s-a schimbat

Strat CSS aditiv, importat din `client/src/main.tsx`:

- `client/src/ui-modern-pass.css` — stub `@import`
- `ui-modern-pass-a1.css` / `a2.css` — tipografie erou, dock, empty states, safe-area
- `ui-modern-pass-b1.css` / `b2.css` — **Plan feed** (spacing, filled CTA, anti-glow, sans H2 mobil)

### Tipografie erou
- Sume erou (`.os-amount`, `.bf-today-situation-number strong`) mai mari pe mobil
- `tabular-nums` + tracking strâns

### Spațiere carduri (general + Plan) — feedback screenshot dark
- Line-height body ≈ **1.5–1.55**
- Pași **12–16px** între kicker → titlu → paragraf → CTA
- Padding card Plan ≈ **18–20px** (mobil); gap vertical între secțiuni **16–18px**
- Liste simulare: **12px** între rânduri; footer CTA cu gap 12px

### Plan feed (screenshot dark — prioritate)
- **Anti-înghesuit**: grid pe hero/simulator/simulation headings; note cu aer
- **CTA filled**: `.bf-plan-simulator-action` / `.bf-secondary.bf-plan-simulator-action` + primary din simulare — mint solid, pill, min 48px (nu outline)
- **Anti-neon**: `--cf-glow: transparent`; fără blur/glow violet; bordură subtilă + umbră de elevație
- **H2 mobil**: Outfit / IBM Plex Sans, weight 600–650 — seriful greu rămâne pe brand/hero, nu pe feed-ul dens

### Dock / empty / focus / motion / safe-area
- Dock ≥44–48px, activ clar
- Empty geometric CSS (`.bf-empty-state`, `.bf-allocation-empty`, `.bf-today-empty-activity`)
- Focus-visible + contrast layer *cu* `contrast-fix.css`
- Enter scurt; `prefers-reduced-motion`
- Safe-area Capacitor (`capacitor-android` / `is-android-standalone`)

## Cum verifici (telefon / GitHub Pages)

1. Hard refresh Pages, temă **dark**, tab **Plan**.
2. Carduri simulator / cashflow / setup: text respiră; **nu** lipit titlu–paragraf–buton.
3. Butonul „Deschide simularea” / „Aplică scenariul” = **plin** mint, nu contur.
4. Fără halou violet pe carduri.
5. Titluri card pe mobil = sans, lizibile.
6. Astăzi: sumă erou tabular; dock ≥44px.
7. 5 teme + reduce motion.

## Visual QA rămas
- [ ] Plan landscape / tabletă
- [ ] Aurora/cyber: mint filled pe fundal saturat
- [ ] Regresie flags plic
- [ ] Deferred atelier vs acest strat pe selectori rari

## Neatinse
- `clarity-rebuild.css` — nerescris (doar override)
- `Home.tsx` — fără rewrite
- `BILLING_LIVE` — `false`
- `PLAY_*` docs — neatins

## Commits cheie
- stub + a1/a2/b1/b2 pe `main` (înlocuiește PLACEHOLDER accidental)
