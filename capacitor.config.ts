/** Wrapper Android Capacitor — Buget Familie păstrează același build web ca GitHub Pages. */
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ro.balty1991.bugetfamilie",
  appName: "Buget Familie",
  webDir: "dist/public",
  android: { backgroundColor: "#f7f5ef" },
};

export default config;
