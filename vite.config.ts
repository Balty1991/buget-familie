import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
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

export default defineConfig(() => {
  const plugins = [react(), tailwindcss(), vitePluginPreloadCriticalFonts()];

  return {
    // GitHub Pages servește acest proiect sub /buget-familie/; buildurile locale și Android rămân la rădăcină.
    base: process.env.GITHUB_PAGES === "true" ? "/buget-familie/" : "/",
    plugins,
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
      host: true,
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
