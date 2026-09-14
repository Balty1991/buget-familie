/** Wrapper Android Capacitor — Buget Familie păstrează același build web ca GitHub Pages. */
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ro.balty1991.bugetfamilie",
  appName: "Buget Familie",
  webDir: "dist/public",
  android: {
    backgroundColor: "#FBF4E9",
    adjustMarginsForEdgeToEdge: "disable",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      style: "DARK",
    },
  },
};

export default config;
