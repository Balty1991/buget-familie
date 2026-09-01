# Direcție vizuală — Buget Familie

## Concept

**Household OS / Busola banilor**: o interfață care combină calmul unei agende personale cu precizia unui instrument financiar. Utilizatorul vede o singură busolă vizuală: ce are, unde sunt banii puși deoparte și ce urmează.

## Identitate

Paleta de bază folosește cerneală aproape neagră, verde pin și un accent lime cald pentru progres, cu coral folosit rar pentru atenționări. Fundalul are suprafețe stratificate și o textură discretă, nu gradient generic. Titlurile rămân cu serif editorial, iar cifrele importante folosesc spațiere și dimensiune pentru scanare rapidă.

## Reguli de compoziție

- Un singur mesaj principal per ecran; detaliile intră în carduri secundare.
- Cardul erou este asimetric: suma și decizia în stânga, indicatorul vizual în dreapta pe ecrane late.
- Pe mobil, cardurile devin stive de 1 coloană, iar bara de navigare rămâne plutitoare și ușor de atins.
- Stările folosesc simultan text, culoare și iconiță; culoarea nu este singurul semnal.
- Animațiile sunt scurte, întreruptibile și limitate la opacity/transform.
- Nicio informație esențială nu este ascunsă exclusiv în hover sau într-un grafic.

## Diferențiator

În loc să copieze dashboardurile competitorilor, Buget Familie pornește de la decizie: **„ce pot folosi fără să stric următoarea perioadă?”**. Fiecare ecran trebuie să se termine cu o acțiune clară: adaugă, verifică, mută, plătește sau lasă pentru mai târziu.

## Performanță

Redesignul este CSS-first, fără imagini grele, fără blur obligatoriu pe mobil și fără animații care forțează layoutul. Ecranele secundare rămân lazy, iar jurnalul rămâne static pentru prima accesare rapidă.
