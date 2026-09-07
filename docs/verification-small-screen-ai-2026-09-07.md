# Verificare panou AI pe ecrane mici

## Dimensiuni testate

- iPhone SE 2/3: viewport CSS 375 × 667 px.
- iPhone SE 1: viewport CSS 320 × 568 px.

## Constatări

### iPhone SE 2/3 (375 × 667)

Panoul este vizibil integral, cu margini laterale de aproximativ 12 px și fără să modifice înălțimea documentului: `bodyHeight = 667`. Panoul ocupă aproximativ 351 × 387 px și se termină la `y = 539`, iar navigația mobilă începe la `y = 589`, deci există un spațiu de aproximativ 50 px între ele. Câmpul de introducere rămâne vizibil la `y = 442–486`. Mesajele sunt lizibile, iar spațiul intern este echilibrat.

### iPhone SE 1 (320 × 568)

Panoul rămâne vizibil integral și este limitat la aproximativ 296 × 420 px, cu margini laterale de 12 px. Înălțimea documentului rămâne `568`, fără împingerea conținutului. Panoul se termină la `y = 456`, iar navigația începe la `y = 490`, cu aproximativ 34 px spațiu între ele. Câmpul de introducere rămâne vizibil la `y = 378.5–422.5`.

## Problemă observată

Pe iPhone SE 1, placeholderul câmpului este tăiat la dreapta (`ex. am cheltuit 50 de lei pe...`), ceea ce este acceptabil funcțional, dar poate fi îmbunătățit printr-un placeholder mai scurt pe ecrane sub 350 px. De asemenea, spațiul gol dintre mesaj și acțiuni este mai mare decât necesar, însă nu afectează funcționarea.

## Concluzie

Panoul nu se suprapune cu navigația și nu împinge pagina în jos pe niciuna dintre dimensiunile testate. Este recomandată o mică ajustare pentru placeholder și, opțional, reducerea spațiului gol pe viewporturile foarte înguste.

## Retest final

Placeholderul a fost scurtat la `ex. combustibil 50 lei`. În captura actualizată pentru iPhone SE 1, textul se vede integral în câmp, fără tăiere la marginea din dreapta. Testul automatizat a confirmat din nou `bodyHeight = 568`, panou `296 × 420 px`, câmp vizibil și fără overflow intern (`scrollHeight = clientHeight`). Verificarea TypeScript și build-ul de producție au trecut.
