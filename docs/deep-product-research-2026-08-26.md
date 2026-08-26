# Cercetare aprofundată de produs — Buget Familie

## Constatări validate

| Sursă | Observație verificată | Decizie pentru Buget Familie |
|---|---|---|
| Goodbudget | Plicurile primesc venitul înainte de cheltuială, iar utilizatorul vede limita înainte de a o depăși. [1] | Păstrăm alocările ca plicuri digitale, iar asistentul va semnala ritmul și rezerva rămasă înainte de următoarea scadență. |
| YNAB | Un plan comun funcționează ca limbaj comun pentru priorități, inclusiv când finanțele rămân parțial separate. [2] | Extindem întâlnirea financiară de familie și explicațiile pe membru/sursă, nu doar totalul casei. |
| Honeydue | Vizibilitatea selectivă și dialogul în contextul unei facturi sau cheltuieli reduc conflictul în jurul banilor. [3] | Pregătim comentarii/întrebări legate de o mișcare ca funcție viitoare; nu expunem automat toate sursele personale. |
| Origin | Buget comun, întrebări despre gospodărie și obiective comune sunt prezentate ca un singur spațiu, nu ca produse izolate. [4] | Asistentul trebuie să lege planul, scadențele, obiectivele și jurnalul într-un răspuns acționabil. |
| Consumer.gov | Bugetul pornește din venituri și facturi, se urmărește zilnic și se revizuiește la sfârșitul perioadei. [5] | Adăugăm semnale pentru revizuirea de final de săptămână/perioadă și comparație planificat–cheltuit. |
| Bank of America Erica | O abordare cu intenții controlate poate oferi căutare de tranzacții, facturi recurente, categorii și snapshot-uri fără a depinde de un chatbot generativ. [6] | Prioritatea imediată este un asistent local, cu reguli explicabile și acțiuni directe; AI extern rămâne opțional și separat. |
| OpenAI Finances | Experiențele AI utile combină context, obiective, cheltuieli și plăți recurente, dar mențin controlul utilizatorului asupra conectării și ștergerii datelor. [7] | Orice AI externă va necesita acord explicit, un backend cu secret și posibilitate de deconectare/ștergere; GitHub Pages rămâne local implicit. |
| Android Developers | Iconițele adaptive folosesc fundal, foreground și opțional strat monocrom; simbolul critic trebuie să stea în zona sigură 66×66 dintr-un canvas 108×108. [8] | Implementăm resurse adaptive B/F pentru launcher, round icon și temare Android. |
| Android Developers | Android 13+ cere permisiune de notificări la moment relevant, nu la lansare. [9] | O eventuală alertă de scadență va fi activată doar de acțiunea explicită a utilizatorului. |
| OWASP MASVS | Datele sensibile la repaus, cheile criptografice, logurile, backupurile, notificările și capturile de ecran necesită control explicit în aplicațiile mobile. [10] | Nu afișăm sume sau detalii de tranzacție în notificări și menținem tokenul GitHub numai în memorie; o protecție biometrică va necesita resurse native și o evaluare separată. |
| W3C WCAG 2.2 | Țintele tactile au prag minim de 24×24 CSS px, iar controalele importante beneficiază de suprafețe mai mari și spațiere; ghidul mobil include reflow, focus neacoperit, gesturi cu un singur pointer și reducerea reintroducerii de date. [11] [12] | Păstrăm 44 px pentru controalele frecvente și evităm fluxurile care cer glisare sau reintroducerea acelorași date în formulare. |

## Roadmap rezultat

Prima tranșă de dezvoltare va cuprinde iconița nativă Android, o vedere de **check-in familial** pentru perioada curentă și extinderea asistentului local cu semnale proactive pentru ritmul de cheltuire, scadențe, rezervă și obiective. O a doua tranșă poate introduce comentarii contextuale la tranzacții și notificări locale, după ce utilizatorul alege explicit aceste funcții.

## Referințe

[1]: https://goodbudget.com/envelope-budgeting/ "Goodbudget — Envelope Budgeting"
[2]: https://www.ynab.com/guide/budgeting-as-a-couple "YNAB — Budgeting as a Couple"
[3]: https://www.honeydue.com/ "Honeydue — Couples Finance"
[4]: https://useorigin.com/couples "Origin — Couples Budgeting"
[5]: https://consumer.gov/your-money/making-budget "Consumer.gov — Making a Budget"
[6]: https://info.bankofamerica.com/en/digital-banking/erica "Bank of America — Erica"
[7]: https://openai.com/index/personal-finance-chatgpt/ "OpenAI — Personal Finance Experience"
[8]: https://developer.android.com/develop/ui/compose/system/icon_design_adaptive "Android Developers — Adaptive Icons"
[9]: https://developer.android.com/develop/ui/compose/notifications/notification-permission "Android Developers — Notification Permission"
[10]: https://mas.owasp.org/MASVS/05-MASVS-STORAGE/ "OWASP MASVS — Storage"
[11]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html "W3C — Target Size Minimum"
[12]: https://www.w3.org/TR/wcag2mobile-22/ "W3C — WCAG2Mobile"
