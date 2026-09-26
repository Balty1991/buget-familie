import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

function vitePluginPreloadCriticalFonts(): Plugin {
  return {
    name: "preload-critical-fonts",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        const base = process.env.GITHUB_PAGES === "true" ? "/buget-familie/" : "/";
        const allWoff = Object.values(bundle).filter((item) => "fileName" in item && typeof item.fileName === "string" && /\.woff2$/.test(item.fileName)) as Array<{ fileName: string }>;
        const pick = (re: RegExp) => allWoff.find((item) => re.test(item.fileName));
        const fonts = [
          pick(/ibm-plex-sans-latin(?!-ext)/i),
        ].filter(Boolean) as Array<{ fileName: string }>;
        const tags = fonts.slice(0, 4).map((asset) => ({
          tag: "link" as const,
          attrs: {
            rel: "preload",
            href: `${base}${asset.fileName}`,
            as: "font",
            type: "font/woff2",
            crossorigin: "anonymous",
          },
          injectTo: "head" as const,
        }));
        return tags.length ? { html, tags } : html;
      },
    },
  };
}

/**
 * Un identificator pentru fiecare build, pus și în `build.json` lângă pagină. Aplicația deschisă îl
 * compară cu cel publicat și, dacă diferă, arată „Versiune nouă” — altfel, după o publicare, telefonul
 * rămânea pe codul vechi până la o reîncărcare dublă.
 */
const BUILD_ID = (process.env.GITHUB_SHA || "").slice(0, 12) || Date.now().toString(36);

function vitePluginBuildId(): Plugin {
  return {
    name: "build-id",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "build.json", source: JSON.stringify({ id: BUILD_ID }) });
    },
  };
}


/**
 * Politica de securitate a conținutului, doar la build-ul pentru GitHub Pages (serverul de dezvoltare are nevoie de scripturi
 * inline pentru reîncărcare). GitHub Pages nu poate trimite antete, așa că vine ca <meta>.
 * Scripturile inline din index.html intră prin hash; orice alt script inline e refuzat.
 * Surse externe: Firebase (Auth, Firestore, App Check, funcții), reCAPTCHA pentru App Check,
 * jsDelivr pentru cititorul de bonuri (worker, WASM și datele de limbă) și Open Food Facts.
 */
function vitePluginCsp(): Plugin {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        // Doar pentru web: în Android, Capacitor injectează la rulare un script inline (puntea nativă)
        // care ar fi blocat. Acolo pagina vine oricum din pachetul aplicației, nu de pe internet.
        if (process.env.GITHUB_PAGES !== "true") return html;
        // jsDelivr servește orice pachet npm: permitem doar căile exacte, cu versiune, ale cititorului de bonuri.
        const pkg = (name: string) => JSON.parse(readFileSync(path.resolve(import.meta.dirname, "node_modules", name, "package.json"), "utf8")) as { version: string; dependencies?: Record<string, string> };
        const tesseract = pkg("tesseract.js");
        const coreVersion = String(tesseract.dependencies?.["tesseract.js-core"] || "").replace(/^[^0-9]*/, "");
        const ocrScripts = `https://cdn.jsdelivr.net/npm/tesseract.js@v${tesseract.version}/ https://cdn.jsdelivr.net/npm/tesseract.js-core@v${coreVersion}/`;
        const ocrData = "https://cdn.jsdelivr.net/npm/@tesseract.js-data/";
        const hashes = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))
          .map((match) => `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`);
        const policy = [
          "default-src 'self'",
          `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(" ")} https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ ${ocrScripts}`,
          "style-src 'self' 'unsafe-inline'",
          // Pozele bonurilor sunt locale; din afară vin doar imaginile reCAPTCHA.
          "img-src 'self' data: blob: https://www.gstatic.com https://www.google.com",
          "font-src 'self' data:",
          // Doar serviciile folosite: Firestore, Auth, App Check, funcțiile din europe-central2, reCAPTCHA, OCR și Open Food Facts.
          `connect-src 'self' data: blob: https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseappcheck.googleapis.com https://content-firebaseappcheck.googleapis.com https://europe-central2-buget-familie-a6a0d.cloudfunctions.net https://www.google.com ${ocrScripts} ${ocrData} https://search.openfoodfacts.org https://world.openfoodfacts.org https://world.openproductsfacts.org`,
          "frame-src https://www.google.com https://recaptcha.google.com https://*.firebaseapp.com",
          "worker-src 'self' blob:",
          "manifest-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; ");
        return { html, tags: [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: policy }, injectTo: "head-prepend" }] };
      },
    },
  };
}

export default defineConfig(({ command }) => {
  const plugins = [react(), tailwindcss(), vitePluginPreloadCriticalFonts(), vitePluginBuildId(), vitePluginCsp()];

  return {
    // GitHub Pages servește acest proiect sub /buget-familie/; buildurile locale și Android rămân la rădăcină.
    base: process.env.GITHUB_PAGES === "true" ? "/buget-familie/" : "/",
    plugins,
    define: { "import.meta.env.VITE_BUILD_ID": JSON.stringify(command === "build" ? BUILD_ID : "dev") },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    envDir: path.resolve(import.meta.dirname),
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      target: ["es2022", "chrome111", "safari16"],
      cssMinify: "lightningcss",
      modulePreload: { polyfill: false },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/scheduler") || id.includes("node_modules/wouter")) return "react-runtime";
            if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) return "family-sync";
            if (id.includes("node_modules/tesseract.js")) return "receipt-ocr";
            // Nu grupa lucide-react: un chunk comun forța toate iconițele Plan/Analiză pe first paint.
            // Nu grupa jspdf/html2canvas: helperul de preload ajunge în chunk-ul mare și se încarcă la prima deschidere.
          },
        },
      },
    },
    server: {
      port: 3000,
      strictPort: false, // Will find next available port if 3000 is busy
      // Doar pe acest calculator; fără listă de gazde deschisă (o pagină web ar putea citi sursele prin DNS rebinding).
      host: "127.0.0.1",
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
