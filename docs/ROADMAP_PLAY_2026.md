# Roadmap Play 2026 — launch + revenue

**Data:** 20 septembrie 2026 (Europe/Bucharest)  
**Surse:** [`AUDIT_AND_UPGRADE.md`](./AUDIT_AND_UPGRADE.md), [`MARKET_RESEARCH.md`](./MARKET_RESEARCH.md), `PLAY_CHECKLIST.md`  
**Constrângere:** `BILLING_LIVE = false` până la checklist + closed testing stabile. Nu se activează plăți false.

---

## Poziționare (one-liner)

> Bugetul familiei pe plicuri, pe ciclul vostru de salariu — pe telefon, criptat, fără să dați parola băncii.

ASO / listing: „buget familie”, „plicuri”, „cheltuieli”, „fără bancă”, „ciclu salariu”.

---

## Prețuri (catalog — nu în listing cât Billing e off)

| Plan | Limită | Preț |
|---|---|---|
| **Casa** (free) | 10 plicuri, 1 membru, 1 device | 0 |
| **Familia** | ∞ plicuri, până la 6 membri / 6 device | **19,99 lei/lună** sau **149 lei/an** |
| **Family+** (opțional, mai târziu) | același Familia + extras (ex. OCR cloud opt-in) | 29,99 lei/lună / 229 lei/an |

- Trial: **14 zile** pe Familia (reminder ziua 10 + 13).
- Zero ads. Zero paywall pe înregistrarea unei cheltuieli.
- Product IDs (Play Console): `familie_lunar`, `familie_anual` — vezi [`BILLING_PLAY_PREP.md`](./BILLING_PLAY_PREP.md).

---

## P0 — săptămâna asta (înainte de revenue)

Checklist acționabil pe telefon real (nu doar pe docs):

1. **Device checklist** — `PLAY_CHECKLIST.md` pe mid-range RO: widget, dală QS, WorkManager reminder, sync 2 telefoane, backup export/import, crash-free.
2. **Closed testing** — ≥12 testeri × 14 zile; notează uninstall / 1★ pe billing (nu există încă) vs sync/onboarding.
3. **App Check metrics** — confirmă token pe AAB release; **Enforce rămâne oprit** până metrics sunt verzi (`docs/app-check-enforce-prep.md`).
4. **Privacy** — deja bump la 1.1.45 / versionCode 47; re-verifică Data safety = copy din listing.
5. **Listing** — screenshot-uri Astăzi + plicuri + sync; **fără prețuri IAP** în text (`PLAY_LISTING.md`).
6. **Stabilitate bani** — nu regresa spendable / tranșe (teste `allocation-scenarios`, `started-week`).

**Done când:** closed testing pornit, checklist hardware bifat pe ≥1 device fizic, listing RO lipit, `BILLING_LIVE` încă `false`.

---

## P1 — prima lună (după listare stabilă)

1. **Play Billing Capacitor** — plugin + SKU `familie_lunar` / `familie_anual`; hook în `client/src/lib/entitlements.ts` (vezi BILLING_PLAY_PREP).
2. **Restore purchases** — la start + buton în catalog; fără pierdere de registru.
3. **Soft paywall** — doar pe sync multi-device / plicuri peste 10 / AI online peste limită Casa; **nu** pe „Adaugă cheltuială”.
4. **Widgets polish** — „rămas în plic” + obligații săptămâna asta (fără sume pe lock screen dacă e posibil).
5. **Onboarding** — primul ciclu: salariu → plicuri template → prima tranșă (copy FirstRun deja pe „fără bancă”).
6. Update **privacy §11** + listing cu prețuri **numai** după `BILLING_LIVE=true`.

---

## P2 — mai târziu

- OCR polish (on-device first; cloud doar opt-in).
- iOS / companion web după revenue Android.
- `minifyEnabled` + ProGuard pe release AAB.
- Family+ (29,99 / 229) dacă Familia convertește.
- Import CSV bănci RO fără OAuth (opțional).
- Material You / dark pass dedicat pe mid-range.

---

## Metrici de succes

| Metrică | Țintă (90 zile post-listare) |
|---|---|
| Crash-free sessions | ≥ 99,5% |
| D1 / D7 retention (familii cu ≥1 mișcare) | D1 ≥ 35%, D7 ≥ 15% |
| Closed testing → production | fără 1★ pe „nu merge sync” / „date pierdute” |
| Trial start → paid (Familia) | ≥ 8–12% din trial-uri care trec de ziua 7 |
| Annual share of paid | ≥ 40% (discount 149 vs 12×19,99) |
| Time-to-first-envelope | ≤ 5 minute în mediană |
| Support tickets „unde mi-e backup-ul” | scădere după copy Salvează pe telefon (1.1.45) |

Nu urmărim DAU vanity; urmărim **familii cu ciclu activ + sync folosit fără conflict nerezolvat**.

---

## Ce NU facem în P0

- Nu setăm `BILLING_LIVE=true`.
- Nu lipim prețuri IAP în Play listing.
- Nu activăm App Check Enforce.
- Nu adăugăm open banking / login bancar.
