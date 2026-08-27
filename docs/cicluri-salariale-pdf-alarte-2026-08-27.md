# Cicluri salariale, plan PDF și alerte de tranșă

## Reguli de funcționare

Un șablon salarial păstrează local numai o denumire, suma și durata în zile. La reutilizare, utilizatorul alege manual din nou data de început; aplicația propune data finală prin durata șablonului, fără a schimba planul până la acțiunea explicită **Aplică ritmul săptămânal**.

Exportul PDF este generat local, la cerere, din previzualizarea calculatorului. Include suma, intervalul, durata, ritmul săptămânal și fiecare tranșă calendaristică. Nu încarcă date într-un serviciu extern.

Alerta de tranșă este un mesaj din ecranul **Astăzi**. Apare la prima deschidere a aplicației în ziua de început a unei tranșe, este memorată local prin intervalul tranșei și nu reprezintă notificare push sau activitate în fundal.

## Verificare

Au fost verificate un calcul temporar de 2.400 RON pe 16 zile, salvarea și afișarea unui șablon local, precum și descărcarea fișierului `plan-calendaristic-2026-08-26-2026-09-10.pdf`. Testele unitare acoperă împărțirea în patru săptămâni, patru săptămâni și jumătate, normalizarea șabloanelor locale și identificarea tranșei active.

Validarea mobilă a păstrat calculatorul drept o fișă de lucru independentă: datele calendaristice se completează înaintea sumei, acțiunile de aplicare și PDF rămân separate, iar șabloanele sunt pliate într-o zonă locală. Pe ecranul Astăzi, situația și următoarea decizie formează un singur instrument, iar bilanțul de dedesubt folosește rânduri semantice de registru pentru surse, obligații și limite.
