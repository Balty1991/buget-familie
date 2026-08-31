# Listare Google Play — Buget Familie

Text gata de lipit în Play Console. Plățile (Play Billing) se fac separat, ulterior.

## Identitate

| Câmp | Valoare |
|---|---|
| Nume | Buget Familie |
| Pachet | `ro.balty1991.bugetfamilie` |
| versionName | `1.1` |
| versionCode | `2` |
| Categorie | Finance |
| Contact | contact.vanzo@gmail.com |
| Politică | https://balty1991.github.io/buget-familie/privacy.html |
| Termeni | https://balty1991.github.io/buget-familie/terms.html |
| Ștergere date | https://balty1991.github.io/buget-familie/delete-data.html |

## Descriere scurtă (80 caractere)

Plicuri de familie în lei, până la salariu. Fără bancă, cu sync criptat.

## Descriere completă

Buget Familie este registrul unei gospodării românești: fiecare leu are un loc până la următorul venit.

**De ce e altfel**
• Plicuri pe categorie, membru și sursă — card, cash, bonuri de masă, transfer comun.
• Fără login bancar și fără cont. Datele stau pe telefon.
• Sincronizare opțională între telefoane: o parolă de familie, pachet AES-GCM, serverul nu vede lei în clar.
• Scor de sănătate, ritm zilnic, recapitulare de lună, vârstă a banilor.
• Vânător de abonamente din istoricul tău, nu din extrasul băncii.
• El și ea: cine a mișcat banii, fără conturi separate.
• Bonuri cu OCR local. Pozele nu pleacă de pe telefon.
• PDF de bilanț și CSV, generate în aplicație.

Aplicația nu plătește facturi, nu investește și nu înlocuiește un consultant. Este un atelier de decizii, în română, în lei.

## Data safety (răspunsuri)

- Date financiare: da, colectate de aplicație, stocate pe dispozitiv.
- Sincronizare: da, opțională; criptare în tranzit și în repaus (AES-GCM); dezvoltatorul nu poate citi plaintext.
- Cont utilizator: nu.
- Publicitate / sharing / vânzare: nu.
- Analytics: opțional Umami, doar dacă e configurat la build.
- Backup sistem Android: nu (`allowBackup=false`).
- Ștergere: in-app Resetare + pagina publică de ștergere.

## Content rating

App de finanțe personale, fără user-generated public, fără violență, fără locație. Public țintă: 18+.

## Ce NU s-a atins

`family-crypto.ts`, `realtime-sync.ts`, `firestore.rules` — protocolul de familie rămâne identic.
