# Play checklist — validare pe telefon

Nu putem testa widgetul / dala pe un dispozitiv fizic în mediul de build. Înainte de încărcarea pe Google Play, verifică pe un telefon Android:

## Widget (ecran principal)

- [ ] Adaugă widgetul „Buget Familie — Captură rapidă” pe home screen
- [ ] Butonul **Cheltuială** deschide captura rapidă (foaia de sumă)
- [ ] Butonul **Bon** deschide formularul de bon
- [ ] Apăsarea pe titlul/widget root deschide **Astăzi**
- [ ] Cu aplicația deja deschisă în fundal, widgetul tot livrează acțiunea (fără a pierde intent-ul)
- [ ] Widgetul **nu** afișează sume (privacy pe ecranul de start)
- [ ] Dacă ai șabloane de cheltuială: apar până la **3 etichete** pe widget (fără sume); o apăsare deschide captura cu șablonul selectat
- [ ] Fără șabloane, rândul de șabloane pe widget rămâne ascuns

> **Hardware necesar:** widgetul, șabloanele pe widget și dala nu pot fi validate în CI — bifează pe un telefon Android real după `cap:sync` / APK debug.

## Dala Setări rapide

- [ ] Adaugă dala din Setări rapide → Editează → Buget Familie
- [ ] O apăsare deschide captura rapidă de cheltuială
- [ ] Funcționează pe Android 14+ (PendingIntent) și pe 10–13

## App Check (Firebase)

Detalii: `docs/app-check-enforce-prep.md` · env: `.env.example`

- [ ] `VITE_RECAPTCHA_SITE_KEY` setat pe build-ul de release **sau** cheia lipită în `firebase-config.ts`
- [ ] App Check → provider reCAPTCHA Enterprise pe app-ul web/Android din Firebase
- [ ] Metrics arată tokenuri **valide** pe build-ul pe care îl testezi
- [ ] **Nu** activa Enforce pe Firestore până confirmi tokenuri pe build-ul publicat
- [ ] Pentru debug Capacitor: `VITE_APPCHECK_DEBUG=true` + debug token în Console


## Reamintiri WorkManager (Android)

- [ ] Cu alertele activate, închide aplicația: o tranșă care începe mâine / salariu aproape ar trebui să notifice (orizont scurt, fără spam)
- [ ] Canalul „Reamintiri plan” apare în Setări sistem → Aplicații → Buget Familie → Notificări
- [ ] Widgetul / dala rămân neschimbate (probe hardware pe telefon — vezi secțiunile de mai sus)

## Sync / dispozitive

- [ ] Generează parola o dată pe telefonul A, introdu-o pe B
- [ ] Lista de dispozitive arată ambele telefoane cu „ultima dată văzut”
- [ ] Revocarea unui telefon închide sesiunea pe acel aparat la următorul sync
- [ ] Conflict de sumă pe același plic: badge pe Plan + Păstrează local / remote / Anulează

## Listing Play (notă)

În descrierea magazinului: menționează widgetul și dala din Setări rapide pentru adăugare rapidă fără sume pe ecranul de start. Abonamentele Premium se adaugă **după** o versiune stabilă pe Play — nu în acest build.
