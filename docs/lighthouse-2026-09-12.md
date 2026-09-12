# Lighthouse — 2026-09-12

Măsurători mobile (Lighthouse 12, Chrome headless, formFactor mobile) pe build local `vite preview` (`http://127.0.0.1:4173/`).

## Înainte / după (micro-opt font preload)

Același bundle; diferența este doar injectarea `<link rel="preload" as="font">` pentru Outfit 400 latin + Fraunces 560 latin (plugin Vite `preload-critical-fonts`).

| | Înainte (fără preload) | După (cu preload) |
|---|---|---|
| Performance | **68** | **69** |
| Accessibility | 92 | 92 |
| Best Practices | 100 | 100 |
| SEO | 91 | 91 |
| FCP | 4.7 s | **4.2 s** |
| LCP | 5.4 s | 5.6 s |
| Speed Index | 4.7 s | **4.2 s** |
| TBT | 0 ms | 0 ms |
| CLS | 0.016 | **0.011** |

## Ce s-a schimbat în cod

1. **Preload fonturi critice** în `index.html` la build (`vite.config.ts`).
2. Fonturile locale rămân fără Google `@import` (deja în `fonts-local.css`); weight-urile nefolosite nu apar în bundle.
3. Lazy pe ecrane secundare + `modulePreload.polyfill: false` rămân neschimbate.

## Cum rulezi

```bash
pnpm lighthouse
# sau
pnpm build && LH_MIN_PERFORMANCE=0 node scripts/lighthouse.mjs
```

Rezumat: `reports/lighthouse-mobile-summary.json`.

> Notă: pe unele runner-e headless poate apărea `NO_FCP` dacă Chrome nu poate picta; reîncearcă cu `--allow-insecure-localhost` / port curat. Scorurile de mai sus sunt dintr-o rulare reușită pe această mașină.
