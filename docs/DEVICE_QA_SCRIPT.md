# Script QA pe telefon — 20–30 minute

Validare practică înainte de closed testing / producție.  
**Build:** `versionName` **1.1.67** · `versionCode` **69** · pachet `ro.balty1991.bugetfamilie`  
**Billing:** `BILLING_LIVE = false` — nu testa plăți IAP.  
Derivat din [`PLAY_CHECKLIST.md`](../PLAY_CHECKLIST.md). Ordinea economisește timp (setup → captura → sync → backup → conflict).

**Pregătire:** APK/AAB debug sau internal pe **un** mid-range Android; pentru sync ai nevoie de **al doilea** telefon (sau emulator + fizic). Cronometru ~25 min.

---

## 0. Instalare și first-run (2 min)

- [ ] Instalează build-ul 1.1.67 / 69; deschide aplicația
- [ ] First-run: treci ecranul de valoare (plicuri / ciclu / fără bancă) fără crash
- [ ] Creează un ciclu scurt (ex. 7–14 zile) + 2–3 plicuri cu sume mici de test
- [ ] Adaugă un membru „Eu” (și, dacă ai timp, un al doilea membru pe Familia de test — acum totul e deblocat)

---

## 1. Hero „cât poți cheltui” / Astăzi (3 min)

- [ ] Pe **Astăzi**, hero-ul arată **un număr de decizie** (spendable / cât poți folosi), nu doar soldul total de cash
- [ ] Numărul se schimbă după o cheltuială din plicul activ (salvează 10–20 lei dintr-un plic)
- [ ] Captură rapidă din Astăzi: sumă → categorie cu plic → salvează; mișcarea apare în feed / Mișcări
- [ ] Nu apare „nealocat” fals când totul e deja în plicuri (taxi/alimente din plic potrivit)

---

## 2. Widget pe home screen (4 min)

- [ ] Long-press home → Widgeturi → **Buget Familie — Captură rapidă** → plasează
- [ ] **Cheltuială** → se deschide foaia de sumă (captură rapidă)
- [ ] **Bon** → se deschide formularul de bon
- [ ] Apasă titlul / zona root a widgetului → deschide **Astăzi**
- [ ] App în recents (nu omorâtă din recents): **Cheltuială** deschide foaia după ce ecranul revine. Apăsarea nu se pierde.
- [ ] Widgetul **nu** afișează sume pe ecranul de start
- [ ] Dacă ai șabloane: apar până la **3 etichete** (fără sume); o apăsare preselectează șablonul
- [ ] Fără șabloane: rândul de șabloane e ascuns

---

## 3. Dală Setări rapide (2 min)

- [ ] Trage panoul QS → Editează → adaugă dala **Buget Familie**
- [ ] O apăsare pe dală → captura rapidă de cheltuială
- [ ] (Android 14+: PendingIntent OK; pe 10–13 tot deschide captura)

---

## 4. Sync pe 2 dispozitive (6–8 min)

**Telefon A (sursă)**  
- [ ] Mai mult / Instrumente → **Sincronizare**  
- [ ] Generează / alege o parolă de familie ≥12 caractere; **Conectează acest telefon**  
- [ ] Notează parola (doar pentru test; nu o pune în ticket-uri publice)

**Telefon B**  
- [ ] Instalează același build; introdu **exact** aceeași parolă → Conectează  
- [ ] Lista de dispozitive arată **ambele** telefoane cu „ultima dată văzut”

**Verificare live**  
- [ ] Pe A: adaugă o cheltuială dintr-un plic → pe B apare în câteva secunde (app deschisă)  
- [ ] Pe B: editează altceva (notă / altă sumă pe altă mișcare) → A se actualizează  
- [ ] Confirmă că **pozele de bon** de pe A **nu** apar pe B (nu se sync)

**Revocare (opțional, +1 min)**  
- [ ] Pe A: revocă dispozitivul B → pe B, la următorul sync, sesiunea se închide / nu mai împinge

---

## 5. Banner conflict pe plic (3 min)

- [ ] Cu sync activ pe A și B, editează **în același timp** suma / limita **aceluiași plic** (salvează pe ambele înainte să ajungă pachetul)
- [ ] Apare **badge / banner pe Plan** (conflict), nu un overwrite tăcut tip LWW pe bani
- [ ] Opțiuni vizibile: **Păstrează local** / **Păstrează remote** / **Anulează** (sau etichete echivalente)
- [ ] După alegere, ambele telefoane converg fără date pierdute pe celelalte plicuri

---

## 6. Backup: Salvează pe telefon vs Trimite copie (3 min)

- [ ] Setări → Backup / Export  
- [ ] **Salvează pe telefon** (sau „Salvează fișierul”) → JSON ajunge în Download / folder ales; toast/confirmare clară  
- [ ] **Trimite copie** / Share → sheet-ul de share al sistemului (Drive, Files, etc.) — **nu** confundă cu salvare locală  
- [ ] Import: alege JSON-ul salvat pe un telefon curat / după reset parțial → registrul revine  
- [ ] (Smoke) Resetare locală → confirmă golire → reimport din fișierul salvat

---

## 7. Smoke scurt (2 min) — dacă mai ai timp

- [ ] De verificat: un bon sau CSV mock → confirmă → intră în registru  
- [ ] PIN local (dacă e activat): blochează / deblochează  
- [ ] Temă Noapte: Astăzi rămâne lizibil  
- [ ] Fără crash la rotație pe captura rapidă

---

## Rezultat

| Câmp | Valoare |
|---|---|
| Dispozitiv / Android | _…_ |
| Build | 1.1.67 / 69 |
| Data (Europe/Bucharest) | _…_ |
| Pass / Fail | _…_ |
| Note (widget / sync / conflict) | _…_ |

**Fail blockers tipice:** widget fără acțiune, sume pe widget, sync care nu unește, conflict fără banner, backup Share în loc de Save confuz pentru utilizator, pierdere date la reset.

---

## Ce nu e în acest script

- App Check Enforce (doar metrics — vezi `docs/app-check-enforce-prep.md`)  
- Play Billing / cumpărături (`BILLING_LIVE` off)  
- WorkManager pe orizont >14 zile (reamintiri: orizont scurt; reprogramează la open)
