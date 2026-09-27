# Teste

| Comandă | Ce verifică | Unde rulează în CI |
|---|---|---|
| `pnpm check` | TypeScript: aplicația și testele | `deploy-pages.yml`, `build-android-apk.yml`, `release-android-aab.yml` |
| `pnpm lint` | ESLint, fără avertismente | aceleași |
| `pnpm test` | Vitest: `client/src/**/*.test.ts` (bani, sync, merge, închiderea anului, `audit-r3*.test.ts`) | aceleași; `deploy-pages.yml` rulează și cu `TZ=Pacific/Auckland` |
| `pnpm test:flows` | Fluxurile principale în Chromium (playwright-core): pornire, Notează, plicuri | local, înainte de push pe UI |
| `pnpm test:layout` | 13 ecrane × 3 teme × 2 lățimi: fără depășiri, contrast, axe | `layout-e2e.yml` |
| `pnpm test:sync` | Sync pe două telefoane pe emulatorul Firebase, cu regulile publicate (`firestore.chain.rules`): lanțul de scriere, camera sigilată după „Mută familia” | `sync-e2e.yml` și jobul `test` din `deploy-firestore-rules.yml`, înainte de publicarea regulilor |
| `pnpm test:sync:current` | Același test pe regulile de rezervă (`firestore.auth.rules`) | local |
| `pnpm lighthouse` | Lighthouse mobil; raport în `reports/lighthouse-mobile-summary.json` | local |

## Reguli

- Datele de test merg doar în emulator. Niciun test nu scrie în proiectul Firebase real.
- Testele e2e folosesc Chromium-ul din sistem: `CHROMIUM_PATH=/opt/pw-browsers/chromium` (sau calea locală).
- `layout.e2e.mjs` durează ~9 minute; rulează-l în fundal.
- Un test din `audit-r3*.test.ts` care pică după o schimbare înseamnă regresie: repar-o, nu rescrie testul.
