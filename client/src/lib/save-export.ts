/**
 * Salvează un export (CSV, PDF). Pe web e o descărcare obișnuită; în aplicația Android,
 * WebView-ul nu descarcă `blob:`, așa că fișierul se scrie în cache și se deschide lista de
 * aplicații (Fișiere, Drive, WhatsApp, e-mail).
 */
import { isNativeApp } from "@/lib/app-storage";

/** O celulă care începe cu =, +, @ sau „-text” e rulată ca formulă de Excel; o facem text. */
export const csvSafe = (value: unknown) => {
  const text = String(value ?? "");
  const guarded = /^[=+@\t\r]/.test(text) || /^-[^\d.,\s]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
};

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(index, index + 0x8000)));
  return btoa(binary);
};

export async function saveExport(name: string, blob: Blob): Promise<void> {
  if (isNativeApp()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
    const written = await Filesystem.writeFile({ path: name, data: await toBase64(blob), directory: Directory.Cache, recursive: true });
    try {
      await Share.share({ title: name, url: written.uri, dialogTitle: name });
    } catch { /* omul a închis lista: nimic de făcut */ }
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revocat imediat, unele browsere nu mai apucă să descarce.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
