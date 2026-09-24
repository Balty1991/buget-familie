# Răspunsuri Data safety — Google Play Console

Text gata de lipit / bifat în **Play Console → Politica aplicației → Siguranța datelor**.  
Aliniat la aplicația reală (versiune listing **1.1.95** / `versionCode` **97**).  
Surse: `client/public/privacy.html`, `AndroidManifest.xml` (`allowBackup=false`), sync AES-GCM, IndexedDB bonuri.

> Nu este sfat juridic. Reverifică formularele Play dacă Google schimbă etichetele.

---

## A. Prezentare rapidă (da / nu)

| Întrebare tipică Play | Răspuns | Motiv în app |
|---|---|---|
| Colectează aplicația date despre utilizator? | **Da** | Date financiare introduse de utilizator (mișcări, plicuri etc.) |
| Datele sunt criptate în tranzit? | **Da** (pentru sync opțional) | HTTPS + pachet AES-GCM înainte de Firestore |
| Utilizatorii pot cere ștergerea datelor? | **Da** | Resetare in-app + [delete-data.html](https://balty1991.github.io/buget-familie/delete-data.html) |
| Cont obligatoriu? | **Nu** | Core use fără cont / fără login |
| Publicitate / vânzare date / brokeri? | **Nu** | Fără ads, fără sale, fără sharing comercial |
| Login bancar / Open Banking? | **Nu** | Doar registru local; CSV opțional, confirmat manual |

---

## B. Tipuri de date (categorii Play)

### 1. Informații financiare

| Câmp Play | Alegere |
|---|---|
| Categorie | **Informații financiare** → Istoric de achiziții / informații financiare introduse de utilizator |
| Colectat? | **Da** |
| Partajat cu terți? | **Nu** (dezvoltatorul nu vinde și nu partajează comercial; vezi sync mai jos) |
| Prelucrat efemer? | **Nu** — stocate pe dispozitiv până la ștergere |
| Obligatoriu / opțional | **Obligatoriu pentru funcție** (registrul), dar **nu** pentru a „crea cont” |
| Scopuri | Funcționalitatea aplicației (evidență buget / plicuri) |

**Text scurt pentru formulare / note:**

```
Date financiare (sume, categorii, plicuri, datorii, scadențe) sunt introduse de utilizator
și stocate în principal pe dispozitiv (IndexedDB / stocare WebView). Fără login bancar.
Fără vânzare de date. Backup-ul sistem Android este dezactivat (allowBackup=false).
```

### 2. Fotografii și videoclipuri (bonuri)

| Câmp Play | Alegere |
|---|---|
| Categorie | **Fotografii și videoclipuri** (sau Imagini selectate de utilizator) |
| Colectat? | **Da** — doar dacă utilizatorul alege un bon |
| Partajat? | **Nu** |
| Unde stau | **Doar local**, IndexedDB pe telefon |
| Sync familie | **Nu** — pozele **nu** intră în pachetul criptat |

```
Fotografiile bonurilor rămân pe telefon (IndexedDB). Nu se sincronizează între dispozitive.
OCR-ul rulează local. Utilizatorul confirmă în „De verificat” înainte ca suma să intre în registru.
```

### 3. Identificatori de dispozitiv / aplicație (identitate anonimă)

| Câmp Play | Alegere |
|---|---|
| Categorie | **Identificatori de dispozitiv sau alte ID-uri** |
| Colectat? | **Da** — ID anonim Firebase Authentication, când folosești sync, ghidul online sau feedbackul |
| Partajat? | **Nu** |
| Scopuri | **Funcționalitatea aplicației**, **Prevenirea fraudei, securitate și conformitate** (acces la camere, limite pe telefon) |
| Ce ajunge pe server la sync | ID cameră aleator + ciphertext AES-GCM; cheia camerei **nu** pleacă de pe telefoane |

```
Telefonul primește un identificator anonim aleator (Firebase Authentication), fără nume,
e-mail sau cont. Sincronizarea de familie este opțională; pe Firestore ajunge doar un pachet
AES-GCM, iar dezvoltatorul nu poate citi sumele în clar.
```

### 3b. Feedback din aplicație („Spune-ne ce nu merge”)

| Câmp Play | Alegere |
|---|---|
| Categorie | **Activitate în aplicație → Alt conținut generat de utilizator**; **Informații despre aplicație și performanță → Alte date** (versiune, ecran, tip telefon — doar cu bifa) |
| Categorie (dacă omul își lasă contactul) | **Informații personale → Adresă de e-mail / Număr de telefon**, opțional |
| Colectat? | **Da, opțional** — doar când omul trimite un mesaj |
| Partajat? | **Nu** |
| Scop | **Funcționalitatea aplicației** (repararea problemelor) |

### 4. Mesaje / chat AI (opțional)

| Câmp Play | Alegere |
|---|---|
| Categorie | Mesaje / conținut generat de utilizator (dacă există) **sau** note în „Alte date” |
| Colectat? | **Da, opțional** — doar când ghidul local nu înțelege și utilizatorul folosește rezervă online |
| Ce pleacă | **Rezumat scurt**, nu registrul întreg, nu poze, nu parola |
| Destinatar | Google Gemini (când e folosit ghidul online) |

```
Ghidul rămâne local. Dacă ghidul de pe telefon nu înțelege, poate pleca un rezumat scurt
către Google Gemini — niciodată registrul complet, fotografiile de bonuri sau parola de familie.
```

### 5. Date care NU se colectează (bifează „Nu”)

- Locație precisă / aproximativă  
- Contacte  
- Microfon / înregistrări audio  
- Conturi de autentificare (Google/Facebook etc.) pentru core use  
- Date de sănătate  
- SMS / jurnal de apeluri  
- Publicitate ID / advertising ID în scop de ads  

---

## C. Partajare de date (Data sharing)

| Întrebare | Răspuns |
|---|---|
| Se partajează date cu terți în sensul Play (vânzare, publicitate, brokeri)? | **Nu** |
| Firebase / Firestore | Infrastructură pentru **ciphertext** sync opțional — nu e „sale of data”; nu citește plaintext financiar |
| Gemini | Doar rezumat opțional din ghid — **dezvăluit** în privacy + aici |
| Umami analytics | **Opțional**, doar dacă e configurat la build; nu e SDK de ads |

În formular: **Nu vindem datele utilizatorilor** · **Nu folosim date pentru publicitate**.

---

## D. Securitate și ștergere

| Câmp Play | Alegere / text |
|---|---|
| Date criptate în tranzit | **Da** (HTTPS; sync: AES-GCM pe payload) |
| Utilizatorii pot solicita ștergerea | **Da** |
| Cum | 1) In-app: Setări → Resetare → „Resetează datele locale” · 2) Public: https://balty1991.github.io/buget-familie/delete-data.html · 3) Dezinstalare |
| Cont de șters la dezvoltator | **Nu există** cont Buget Familie |
| Cameră familie | Schimbați parola (≥12 caractere) pe telefoanele rămase; camera veche rămâne indescifrabilă |
| Backup Android | **Dezactivat** — `android:allowBackup="false"` |

