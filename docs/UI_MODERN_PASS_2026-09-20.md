# UI modern pass — 2026-09-20

## Ce s-a schimbat

Strat CSS aditiv, importat din `client/src/main.tsx`:

- `client/src/ui-modern-pass.css` — stub `@import`
- `ui-modern-pass-a1.css` / `a2.css` — tipografie erou, dock, empty states, safe-area
- `ui-modern-pass-b1.css` / `b2.css` — **Plan feed** (spacing, filled CTA, anti-glow, sans H2 mobil)
- `ui-modern-pass-c1.css` / `c2.css` — **Pass 2**: Astăzi hero + header + dock refine; Mișcări / Obligații / Analiză (același sistem ca Plan)

### Tipografie erou
- Sume erou (`.os-amount`, `.bf-today-situation-number strong`) mai mari pe mobil
- `tabular-nums` + tracking strâns
- **Pass 2**: mai mult aer sub kicker → sumă → hint; label-uri mai puțin „cramped” (letter-spacing / opacitate)

### Spațiere carduri (general + Plan + shell) — feedback screenshot dark
- Line-height body ≈ **1.5–1.55**
- Pași **12–16px** între kicker → titlu → paragraf → CTA
- Padding card ≈ **18–20px** (mobil); gap vertical între secțiuni **16–18px**
- Liste simulare: **12px** între rânduri; footer CTA cu gap 12px

### Plan feed (screenshot dark — prioritate)
- **Anti-înghesuit**: grid pe hero/simulator/simulation headings; note cu aer
- **CTA filled**: `.bf-plan-simulator-action` / `.bf-secondary.bf-plan-simulator-action` + primary din simulare — mint solid, pill, min 48px (nu outline)
- **Anti-neon**: `--cf-glow: transparent`; fără blur/glow violet; bordură subtilă + umbră de elevație
- **H2 mobil**: Outfit / IBM Plex Sans, weight 600–650 — seriful greu rămâne pe brand/hero, nu pe feed-ul dens

### Pass 2 — Astăzi / header / dock / Mișcări·Obligații·Analiză
- **Astăzi hero** (`.os-hero`, `.bf-today-situation`): aer în jurul numărului de decizie; ierarhie kicker → amount → hint; tabular nums
- **Header** (`.os-appbar`, `.os-brand`, `.os-tool`): fără chrome „old web”; hit targets ≥46px; fără backdrop blur
- **Dock** (`.os-dock`): activ mint filled + umbră ușoară; labels 10px/650; safe-area Capacitor
- **Mișcări / Obligații / Analiză**: același pad/gap/LH ca Plan; CTA filled (`.bf-movement-add`, `.bf-primary`); sans H1/H2 pe mobil
- **Dark aurora/navy/cyber/dark**: elevație prin umbră + bordură mint subtilă — **nu** violet bloom; coral doar pe `.risk` / timeline obligații

### Dock / empty / focus / motion / safe-area
- Dock ≥44–50px, activ clar
- Empty geometric CSS (`.bf-empty-state`, `.bf-allocation-empty`, `.bf-today-empty-activity`)
- Focus-visible + contrast layer *cu* `contrast-fix.css`
- Enter scurt; `prefers-reduced-motion`
- Safe-area Capacitor (`capacitor-android` / `is-android-standalone`)

## Cum verifici (telefon / GitHub Pages)

1. Hard refresh Pages (vezi mai jos), temă **dark**, tab **Astăzi** → apoi **Mișcări** / **Obligații** / **Analiză** / **Plan**.
2. Astăzi: sumă erou cu aer; label-uri nu „lipite”; tabular.
3. Header: 3 tool-uri rotunde, tap ușor; fără blur/glow.
4. Dock: tab activ mint plin; labels lizibile; safe-area pe Android.
5. Mișcări/Obligații/Analiză: carduri respiră; CTA „Adaugă” / primary = **plin** mint.
6. Aurora/cyber: fără halou violet; coral doar pe alert/risk.
7. 5 teme + reduce motion.

### Hard refresh pe GitHub Pages
- Chrome Android: meniu → **Șterge datele de navigare** pentru site *sau* deschide în tab Incognito; apoi tragere în jos + așteaptă rebuild Pages (~1–2 min după push).
- iOS Safari: ține apăsat refresh → **Reload Without Content Blockers** / golește cache site; sau Private.
- Desktop: `Ctrl+Shift+R` / `Cmd+Shift+R` pe URL-ul Pages.
- Dacă SW blochează: DevTools → Application → Service Workers → **Unregister**, apoi hard refresh.

## Visual QA rămas
- [ ] Plan landscape / tabletă
- [ ] Aurora/cyber: mint filled pe fundal saturat
- [ ] Regresie flags plic
- [ ] Deferred atelier vs acest strat pe selectori rari
- [ ] Obligații timeline pe ecran foarte îngust (<370px)

## Neatinse
- `clarity-rebuild.css` — nerescris (doar override)
- `Home.tsx` — fără rewrite
- `BILLING_LIVE` — `false`
- `PLAY_*` docs — neatins

## Commits cheie
- stub + a1/a2/b1/b2 pe `main` (Pass 1)
- c1/c2 + stub import + docs (Pass 2 — Astăzi / header / Mișcări·Obligații·Analiză)
