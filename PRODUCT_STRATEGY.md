# Buget Familie — strategie de produs

## Obiectiv

**Buget Familie** trebuie să răspundă unei întrebări simple: „Cât pot folosi fără să stric luna și ce trebuie să plătesc în continuare?”. Aplicația nu trebuie să semene cu un registru contabil plin de grafice, ci cu un ghid calm care transformă banii dintr-o sursă de confuzie într-un plan vizibil.

Publicul principal este format din persoane și familii care nu folosesc termeni financiari în fiecare zi: oameni care vor să vadă ce au, ce au cheltuit și ce urmează, fără conectare bancară obligatorie și fără să învețe o metodologie complicată.

## Ce păstrăm și ce îmbunătățim de la concurență

| Ce merită preluat | De la cine | Cum facem mai bine în Buget Familie |
| --- | --- | --- |
| Adăugare manuală rapidă și șabloane pentru cheltuieli repetate | Money Manager | Un singur flux „Adaugă o cheltuială” cu valori implicite, exemple și salvare în maximum câteva atingeri. |
| Bugete pe categorii, rapoarte și perioade | Money Manager, Spendee, Wallet | Păstrăm analiza, dar afișăm întâi concluzia în cuvinte simple și lăsăm graficul ca detaliu. |
| Portofele, conturi multiple și finanțe comune | Spendee, Wallet | Păstrăm sursele și familia, dar explicăm diferența dintre „de unde sunt banii” și „pentru ce sunt banii”. |
| Cheltuieli recurente, scadențe și obiective | Money Manager, Spendee | Construim un ecran „Ce urmează” care unește ratele, abonamentele și economiile într-o singură listă cronologică. |
| Backup, export și acces pe mai multe dispozitive | Money Manager, Wallet | Păstrăm controlul local și exportul; sincronizarea rămâne opțională, explicită și ușor de oprit. |
| Vizual curat și sentiment de progres | Spendee, Wallet | Folosim progresul doar când ajută decizia. Nu animăm cifrele și nu ascundem acțiunile importante în meniuri. |

Concurenții mari au validat cererea pentru tracking, bugete, categorii, sincronizare și partajare. În același timp, recenziile recente pentru Spendee menționează lag, tastatură lentă și controale de salvare instabile, iar recenziile Money Manager menționează restaurarea achizițiilor și lipsa unor filtre flexibile. Pentru Buget Familie, **viteza, predictibilitatea și claritatea** sunt diferențiatori mai valoroși decât adăugarea încă unui grafic [1] [2].

## Structura propusă pentru orice utilizator

| Secțiune | Întrebarea la care răspunde | Eticheta vizibilă |
| --- | --- | --- |
| Astăzi | „Unde mă aflu acum?” | Ce am și ce pot folosi |
| Mișcări | „Ce am înregistrat?” | Venituri și cheltuieli |
| Plan | „Cum împart banii?” | Plicuri și limite |
| Obligații | „Ce urmează să plătesc?” | Rate, facturi și obiective |
| Analiză | „Ce obicei se repetă?” | Înțelege luna |

În textele introductive, termenul „plic” apare împreună cu explicația **„o sumă pusă deoparte pentru un scop”**. „Ritm prudent” devine **„reper zilnic, nu bani în plus”**. „Sursă” devine **„cont, card sau cash de unde pleacă banii”**. Jargonul poate rămâne în detaliile avansate, dar nu în prima acțiune.

## Primul flux: 3 minute până la primul rezultat

La prima deschidere, utilizatorul alege una dintre trei intenții:

1. **Vreau doar să văd pe ce se duc banii.** Se deschide direct înregistrarea unei cheltuieli.
2. **Vreau să-mi organizez luna.** Se creează primul venit și două plicuri sugerate, care pot fi modificate.
3. **Vreau un buget pentru familie.** Se adaugă persoana, sursele de bani și primul plan comun.

Indiferent de alegere, aplicația trebuie să permită „Mai târziu” fără penalizare. Utilizatorul trebuie să vadă un prim rezultat în mai puțin de trei minute: o mișcare înregistrată, o sumă rămasă sau o obligație viitoare.

## Principii de accesibilitate și încredere

