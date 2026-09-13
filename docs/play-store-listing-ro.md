# Listare Google Play — Buget Familie

Text gata de lipit în Play Console. Plățile (Play Billing) se fac separat, după closed testing.

## Identitate

| Câmp | Valoare |
|---|---|
| Nume (max 30) | Buget Familie |
| Pachet | `ro.balty1991.bugetfamilie` |
| versionName | `1.1` |
| versionCode | `2` |
| Categorie | Finance |
| Etichete | Buget, Familie, Cheltuieli, Plicuri, România |
| Contact | contact.vanzo@gmail.com |
| Politică | https://balty1991.github.io/buget-familie/privacy.html |
| Termeni | https://balty1991.github.io/buget-familie/terms.html |
| Ștergere date | https://balty1991.github.io/buget-familie/delete-data.html |

## Descriere scurtă (80 caractere)

```
Cât poți cheltui azi, până la salariu. Plicuri de familie, fără bancă.
```

(70 caractere cu spații)

## Descriere completă

```
Buget Familie este registrul unei gospodării românești: fiecare leu are un loc până la următorul venit.

Cât poți folosi azi — un singur număr, explicat. Plicurile sunt limite de plan, nu conturi. Banii stau pe card, cash sau bonuri de masă. Aplicația îți spune din ce săptămână scoți, nu îți inventează un „nealocat” când totul e deja așezat.

De ce e altfel
• Plicuri pe categorie, membru și sursă — card, cash, bonuri de masă, transfer comun.
• Fără login bancar și fără cont. Datele stau pe telefon.
• Sincronizare opțională între telefoane: o parolă de familie, pachet AES-GCM; serverul nu vede lei în clar.
• Feed familie: cine a scos, din ce plic, acum câteva minute.
• Bonuri cu OCR local. Pozele nu pleacă de pe telefon. Confirmi în De verificat înainte de registru.
• CSV de la BCR, BT, ING, Revolut — tot prin De verificat, fără să se scrie singur.
• Ghid în română, pe telefon. La Gemini pleacă doar un rezumat, dacă ghidul local n-a înțeles.
• Widget și dală: cheltuială sau bon, fără sume pe ecranul de start.
• PDF de bilanț și CSV, generate în aplicație.

Planuri (după listare, fără reclame pe ecranele cu bani)
• Casa — gratuit: registrul de bază, până la 4 plicuri, un membru.
• Familia — un abonament pentru toată casa: sync criptat, plicuri nelimitate, până la 6 persoane. Prețul apare pe Google Play când Billing e activ. Dacă anulezi, registrul rămâne pe telefon.

Aplicația nu plătește facturi, nu investește și nu înlocuiește un consultant. Este un registru de familie, în română, în lei.
```

## Feature bullets

1. Un număr pe Astăzi: cât poți cheltui până la salariu
2. Plicuri pe ciclu salarial, membru și sursă
3. Sync familie criptat, fără cont bancar
4. Bon și CSV → De verificat → registru
5. Feed familie: cine a mișcat banii
6. Widget rapid, fără sume pe ecranul de acasă
7. Ghid local, cu rezervă online doar când e nevoie
8. Casa gratuită. Familia = un plan pentru toată casa

## Data safety (răspunsuri)

- Date financiare: da, colectate de aplicație, stocate pe dispozitiv.
- Sincronizare: da, opțională; criptare în tranzit și în repaus (AES-GCM); dezvoltatorul nu poate citi plaintext.
- Cont utilizator: nu.
- Publicitate / sharing / vânzare: nu.
- Analytics: opțional Umami, doar dacă e configurat la build.
- Backup sistem Android: nu (`allowBackup=false`).
- Ștergere: in-app Resetare + pagina publică de ștergere.
- AI: rezumat opțional către Gemini, niciodată registrul întreg.

## Content rating

App de finanțe personale, fără user-generated public, fără violență, fără locație. Public țintă: 18+.

## Declarații Play

- **Financial features:** evidență personală / de familie. Nu e sfat de investiții, nu e credit, nu inițiază plăți.
- **Closed testing:** 12+ testers, 14 zile, înainte de producție.
- **Play Billing:** dezactivat în acest build. Produsele Casa (gratuit) și Familia (`familie_lunar`, `familie_anual`) se creează în Console după listare.

## Grafică de magazin

- Grafic caracteristică: [play-feature.svg](https://balty1991.github.io/buget-familie/play-feature.svg) — exportă PNG 1024×500 (Play nu acceptă SVG).
- Capturi: Astăzi (un număr + feed), Plan (plicuri), Mișcări, De verificat, Sync, Analiză, temă Noapte, Setări → Încredere.

## Ce NU s-a atins

`family-crypto.ts`, `realtime-sync.ts`, `firestore.rules` — protocolul de familie rămâne identic. Play Billing nu e pornit (`BILLING_LIVE = false`).
