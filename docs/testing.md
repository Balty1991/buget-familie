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


## Firestore rules (fără emulator greu în CI)

Emulatorul rules e opțional/local. În CI rulăm `client/src/lib/firestore-rules-shape.test.ts`: constantele (`salt` 24 / `iv` 16 / roomId 64 / ciphertext &lt; 2MB) trebuie să coincidă cu `firestore.rules` și cu envelope-ul din `family-crypto`. Pentru suite emulator: `firebase emulators:exec --only firestore` (neinclus în `pnpm test` din cauza overhead-ului).