Aplicăm minimum 48dp pentru ținte tactile, contrast verificabil pentru text, iconițe cu etichete utile, focus vizibil, ordine logică la tastatură și suport pentru cititoare de ecran. Ghidul oficial Android recomandă controale mari și simple, descrierea scopului fiecărui element și contrast de cel puțin 4,5:1 pentru textul mic obișnuit [3].

Datele financiare rămân locale în experiența de bază. Pentru orice sincronizare, AI, fotografie de bon sau cont de familie explicăm înainte ce date pleacă de pe dispozitiv. Înainte de publicare trebuie să existe politică de confidențialitate în aplicație și în listarea Play, declarație Data safety corectă, criptare în tranzit și ștergerea datelor. Google Play tratează informațiile financiare ca date personale și sensibile [4] [5].

## Monetizare fără a distruge încrederea

Recomand **freemium fără reclame în ecranele financiare**. Un abonament pentru toată gospodăria, nu per persoană. Datele nu sunt ostatici: la anulare, registrul rămâne pe telefon.

| Plan | Preț | Ce include |
| --- | --- | --- |
| **Casa** | 0 lei | Până la 4 plicuri, 1 membru, 1 telefon, Astăzi / Mișcări / Plan / scadențe, ghid local + 20 mesaje online/zi, export CSV și backup. |
| **Familia** | 19,99 lei/lună sau **149 lei/an** (14 zile de probă) | Plicuri nelimitate, până la 6 persoane, sync criptat AES-GCM, ghid online încăpător, OCR bonuri, PDF, feed familie. |

Funcțiile de bază rămân gratuite. Nu blocăm niciodată accesul la datele deja introduse pentru că utilizatorul a anulat abonamentul.

Play Billing se lipește **după** listare și closed testing. În repository, `BILLING_LIVE = false`: totul e deblocat, ca familia care testează să nu rămână blocată. Nu simulăm plăți reale pe GitHub Pages. Implementarea reală cere aplicație Android, produse în Play Console și verificarea entitlements pe o arhitectură securizată [6].

## Roadmap recomandat

| Etapă | Rezultat | Criteriu de acceptare |
| --- | --- | --- |
| 1. Claritate | Texte simple, card Astăzi explicat, onboarding scurt, glosar „Pe scurt” | Un utilizator nou poate explica ce înseamnă fiecare sumă fără ajutor extern. |
| 2. Viteză | Mișcări și Astăzi fără fallback vizibil, input rapid și șabloane | Prima cheltuială se poate salva fără așteptare perceptibilă pe telefon mediu. |
| 3. Decizia zilnică | „Ce pot folosi”, „Ce urmează”, „Ce am depășit” | Utilizatorul primește o singură acțiune următoare, nu un zid de grafice. |
| 4. Familie | Roluri simple, jurnal partajat și sincronizare clară | Două persoane înțeleg cine a înregistrat și unde se află modificarea. |
| 5. Premium | Paywall transparent, restaurare cumpărare, export/backup și control date | Nicio pierdere de date la downgrade; fiecare funcție plătită are beneficiu explicat. |
| 6. Play Store | Pachet Android, icon, capturi, privacy policy, Data safety, closed testing | Aplicația trece verificările tehnice și un test cu utilizatori reali înainte de lansare. |

## Ce implementăm acum

Pachetul Play-ready: un singur drum pentru bani (captură, formular, ghid, De verificat), feed familie pe Astăzi, catalog Casa/Familia fără plăți simulate, listing + politică actualizate. Play Billing rămâne oprit până după closed testing.

## Referințe

[1]: https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree&hl=en_US "Money Manager Expense & Budget — Google Play"
[2]: https://play.google.com/store/apps/details?id=com.cleevio.spendee&hl=en_US "Budget Planner & App: Spendee — Google Play"
[3]: https://developer.android.com/guide/topics/ui/accessibility/apps "Make apps more accessible — Android Developers"
[4]: https://support.google.com/googleplay/android-developer/answer/10144311?hl=en "User Data — Google Play Console Help"
[5]: https://support.google.com/googleplay/android-developer/answer/10787469?hl=en "Provide information for Google Play's Data safety section"
[6]: https://support.google.com/googleplay/android-developer/answer/12154973?hl=en "Understanding subscriptions — Google Play Console Help"
