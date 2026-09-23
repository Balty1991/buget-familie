# Buget Familie — specificație de redesign

## Poziționare

> **Buget Familie este centrul de comandă al banilor unei gospodării: arată ce este sigur de cheltuit până la următorul venit și face fiecare decizie explicabilă.**

Direcția păstrează caracterul editorial al „Atelierului Financiar”, dar îl simplifică într-o interfață **mobile-first, utilitară și calmă**. Hârtia, rigla și fișele rămân elemente de identitate, însă nu mai concurează cu datele.

## Arhitectura de informație

| Destinație mobilă | Întrebarea la care răspunde | Acțiunea principală |
|---|---|---|
| Acasă | „Ce pot face astăzi fără să stric planul?” | Adaugă mișcare |
| Jurnal | „Ce s-a întâmplat cu banii și din ce sursă?” | Filtrează, corectează, șterge |
| Plan | „Ce sumă este disponibilă până la următorul salariu?” | Alocă o limită sau o categorie |
| Obiective | „Ce trebuie plătit sau finanțat?” | Actualizează datorie/economie |
| Mai mult | „Unde găsesc bonuri, asistent, sincronizare și setări?” | Deschide instrumentul ales |

## Un singur adevăr financiar

Fiecare tranzacție nouă va avea `date`, `memberId`, `sourceId`, `categoryId`, `amount` și `kind`. Soldul curent al unei surse devine: **sold inițial + venituri din sursă − cheltuieli din sursă**. O alocare de plan va arăta **bugetat, cheltuit și rămas** pentru membrul sau categoria ei, filtrate la perioada activă.

## Elemente de ecran

Acasă va porni cu un singur rezumat de decizie — „sigur de cheltuit până la salariu” — urmat de trei semnale: data următorului venit, obligațiile care urmează și ritmul cheltuielilor. Planul va avea un „constructor de perioadă” compact și o listă de plicuri bugetare, nu un șir de carduri egale. Jurnalul va afișa inițial mișcările zilei, cu filtre rapide pe membru, sursă și categorie.

## Sistem vizual și accesibilitate

Fundalul principal va fi mai luminos în tema luminoasă și mai aerisit în tema întunecată. Verdele profund va marca doar decizii și suprafețe de control; galbenul va semnala acțiunea principală, iar coralul doar avertismentele. Titlurile vor rămâne Fraunces, dar cifrele, formularele și navigația vor folosi Manrope cu scală compactă. Toate acțiunile frecvente vor avea ținte de minimum 44 px, etichete textuale și focus clar.

## Asistent profesional

Asistentul va deveni o secțiune de **insight-uri**: „explică planul”, „arată depășirile”, „ce scade din banii de cheltuit” și „ce urmează”. Fiecare răspuns va afișa perioada și regulile folosite. Un model AI extern va rămâne opțional și nu va fi activat fără un mecanism securizat care să nu expună cheia sau datele financiare în aplicația publică.
