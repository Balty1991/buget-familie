# Redesign major mobil — Buget Familie

## Constatare

> Versiunea curentă are funcții reale și o identitate coerentă, dar încă organizează experiența în jurul unor module separate: **Acasă, Jurnal, Plan, Obiective, Mai mult**. Schimbarea cerută trebuie să înlocuiască această hartă, nu să recoloreze aceleași ecrane.

## Direcție structurală

| Zonă nouă | Întrebarea utilizatorului | Conținut mutat sau construit |
|---|---|---|
| **Astăzi** | „Ce pot face acum fără să stric planul?” | disponibil până la venit, acțiune rapidă, alerte și scadența imediată |
| **Mișcări** | „Ce s-a întâmplat cu banii?” | jurnal, filtre, bonuri și înregistrare rapidă |
| **Plan** | „Ce bani protejez până la următorul venit?” | interval, surse, limite săptămânale, plicuri și realocări |
| **Obligații** | „Ce trebuie acoperit și ce construiesc?” | datorii, rate, istoric plăți, economii și scadențe |
| **Analiză** | „Ce s-a schimbat de la o lună la alta?” | comparații lunare, categorii, bilanț, PDF și asistent local |

Pe telefon, navigația de jos devine **Astăzi · Mișcări · Plan · Obligații · Analiză**. Setările, sincronizarea, ghidul și tema se mută într-o foaie de utilitare din antet, astfel încât ele nu mai concurează cu activitatea financiară zilnică.

## Criterii de diferențiere vizibilă

Noua interfață nu va mai folosi un ecran tip grilă pentru „Mai mult” sau aceeași succesiune de titlu editorial, buton și carduri mari. În schimb, fiecare zonă folosește o **bandă de situație**, o **acțiune dominantă** și o **fișă de lucru desfășurată** cu prioritate adaptată situației. Analiza devine un ecran propriu, cu selector de lună, comparație față de luna anterioară și grafice tactile, nu un instrument ascuns în „Mai mult”.

Plicurile devin un registru de limite lunare: fiecare rând comunică alocat, cheltuit, rămas și pragul, iar atenția apare atât în Plan, cât și în zona Astăzi. Transferul dintre plicuri rămâne strict o realocare de limită și nu se confundă cu o plată.

## Cercetare aplicată

Aplicațiile construite în jurul plicurilor prezintă alocarea ca act anterior cheltuielii și cer selectarea unei categorii înainte de consum; de aici păstrăm plicul explicit și contextul sursei, dar fără integrare bancară pretinsă.[1] Navigația adaptivă Material recomandă transformarea modului de navigare odată cu spațiul disponibil; de aici bara inferioară pentru telefon și navigația compactă pentru ecrane mari.[2] Metoda YNAB centrează perioada de planificare în jurul întrebării „ce trebuie să facă banii până la următorul venit?”; de aici Planul devine o zonă de priorități și rezerve, nu o listă lungă de setări.[3]

## Garduri funcționale

| Aspect | Regulă păstrată |
|---|---|
| Date | Persistența, sincronizarea criptată opțională și toate identificatoarele existente rămân compatibile. |
| Plăți | Confirmarea unei rate scrie numai o mișcare locală în jurnal și scade datoria aleasă; nu inițiază plăți bancare. |
| Plicuri | Bugetele sunt limite de planificare; realocările nu modifică soldul cash sau card. |
| Analiză | Graficele folosesc numai tranzacțiile introduse; lipsa datelor este afișată explicit. |
| Confidențialitate | Asistentul rămâne local, explicabil și fără trimitere automată a datelor financiare. |

## References

[1] [Envelope — budgeting app with digital envelopes](https://envelopebudgeting.com/)

[2] [Material Design — navigation layouts](https://m3.material.io/foundations/layout/canonical-layouts/navigation-rail)

[3] [YNAB Method — planificarea banilor înainte de următorul venit](https://www.ynab.com/ynab-method)
