# UI modern pass — 2026-09-20

## De ce pass 1–2 aproape nu se vedeau

`main.tsx` importa `ui-modern-pass.css` **înainte** de foile deferred (~1 MB).
`loadDeferredStyleSheets` le încărca după first paint și le **suprascria**.

## Remediu — lanț LAST

În `client/src/lib/ram-hygiene.ts`, la final:

1. `ui-modern-pass.css`
2. `ui-modern-pass-aggressive.css`
3. `ui-screens-modern-2026.css`
4. **`ui-themes-modern-2026.css`** ← absolut ultimul

Vezi și `docs/UI_MAX_PASS_2026-09-20.md` + `docs/THEMES_MODERN_2026.md`.

## Aggressive — ce rezolvă

1. Dock overlap (padding-bottom + safe-area)
2. Pătrat gri empty
3. Tab-uri segment mint fill
4. Glow dock/card → transparent
5. Aer carduri / CTA filled / H2 mobil sans / dock pill

## Screens MAX — ce rezolvă

Astăzi, Mișcări, Plan, Obligații, Analiză, Mai mult, Sync, Settings, FirstRun, Premium/Household/Assistant, sheets/quick-add — aer, CTA filled, fără glow violet, sans pe mobil.

## Verificare

Hard refresh → așteaptă 6–10 s deferred. Versiune app **1.1.46** (cache bust SW).
