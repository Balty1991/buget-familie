# Captură rapidă și control săptămânal

## Scop

Această etapă reduce timpul necesar pentru înregistrările frecvente și face săptămâna curentă ușor de citit pentru o persoană sau pentru întreaga familie. Toate calculele folosesc exclusiv tranzacțiile existente în aplicație; nu se conectează la bancă și nu inițiază plăți.

| Funcție | Date păstrate | Regulă de siguranță |
|---|---|---|
| Șablon local | titlu, tip, categorie, sumă sugerată, membru și sursă | un șablon doar completează formularul; nu creează o tranzacție fără confirmare |
| Căutare Jurnal | termen introdus local | caută în titlu, categorie, sursă, membru și sumă; nu trimite textul în rețea |
| Recapitulare săptămânală | interval luni–duminică, perspectivă, venituri și cheltuieli | include numai tranzacțiile datate în interval; Familia include toate mișcările, Membru include numai mișcările sale |

## Persistență și compatibilitate

Șabloanele se păstrează numai în setările locale ale aplicației, normalizate defensiv pentru copiile create înaintea acestei versiuni. Ele sunt preferințe de viteză, nu intrări contabile și nu sunt trimise în pachetul criptat de familie; parola și tokenul nu sunt schimbate de această dezvoltare.

## Criterii mobile

Ecranul rapid păstrează o singură acțiune dominantă, iar șabloanele se parcurg printr-o bandă orizontală care acceptă atingere și swipe. Căutarea arată numărul de rezultate și are un buton clar de resetare. Recapitularea are valori pe rânduri distincte, fără grafic obligatoriu sau cifre tăiate.
