# Play listing helpers — Buget Familie (RO)

Text gata de lipit în Play Console. **Fără upload fals în store.** Plățile (Play Billing) și App Check Enforce rămân afară.

## Identitate

| Câmp | Valoare |
|---|---|
| Nume | Buget Familie |
| Pachet | `ro.balty1991.bugetfamilie` |
| Categorie | Finance |
| Contact | contact.vanzo@gmail.com |
| Politică | https://balty1991.github.io/buget-familie/privacy.html |
| Termeni | https://balty1991.github.io/buget-familie/terms.html |
| Ștergere date | https://balty1991.github.io/buget-familie/delete-data.html |

## Descriere scurtă (≤80 caractere)

```
Plicuri de familie în lei, până la salariu. Fără bancă, sync criptat.
```

(73 caractere cu spații)

## Descriere completă

```
Buget Familie este registrul unei gospodării românești: fiecare leu are un loc până la următorul venit.

De ce e altfel
• Plicuri pe categorie, membru și sursă — card, cash, bonuri de masă, transfer comun.
• Fără login bancar și fără cont. Datele stau pe telefon.
• Sincronizare opțională între telefoane: o parolă de familie, pachet AES-GCM; serverul nu vede lei în clar.
• Astăzi: un număr de decizie — cât poți folosi fără să strici următoarea perioadă.
• Scor de sănătate, ritm zilnic, recapitulare de lună.
• El și ea: cine a mișcat banii, fără conturi separate.
• Bonuri cu OCR local. Pozele nu pleacă de pe telefon.
• De verificat: bonuri și CSV bancă (BCR, BT, ING, Revolut) confirmate înainte de registru.
• PDF de bilanț și CSV, generate în aplicație.
• Teme: Alb Atelier, Noapte, Aurora, Navy, Cyber — contrast verificat pe controale.
• Reamintiri locale pe orizont scurt (≤14 zile); la deschiderea aplicației se reprogramează. Fără spam WorkManager.

Aplicația nu plătește facturi, nu investește și nu înlocuiește un consultant. Este un atelier de decizii, în română, în lei.
```

## Feature bullets (Play „Despre această aplicație” / highlight)

1. Plicuri pe ciclu salarial, nu doar pe lună calendaristică
2. Sync familie criptat AES-GCM, fără cont bancar
3. Bon → De verificat → registru (poze doar pe telefon)
4. Import CSV bănci RO + dedupe
5. Un număr clar pe Astăzi: ce poți cheltui azi
6. Conflict onest pe plicuri și mișcări (nu LWW tăcut pe bani)
7. Widget rapid Cheltuială / Bon (fără sume pe ecranul de acasă)
8. PIN local opțional; backup export/import

## Listă capturi (screenshot shot list)

Ordine sugerată, telefon 1080×1920 sau similar, temă **Alb Atelier Platinum**:

1. **Astăzi** — hero cu o singură cifră de decizie + buton de captură
2. **Plan** — listă de plicuri cu stare în plan / aproape / depășit
3. **Mișcări** — jurnal pe zile + filtru Tip
4. **De verificat** — coadă bon/CSV înainte de registru
5. **Sync** — sesiune familie + „ce nu se sincronizează”
6. **Analiză / Gospodărie** — ritm sau scor sănătate
7. **Temă Noapte** (sau Aurora) — același Astăzi, contrast umplut
8. **Obligații** — scadențe + datorii (opțional)

Note captură: fără date reale ale utilizatorului; folosește demouri inventate; ascunde bare de sistem zgomotoase.

## Privacy blurb (Data safety / scurt pentru listing)

```
Datele financiare stau pe telefon. Sincronizarea între telefoanele familiei este opțională și criptată (AES-GCM) cu o parolă pe care doar voi o cunoașteți — dezvoltatorul nu poate citi sumele. Fotografiile bonurilor nu se sincronizează. Fără publicitate, fără vânzare de date, fără login bancar. Backupul sistem Android este dezactivat (allowBackup=false). Poți șterge totul din aplicație sau de pe pagina publică de ștergere.
```


## Asset-uri grafice (repo)

Director: [`docs/play-store-assets/`](./play-store-assets/)

| Fișier | Spec | Rol |
|---|---|---|
| `feature-graphic.png` (+ `.svg`) | 1024×500 | Feature graphic Play |
| `icon-512.png` (+ `.svg`) | 512×512 | Icon high-res Play |
| `SCREENSHOTS.md` | — | Ordine capturi + note brand |

Brand: emerald/sage Premium (`#0F3D34` / `#143c36`, plic `#3AA87C`). Iconița și splash-ul Android din `android/app/src/main/res/` folosesc același limbaj vizual (adaptive + monochrome).

## Ce NU se face aici

- Nu se încarcă AAB/APK în Play din acest document
- Nu se activează Play Billing
- Nu se activează App Check **Enforce** (doar metrics, dacă e cazul)
