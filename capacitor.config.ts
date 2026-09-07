/** Wrapper Android Capacitor — Buget Familie păstrează același build web ca GitHub Pages. */
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ro.balty1991.bugetfamilie",
  appName: "Buget Familie",
  webDir: "dist/public",
  android: {
    backgroundColor: "#07090c",
    // Padding-ul e în MainActivity. Dacă și Capacitor mai adaugă margini, antetul coboară de două ori.
    adjustMarginsForEdgeToEdge: "disable",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "disable",
      style: "DARK",
    },
  },
};

export default config;