---

## E. Conturi și autentificare

| Câmp | Răspuns |
|---|---|
| Creare cont obligatorie | **Nu** |
| Login pentru funcțiile de bază | **Nu** |
| Sync familie | Invitație (cheie aleatoare) între telefoane — **nu** este cont de utilizator la dezvoltator |
| Identitate anonimă Firebase | ID aleator pe telefon, fără date de login — nu e cont |

---

## F. Declarații financiare Play (legate, dar separate de Data safety)

- **Financial features:** evidență personală / de familie.  
- **Nu** este sfat de investiții, credit, brokeraj sau inițiere de plăți bancare.  
- **Nu** există login bancar în aplicație.

---

## G. Checklist rapid înainte de Submit

- [ ] Informații financiare = Da, pe dispozitiv, scop Funcționalitate  
- [ ] Fotografii bonuri = Da, local, nu sync, nu partajare  
- [ ] Sync = opțional, criptat, dezvoltator fără plaintext  
- [ ] AI online = opțional, doar rezumat — bifat / dezvăluit  
- [ ] Identificatori = Da (ID anonim Firebase), funcționalitate + securitate, nu partajare  
- [ ] Feedback = opțional; conținut scris de utilizator + contact opțional + date tehnice  
- [ ] Ads / sale / data brokers = Nu  
- [ ] allowBackup = false menționat dacă există câmp de note  
- [ ] URL ștergere + email `contact.vanzo@gmail.com`  
- [ ] Privacy publică: https://balty1991.github.io/buget-familie/privacy.html  

**Billing:** `BILLING_LIVE = false` — nu declara plăți IAP live în Data safety până la activare.
