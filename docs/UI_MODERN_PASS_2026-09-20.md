# UI modern pass — 2026-09-20

## Ce s-a schimbat

Strat CSS aditiv `client/src/ui-modern-pass.css`, importat din `client/src/main.tsx` imediat după `display-fixes-pass.css` (critical path, peste `contrast-fix.css`).

### Tipografie erou
- Sume erou (`.os-amount`, `.bf-today-situation-number strong`) mai mari pe mobil
- `tabular-nums` + tracking strâns

### Spațiere carduri (general + Plan)
- Line-height body ≈ **1.5**
- Pași **12–16px** între kicker → titlu → paragraf → CTA
- Padding card Plan ≈ **16–18px**; gap vertical între secțiuni **16–18px**
- Liste simulare: **12px** între rânduri; footer CTA cu gap 12px

### Plan feed (screenshot dark — prioritate)
- **Anti-înghesuit**: grid pe hero/simulator/simulation headings; note cu aer
- **CTA filled**: `.bf-plan-simulator-action` / `.bf-secondary.bf-plan-simulator-action` + primary din simulare — mint solid, pill, min 48px (nu outline)
- **Anti-neon**: fără glow violet; bordură subtilă + umbră de elevație; `backdrop-filter` off pe carduri Plan
- **H2 mobil**: Outfit / IBM Plex Sans, weight 600–650 — seriful greu rămâne pe brand/hero, nu pe feed-ul dens

### Dock / empty / focus / motion / safe-area
- Dock ≥44–48px, activ clar
- Empty geometric CSS (`.bf-empty-state`, `.bf-allocation-empty`, `.bf-today-empty-activity`)
- Focus-visible + contrast layer *cu* `contrast-fix.css`
- Enter scurt; `prefers-reduced-motion`
- Safe-area Capacitor

### Microcopy RO (diff mic)
- Mișcări / First run / Plan empty — ton calm
- `Home.tsx` neschimbat

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
- `BILLING_LIVE` — `false` (`docs/BILLING_PLAY_PREP.md`)
- `PLAY_*` docs — neatins
