# Evaluare multi-utilizator — revizuire totală mobilă

## Verdict

Interfața curentă nu îndeplinește standardul pentru o aplicație financiară folosită zilnic pe telefon. Problemele observate nu sunt doar estetice: titlurile editoriale consumă prea mult spațiu, semnificația culorilor nu este constantă, stările active pierd contrastul, iar navigația și utilitarele concurează cu cifrele. O aplicație de bani trebuie să reducă timpul până la înțelegerea situației, nu să solicite interpretarea unei compoziții grafice.

## Perspective de utilizare

| Perspectivă | Ce trebuie să poată face imediat | Problemă văzută în versiunea actuală | Corecție obligatorie |
|---|---|---|---|
| Persoană singură, grăbită | Să înregistreze o cheltuială și să vadă cât mai poate cheltui. | Titlurile mari, antetul și decorațiile împing informația financiară sub primul ecran. | Antet de maximum 56 px, un rezumat compact și o acțiune principală permanentă. |
| Cuplu sau familie | Să distingă sigur persoana, sursa și plicul fără să confunde bugetul comun cu cel personal. | Informația de familie este dispersată în etichete mici și în instrumente secundare. | Folosesc aceeași structură de rând pentru membru, sursă, plic și perioadă în toate fluxurile. |
| Utilizator cu vedere redusă | Să citească suma, starea activă și controalele fără efort. | Au apărut fundaluri foarte deschise cu text alb și accente întunecate fără contrast stabil. | Raport de contrast ridicat, culoare plus text pentru stare și niciun control activ alb cu text alb. |
| Utilizator care verifică cifre | Să compare venitul, cheltuiala, rata și soldul cu valori exacte. | Expresia editorială concurează cu cifrele, iar suprafețele multiple ascund relația dintre valori. | Cifre tabulare, ordine fixă a indicatorilor și explicație scurtă sub fiecare sumă. |
| Utilizator nou | Să înțeleagă primul pas fără să exploreze cinci ecrane. | Ecranul gol folosește un limbaj de produs matur înainte de configurarea datelor. | Onboarding progresiv: profil → surse → venit următor → prima mișcare, în aceeași ordine în care sunt necesare. |

## Concluzii din accesibilitate și uzabilitate

Ghidul W3C pentru aplicații mobile include explicit reflow, dimensiunea minimă a țintelor, navigația consecventă și evitarea reintroducerii redundante a datelor ca preocupări de mobil [1]. O sinteză a 132 de studii despre aplicații mobile pentru adulți relevă ca elemente recurente navigația simplificată, textul și țintele tactile mărite și interfețele tolerante la erori [2]. Aceste concluzii se aplică direct utilizatorilor care introduc sau verifică sume sub presiunea timpului, nu doar utilizatorilor cu nevoi de accesibilitate declarate.

> Noua interfață va folosi **o decizie pe ecran**, **un indicator dominant**, **o acțiune principală**, apoi detalii expandabile. Nu va folosi panouri foarte închise cu tipografie decorativă pentru a prezenta informații de rutină.

## Sistemul de înlocuire

| Element | Regulă nouă | Eliminat |
|---|---|---|
| Fundal și suprafețe | Ivory neutru implicit; o suprafață albă și o suprafață gri foarte deschis pentru grupare. Tema întunecată devine cărbune cu suprafețe slate, nu bleumarin aproape-negru. | Gradienți mari, grile decorative și muchii multicolore. |
| Tipografie | IBM Plex Sans pentru toate fluxurile; titlu de 24–28 px maximum pe mobil; sume de 28–34 px doar pentru indicatorul principal. | Serifuri mari, italice decorative și titluri pe 2–3 rânduri. |
| Culoare | Verde pentru pozitiv/disponibil, coral pentru atenție/ieșiri, albastru pentru acțiunea de navigare; fiecare are o etichetă textuală. | Mierea și albastrul folosite ca ornamente pe controale fără semnificație. |
| Navigație | Patru destinații mobile stabile: Astăzi, Mișcări, Plan, Analiză. Obligațiile devin filă contextuală din Plan sau Analiză; instrumentele intră într-un singur meniu. | Cinci opțiuni plus utilitare concurente și butoane active cu fundal dominant. |
| Date și rânduri | Rânduri uniforme de 56–72 px cu icon, titlu, metadate și sumă; controalele de editare se deschid printr-un meniu secundar. | Carduri cu margini groase și acțiuni repetate pe fiecare intrare. |

## Criterii de acceptare

Revizuirea este acceptată numai dacă tema Ivory și tema întunecată păstrează textul lizibil în toate stările, bara de jos nu are suprafețe deschise cu etichete deschise, primul ecran arată suma și acțiunea în cel mult două blocuri, iar filtrele și formularele nu necesită derulare orizontală la 360 px.

## Referințe

[1] [W3C — Guidance on Applying WCAG 2.2 to Mobile Applications](https://www.w3.org/TR/wcag2mobile-22/)

[2] [Amouzadeh et al. — Optimizing mobile app design for older adults: systematic review](https://pmc.ncbi.nlm.nih.gov/articles/PMC12350549/)
