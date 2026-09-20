# Audit și upgrade — Buget Familie

| Câmp | Valoare |
|---|---|
| Dată audit | **2026-09-20** (Europe/Bucharest) |
| Commit auditat | `a552181` (`a5521814751f99d1a81351fc69bfe7b889a4760d`) |
| Versiune | **1.1.45** (`package.json`) / `versionCode` **47** (`android/app/build.gradle`) |
| Metodă | Read-only (GitHub MCP + raw), fără clone |

**Poziționare (one-liner):** plicuri pe ciclu salarial, fără bank login, sync criptat, UI RO.

---

## Puncte tari

- **Teste:** suite Vitest solidă pe bani (allocation-scenarios, started-week, weekly-pace, entitlements).
- **Local-first + sync:** registru pe dispozitiv; sync familie opțional AES-GCM (PBKDF2) pe Firestore; fără cont bancar.
- **Calitate bani recentă (1.1.37–1.1.45):** spendable = limita tranșei (nu tot cash-ul), multi-funding, nerepartizați pe plic, evenimente planificate, backup clar (salvează pe telefon vs trimite copie).
- **Play-ready parțial:** widget, dală Setări rapide, App Check wired, privacy/terms pe Pages, `BILLING_LIVE=false` (corect până după listare).

---

## P0 — înainte de producție / closed testing

| # | Acțiune | Status |
|---|---|---|
| 1 | Rulează `PLAY_CHECKLIST.md` pe telefon real (widget, dală, reminder, sync 2 device, conflict plic) | De făcut pe device |
| 2 | Closed testing: 12+ testeri × 14 zile consecutive; AAB semnat | De făcut |
| 3 | Bump privacy/terms la **1.1.45** / 20 septembrie 2026 | **Făcut în acest commit** |
| 4 | App Check: metrics cu tokenuri valide pe build release **înainte** de Enforce | De confirmat |
| 5 | **Billing rămâne oprit** (`BILLING_LIVE=false`); fără plugin-uri IAP în acest ciclu | **Păstrat off** |

Checklist-ul menționează acum `versionCode` **47** / `versionName` **1.1.45** (aliniat la gradle).

---

## P1 — post-listare / primul patch

| # | Acțiune | Note |
|---|---|---|
| 1 | Aliniere Casa plicuri strategie ↔ cod | **Făcut:** PRODUCT_STRATEGY → **10 plicuri**; sursa de adevăr = `entitlements.ts` |
| 2 | Play Billing după listare stabilă | Restore purchases; downgrade Casa fără blocarea registrului |
| 3 | Monitorizare conflicte sync (2 device pe același plic) | Badge Plan + păstrează local/remote; observă în closed testing |
| 4 | App Check Enforce doar după metrics | Vezi `docs/app-check-enforce-prep.md` |
| 5 | Nu lipi prețuri IAP în listing cât billing e off | Respectă `docs/PLAY_LISTING.md` |

---

## P2 — calitate (nu blochează closed testing)

- Activează `minifyEnabled` + ProGuard pe release AAB.
- Split `Home.tsx` / consolidare CSS overlay.
- Playwright / E2E pe fluxuri critice (captură, plic, sync).
- Opțional: tipuri Zod shared dacă Functions validează același model.

---

## Monetizare

- **Acum:** `BILLING_LIVE=false` — totul deblocat pentru testeri; **nu** activa plățile până după listare stabilă.
- **În cod (`entitlements.ts`):** Familia **19,99 RON/lună** / **149 RON/an**; Casa gratuită, **10 plicuri**, 1 membru, 1 device.
- **Cercetare piață:** opțional, mai târziu, un tier Family mai sus (~**29,99** / **229** RON) dacă ARPU o cere — vezi `docs/MARKET_RESEARCH.md`. Nu schimba prețurile din entitlements fără decizie de produs.
- Freemium fără ads pe ecranele financiare; la anulare, registrul rămâne pe telefon.

---

## Roadmap scurt

1. Closed testing + checklist pe device → producție fără Billing.
2. Metrics App Check → Enforce.
3. Billing + restore + paywall transparent.
4. P2 perf/mentenanță (minify, split Home, Playwright).

---

## Referințe interne

- `PLAY_CHECKLIST.md`, `PRODUCT_STRATEGY.md`, `client/src/lib/entitlements.ts`
- `docs/app-check-enforce-prep.md`, `docs/PLAY_LISTING.md`, `docs/MARKET_RESEARCH.md`
- Highlight-uri din audit local (box): commit `a552181`, v1.1.45, P0/P1/P2 de mai sus
