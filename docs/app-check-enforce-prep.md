# App Check — pregătire Enforce (fără activare)

Scop: pregăti tokenurile pe build-ul publicat **înainte** de a bifa Enforce pe Firestore.
Enforce prematur blochează familiile care sincronizează fără token valid.

## Ce este deja în cod

- `client/src/lib/firebase-config.ts` — `VITE_RECAPTCHA_SITE_KEY` sau `RECAPTCHA_SITE_KEY_PLACEHOLDER`
- Debug Capacitor: `VITE_APPCHECK_DEBUG=true` + debug token din Console
- `client/src/lib/realtime-sync.ts` — `ReCaptchaEnterpriseProvider` + `initializeAppCheck` când există site key / debug
- `firestore.rules` — **nu** cere `request.appCheck`; comentariul din fișier spune explicit să nu activezi Enforce până confirmi tokenul

## Checklist mediu (env)

| Variabilă | Unde | Valoare |
|-----------|------|---------|
| `VITE_RECAPTCHA_SITE_KEY` | CI / build release web & Android | Site key reCAPTCHA **Enterprise** din Firebase App Check (nu secret classic) |
| `VITE_APPCHECK_DEBUG` | Doar debug local Capacitor | `true` (nu în store) |
| (opțional) `RECAPTCHA_SITE_KEY_PLACEHOLDER` | `firebase-config.ts` | Doar dacă nu setezi env la build |

Fișier de referință: `.env.example` (nu comite secrete reale).


## Site key publicat în client (placeholder)

`RECAPTCHA_SITE_KEY_PLACEHOLDER` din `client/src/lib/firebase-config.ts` este completat cu site key-ul **Enterprise** (`6Lc9zrctAAAAAAz27Nr8XWx9D3cRnBnHkChyyeCq`). Build-urile Pages/APK îl iau din bundle fără `.env` local. `VITE_RECAPTCHA_SITE_KEY` rămâne override la build (CI nu e obligatoriu).

**Firebase Console:** înregistrarea App Check pe web trebuie să folosească **același** site key Enterprise. Rămâne **Monitor**, nu Enforce.

## Pași în Firebase Console (ordine)

1. **Build → App Check** → înregistrează app-ul web (și Android dacă e în proiect).
2. Provider **reCAPTCHA Enterprise** pe web (classic / reCAPTCHA v3 e deprecated / blocked pe proiecte noi); pe Android poți folosi Play Integrity când ești pe Play.
3. Copiază **site key**-ul Enterprise (public, nu secret) → pune în `VITE_RECAPTCHA_SITE_KEY` pe pipeline-ul de release. Clientul folosește `ReCaptchaEnterpriseProvider`.
4. Construiește AAB/APK + Pages cu această cheie.
5. Deschide aplicația pe un telefon real / build publicat; în App Check → Metrics verifică că apar requesturi cu token **valid**.
6. Abia apoi, dacă metrics sunt verzi câteva zile: App Check → **Enforce** pe Firestore (și doar pe Firestore dacă e nevoie).

## Ce NU facem în acest commit / release

- Nu bifăm Enforce pe Firestore
- Nu schimbăm `firestore.rules` ca să ceară App Check
- Nu blocăm sync-ul când cheia lipsește (mesaj informativ în consolă rămâne suficient)

## Rollback dacă Enforce a fost activat din greșeală

1. Firebase Console → App Check → Firestore → dezactivează Enforce.
2. Sync-ul familiilor existente revine imediat; datele criptate nu sunt afectate.
3. Investighează metrics (token lipsă, debug pe release, site key greșit).

## Criteriu de „gata de Enforce”

- [ ] Build release cu `VITE_RECAPTCHA_SITE_KEY` setat
- [ ] Metrics App Check arată tokenuri valide pe web și pe Android store/internal testing
- [ ] Cel puțin un sync real de pe două telefoane cu parola de familie, după build-ul cu cheie
- [ ] PLAY_CHECKLIST.md — secțiunea App Check bifată pe dispozitiv

Până atunci: **Monitor**, nu Enforce.
