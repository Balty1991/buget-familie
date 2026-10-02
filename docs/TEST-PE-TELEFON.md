# De verificat pe telefon, înainte de lansare

Ce nu se poate verifica în browserul de test: recunoașterea vocală a telefonului, widgeturile,
notificările și sincronizarea între două telefoane reale. Durează cam 20 de minute.
Construiește întâi AAB-ul (Actions → Release Android AAB) și instalează-l din testarea închisă.

## 1. Prima pornire (2 min)
- [ ] Dezinstalează aplicația, instaleaz-o din nou. Apare „Vezi întâi cu o familie exemplu”.
- [ ] Atinge-l: aplicația se umple cu familia Popescu, sus apare banda „Familie exemplu”.
- [ ] „Încep cu datele mele” golește tot și deschide pornirea (cei 3 pași).

## 2. Notare din voce (3 min)
- [ ] Notează → „Spune ce ai cumpărat”. Se deschide dialogul de voce al telefonului (Google).
- [ ] Spune „cincizeci de lei la Lidl”: suma 50, magazinul Lidl, categoria Alimente, plicul ales.
- [ ] Spune „am dat 120 pe benzină”: 120, Transport.
- [ ] Anulează dialogul: formularul rămâne cum era, fără mesaj de eroare.
- [ ] Dacă butonul nu apare deloc: telefonul nu are aplicația Google / serviciul de voce (notează modelul).

## 3. Widgeturi (3 min)
- [ ] Ține apăsat pe ecranul de start → Widgeturi → Buget Familie: „Plicurile mele”, „Poți cheltui azi” și cel de notare rapidă.
- [ ] „Plicurile mele” arată trei plicuri cu bară și cât a rămas; după o cheltuială nouă se actualizează.
- [ ] Butonul „+” de pe widget deschide direct Notează.
- [ ] Cu blocarea aplicației (PIN) pornită, widgetul nu mai arată sume.

## 4. Notificări (3 min)
- [ ] Setări → Mementouri și siguranță → Activează alertele; permite notificările.
- [ ] „Trimite o notificare de test” ajunge în bara telefonului.
- [ ] Oprește „Amintirea de seară”, pornește-o la loc; schimbă ora la 21:00.
- [ ] Seara, la ora aleasă, fără nimic notat azi: vine amintirea (cu seria, dacă ai 3+ zile la rând).

## 5. Lista de cumpărături, pe două telefoane (5 min)
- [ ] Ambele telefoane în aceeași familie (Sync).
- [ ] Pe telefonul A: Mai mult → Lista de cumpărături → „lapte, pâine, ouă”.
- [ ] Pe telefonul B, după sincronizare: cele trei apar, cu „adăugat de …”.
- [ ] Bifează „lapte” pe B; pe A apare în „În coș”.
- [ ] Pe A: „Am terminat — notează plata” → se deschide Notează pe Alimente; după sincronizare, pe B lista nu mai are laptele.

## 6. „Anul vostru” și imaginea (2 min)
- [ ] Analiză → Gospodărie → „Anul vostru” (apare după 20 de zile notate în an).
- [ ] Atingi dreapta / stânga: ecranele merg înainte / înapoi; X închide.
- [ ] La final, „Trimite imaginea anului” deschide lista de aplicații (WhatsApp); imaginea nu are sume.

## 7. Tabletă sau telefon pliabil (dacă ai)
- [ ] Pe Astăzi, cifra zilei în stânga, restul în dreapta.

## 8. Scurtături și text mărit (2 min)
- [ ] Ține apăsat pe iconița aplicației: apar „Notează o cheltuială”, „Spune ce ai cumpărat”, „Lista de cumpărături”; fiecare deschide ecranul lui.
- [ ] Setări telefon → Afișaj → Dimensiunea fontului la maxim: textul din aplicație e mai mare, dar nimic nu iese din ecran.

## 9. Vacanța, pe două telefoane (3 min)
- [ ] Pe A: Mai mult → Vacanță → buget 2000, de azi pentru 3 zile, „Arată și în” EUR → Pornește.
- [ ] Notează 50 lei: chipul „Din bugetul vacanței” e pornit; pe Astăzi cardul vacanței scade cu 50, plicurile nu.
- [ ] Pe B, după sincronizare: aceeași vacanță și același „mai aveți”.
- [ ] Încheie vacanța pe B; pe A, după sincronizare, Notează nu mai arată chipul.

Ce nu merge: o captură de ecran și modelul telefonului, în aplicație la Mai mult → „Spune-ne ce nu merge”.
