# Audit multi-perspectivă — Buget Familie

**Dată:** 27 august 2026  
**Versiune evaluată:** `3bd3ba2`  
**Cadru:** PWA statică, local-first, GitHub Pages și APK Android debug.  

## Metodă și limite

Auditul a combinat parcurgerea mobilă la 390 px a ecranelor **Astăzi**, **Mișcări**, **Plan**, **Obligații** și **Analiză**, verificarea automată TypeScript/Vitest/build și o recenzie independentă orientată pe robustețe. Nu au fost folosite date financiare reale și nu a fost făcută o sincronizare cu token real pe două telefoane; constatările din această zonă sunt marcate explicit drept riscuri care trebuie testate.

| Perspectivă | Scenariu evaluat | Concluzie principală |
|---|---|---|
| Persoană singură, la început | Aplicația fără date și prima configurare | Startul este lizibil și explică următorul pas, însă Planul cere încă multă completare manuală înainte ca utilizatorul să simtă câștigul. |
| Cuplu/familie | Salariu împărțit în plicuri și surse diferite | Modelul Alimente 1.200 RON cash Eu + 1.200 RON card Soție este susținut, iar sursa reală poate determina plicul chiar când alt membru introduce mișcarea. |
| Utilizator grăbit | Înregistrare scurtă a unei cheltuieli | Captura rapidă poate alege plicul compatibil și arată tranșa activă, dar trebuie testată manual pe un telefon cu un ciclu și plicuri reale. |
| Utilizator cu nevoie de contrast | Scanare pe mobil, fără date | Ierarhia și etichetele sunt clare, dar densitatea etichetelor uppercase și câmpurile compacte din Plan rămân o zonă de atenție. |
| Utilizator care verifică lunar | Cronologie, obligații și analiză | Ecranele sunt lizibile, dar Mișcări pune filtrarea înaintea cronologiei, iar Analiză și Obligații folosesc încă prea multe panouri cu greutate vizuală apropiată. |

## Probleme confirmate de experiență

| Prioritate | Observație | Impact | Recomandare |
|---|---|---|---|
| P1 | În **Mișcări**, filtrarea ocupă primul spațiu vizual și cronologia reală apare prea jos. | Un utilizator care vrea „ce am plătit azi?” trebuie să treacă de un instrument de verificare înainte de rezultat. | O bandă compactă de filtre, ascunsă implicit după prima folosire, și cronologia zilei ca piesă dominantă. |
| P1 | În **Plan**, zona de plicuri are încă multe câmpuri egale și explicații lungi. | Configurarea unui buget familial nou poate părea administrativă, mai ales pe 360 px. | O foaie de configurare progresivă: categorie, sumă și sursă la vedere; membru, prag și notiță într-un detaliu extensibil. |
| P1 | Sursa plății și persoana care înregistrează sunt noțiuni diferite, dar trebuie validate în utilizare reală. | Fără test de cuplu, se poate interpreta greșit „Cine a înregistrat” față de „Plătit din card Soție”. | Test de acceptanță pe două profiluri cu copy mai direct: „Înregistrat de” și „Banii au plecat din”. |
| P2 | **Obligații** nu are încă o axă cronologică dominantă pentru următoarele rate și facturi. | Prioritatea între datorii, scadențe și economii se citește din mai multe zone. | Un registru temporal cu următoarele trei scadențe și o singură acțiune de confirmare per rând. |
| P2 | **Analiză** rămâne o stivă de panouri asemănătoare. | Compararea lunii, distribuției și poziției poate obosi vizual. | O concluzie lunară dominantă, urmată de grafice/indicatori compactați ca dovezi de registru. |
| P2 | Accentele albastre vizibile în Mișcări/Analiză concurează cu verde–miere–coral. | Identitatea vizuală devine mai puțin consecventă în tema Ivory. | Rezervarea fermă a verdelui pentru progres/acțiune, mierii pentru revizuire și coralului pentru atenție/obligații. |

## Riscuri tehnice și de accesibilitate

| Prioritate | Risc | Stare | Următor pas concret |
|---|---|---|---|
| P0 | ID-urile bazate pe timp și aleator pot coliziona rar între dispozitive. | Risc confirmat prin inspectarea implementării; nu a fost observată o coliziune în test. | Înlocuiește crearea noilor ID-uri cu `crypto.randomUUID()` și fallback sigur; adaugă teste pentru unicitate și merge. |
| P0 | Imaginile bonurilor codificate base64 pot depăși limita `localStorage`. | Risc confirmat de arhitectură; depinde de dimensiunea/frecvența bonurilor. | Mută imaginile în IndexedDB, păstrează doar referințe în registru și tratează explicit `QuotaExceededError`. |
| P1 | Două telefoane pot modifica simultan același plan, iar planul se alege ca document întreg. | Risc de pierdere de modificări concurente; nu a fost testat cu token real. | Merge granular pentru plicuri/reguli/transferuri sau UI de conflict „păstrează local / preia / unește”, plus teste pe două copii. |
| P1 | Sincronizarea GitHub poate primi conflict 409/422 sau limitare de rată. | Risc operațional; nu a fost simulat cu un repo real. | Pull–merge–retry controlat, backoff, mesaje distincte și jurnal local de stare a sincronizării. |
| P1 | Modalele se închid la `onMouseDown` pe fundal, fără trap de focus demonstrat. | Risc de închidere accidentală și accesibilitate redusă la tastatură. | Înlocuiește cu dialog accesibil, focus trap, Escape și revenire a focusului la butonul declanșator. |
| P2 | Bundle-ul principal rămâne aproximativ 713 KB minificat, deși modulele grele sunt lazy-loaded. | Timp de pornire mai mare pe telefoane modeste. | Profilează bundle-ul, extrage ecranele de bază în module mai mici și monitorizează un buget de performanță. |

## Roadmap propus

| Etapă | Obiectiv | Criteriu de acceptare |
|---|---|---|
| Următoarea versiune | Securizează persistența și integritatea datelor. | UUID criptografic, bonuri în IndexedDB, mesaj clar la spațiu insuficient și teste de migrare. |
| Apoi | Simplifică primul flux familial real. | Configurare Plan în pași progresivi, cu Alimente/Taxi/Abonamente/Rate/Consumabile ca porniri rapide editabile. |
| Apoi | Întărește sincronizarea familială. | Simulare documentată cu două copii, conflict controlat, retry și explicație onestă că nu este sincronizare în fundal. |
| Apoi | Reordonează Mișcări, Obligații și Analiză. | Cronologie zilnică, următoarele obligații și concluzia lunară devin piesele dominante la 360–430 px. |
| Permanent | Testează pe dispozitive reale. | Cel puțin un Android modest, două profiluri familiale și temele luminoasă/întunecată, fără date demo publicate. |

> Auditul nu identifică o plată bancară, un transfer monetar sau un serviciu extern ascuns. Plicurile și tranșele rămân limite locale de planificare, iar sincronizarea rămâne opțională și activă numai cât aplicația este deschisă.
