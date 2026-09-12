# Teste

## Unit / smoke (implicit)

```bash
pnpm test
pnpm check
```

Acoperă `client/src/lib/**/*.test.ts`, inclusiv `critical-flows.test.ts` (hydrate IDB↔LS, bon→review, safe-to-spend, CSV).

## Lighthouse (local)

```bash
pnpm lighthouse
```

Raport: `reports/lighthouse-mobile-summary.json`. Note: `docs/lighthouse-2026-09-12.md`.

## Playwright

Nu este configurat în CI (evităm flaky pe runner fără display). Fluxurile critice sunt acoperite ca smoke Vitest. Dacă adaugi Playwright local:

```bash
pnpm exec playwright test
```

(necesită instalare separată; nu face parte din `pnpm test`.)
