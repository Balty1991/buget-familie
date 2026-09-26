/**
 * Ecran protejat (Android FLAG_SECURE): fără capturi de ecran, fără înregistrare și fără
 * previzualizare în aplicațiile recente. Opțional, doar pe acest telefon; pe web nu face nimic.
 */
import { isNativeApp } from "@/lib/app-storage";
import { safeSetItem } from "@/lib/safe-storage";

export const SECURE_SCREEN_KEY = "buget-familie:secure-screen";

type SecurePlugin = { setSecureScreen: (options: { enabled: boolean }) => Promise<void> };

export const readSecureScreen = () => {
  try { return window.localStorage.getItem(SECURE_SCREEN_KEY) === "1"; } catch { return false; }
};

export async function applySecureScreen(enabled = readSecureScreen()) {
  if (!isNativeApp()) return;
  try {
    const { registerPlugin } = await import("@capacitor/core");
    await registerPlugin<SecurePlugin>("BugetFamilieNative").setSecureScreen({ enabled });
  } catch { /* o versiune veche a aplicației fără metoda asta */ }
}

export async function saveSecureScreen(enabled: boolean) {
  safeSetItem(window.localStorage, SECURE_SCREEN_KEY, enabled ? "1" : "0");
  await applySecureScreen(enabled);
}
