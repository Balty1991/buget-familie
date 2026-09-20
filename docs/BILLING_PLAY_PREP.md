# Prep tehnic Play Billing — fără activare

**Stare:** documentație + stub-uri în `entitlements.ts`.  
**`BILLING_LIVE` trebuie să rămână `false`** până la checklist-ul de jos.  
**Nu** s-au adăugat pachete npm Billing în acest pas (fără clone/`pnpm install` fiabil pe agent); le adaugi local la implementare.

---

## Product IDs (sugestie Play Console)

| SKU Play | Constantă client | Plan | Perioadă |
|---|---|---|---|
| `familie_lunar` | `PLAY_PRODUCT_IDS.familieMonth` | Familia | lună |
| `familie_anual` | `PLAY_PRODUCT_IDS.familieYear` | Familia | an |

Casa rămâne free (fără SKU). Family+ (29,99 / 229) — SKU-uri separate doar când P2 e justificat.

În Consolă: tip **Subscription**, bază RON, trial 14 zile pe ambele SKU (sau pe anual), clear cancel path.

---

## Opțiuni plugin Capacitor (alege una la implementare)

1. **`@capgo/native-purchases`** — Billing Library 5+/6, API Capacitor 6–8; bun default pentru abonamente.
2. **`@revenuecat/purchases-capacitor`** — dacă vrei dashboard + entitlements server-side fără backend propriu.
3. **Cordova/community in-app-purchases** — de evitat pe Capacitor 8 (API vechi).

Pași tipici (local, pe clone):

```bash
pnpm add @capgo/native-purchases   # sau RevenueCat
npx cap sync android
```

Apoi: produse create în Play Console → license testers → internal/closed track cu Billing.

---

## Unde se agață `entitlements.ts`

Fișier: `client/src/lib/entitlements.ts`

| Export | Rol |
|---|---|
| `BILLING_LIVE` | Master switch. `false` → `currentPlan()` = `"familie"` (totul deblocat pentru test). |
| `PLANS` | Limite + prețuri catalog (Casa 10 plicuri; Familia 19.99 / 149, 6 membri). |
| `PLAY_PRODUCT_IDS` | Mapare SKU → lună/an. |
| `TRIAL_DAYS` | 14 — copy UI + Play Console. |
| `formatPlanPriceRon` | UI catalog („19,99 lei/lună”). |
| `canAddEnvelope` / `canAddMember` / `canUseFamilySync` | Gate-uri soft când Billing e live. |

**Flux stub (acum):** UI (`PremiumStudio`) citește `PLANS` + mesaj „catalog / testare”; **nu** apelează purchase.

**Flux live (viitor):**

1. La start: `restorePurchases()` → mapează SKU activ la `PlanId`.
2. Persistă entitlement local (și opțional token Play) — **nu** șterge `AppData`.
3. `currentPlan()` citește entitlement dacă `BILLING_LIVE`, altfel Casa.
4. Soft paywall pe sync / plicuri > Casa / AI over-quota — **nu** pe captura de cheltuială.

---

## Restore / downgrade fără pierdere de date

| Eveniment | Comportament așteptat |
|---|---|
| Restore | Reîncarcă SKU-uri; dacă Familia e activ → unlock sync/plicuri; registrul local neschimbat. |
| Expirare / anulare | Downgrade la Casa: **păstrează** toate plicurile și mișcările; blochează doar *crearea* peste limită + sync nou. |
| Downgrade cu >10 plicuri | Read-only pe plicurile extra; copy clar: „poți cheltui din ele; nu poți adăuga altele până la Familia”. |
| Schimb device | Restore pe noul telefon înainte de a cere upgrade. |
| Conflict sync după expirare | Datele rămân pe telefon; sync push poate fi refuzat cu mesaj uman, nu wipe. |

Regulă de aur: **Billing controlează feature flags, nu ledger-ul.**

---

## Checklist înainte de `BILLING_LIVE = true`

- [ ] Closed testing ≥14 zile fără incidente sync/backup.
- [ ] SKU `familie_lunar` + `familie_anual` active în Consolă (draft OK pe internal).
- [ ] License testers pot cumpăra / anula / restore pe build semnat release.
- [ ] Soft paywall doar pe gate-uri Casa; cheltuiala rămâne free.
- [ ] Buton „Restaurează cumpărăturile” vizibil în catalog.
- [ ] Downgrade >10 plicuri testat manual (fără ștergere).
- [ ] Privacy **§11** actualizat (abonamente via Google Play; anulare din Play).
- [ ] Data safety + listing: prețuri IAP **doar acum** (nu înainte).
- [ ] `pnpm test` verde pe `entitlements.test.ts`.
- [ ] Feature flag: un singur commit care basculează `BILLING_LIVE` (ușor de revert).

---

## Reminder privacy §11

Cât `BILLING_LIVE === false`, privacy poate spune că nu se vând abonamente în app.  
**La go-live:** actualizează `client/public/privacy.html` §11 + termenii: plăți prin Google Play, trial 14 zile, anulare din abonamentele Google, datele financiare rămân pe dispozitiv după anulare.

---

## Ce nu e în acest prep

- Nu se comit secrete Play / service accounts.
- Nu se adaugă dependențe Billing în `package.json` din agent (fără install fiabil) — documentat aici pentru pasul local.
- Nu se activează fake charges în UI.
