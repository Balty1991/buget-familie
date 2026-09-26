package ro.balty1991.bugetfamilie;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * Adaugă punțile JS înainte ca pagina să se încarce. addJavascriptInterface
 * după loadUrl nu există pe pagina curentă — de-aia alertele nu se activau.
 *
 * saveBackupToDownloads scrie prin MediaStore în Descărcări — loc pe care
 * aplicația Fișiere îl arată. Capacitor Directory.Documents poate raporta
 * succes pe o cale pe care omul nu o găsește (scoped storage).
 */
@CapacitorPlugin(name = "BugetFamilieNative")
public class BugetFamilieNativePlugin extends Plugin {
  @Override
  public void load() {
    final MainActivity activity = (MainActivity) getActivity();
    if (activity == null || getBridge() == null) return;
    final WebView webView = getBridge().getWebView();
    activity.attachNativeBridges(webView);
  }

  /** Ecran protejat, ales din Setări: fără capturi, înregistrare sau previzualizare în recente. */
  @PluginMethod
  public void setSecureScreen(PluginCall call) {
    final boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
    if (getActivity() == null) {
      call.resolve();
      return;
    }
    getActivity().runOnUiThread(() -> {
      if (enabled) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
      else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
      call.resolve();
    });
  }

  @PluginMethod
  public void saveBackupToDownloads(PluginCall call) {
    final String name = call.getString("name");
    final String data = call.getString("data");
    if (name == null || name.trim().isEmpty() || data == null) {
      call.reject("name/data lipsă");
      return;
    }
    final String safeName = name.replaceAll("[\\\\/]+", "_").trim();
    if (safeName.isEmpty() || !safeName.endsWith(".json")) {
      call.reject("nume fișier invalid");
      return;
    }
    try {
      final String path = writePublicDownload(safeName, data);
      if (safeName.startsWith(AUTO_PREFIX)) pruneAutoBackups(safeName);
      final JSObject result = new JSObject();
      result.put("path", path);
      call.resolve(result);
    } catch (Exception error) {
      call.reject(error.getMessage() != null ? error.getMessage() : "salvare eșuată", error);
    }
  }

  /** Copiile automate au nume cu data; rămân doar ultimele KEEP_AUTO, ca să nu se adune în Descărcări. */
  private static final String AUTO_PREFIX = "buget-familie-copie-";
  private static final int KEEP_AUTO = 4;

  private void pruneAutoBackups(String justWritten) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        final ContentResolver resolver = getContext().getContentResolver();
        final String[] projection = { MediaStore.Downloads._ID, MediaStore.Downloads.DISPLAY_NAME };
        // Pe Android 10+ interogarea fără permisiuni întoarce doar fișierele scrise de aplicație.
        try (Cursor cursor = resolver.query(MediaStore.Downloads.EXTERNAL_CONTENT_URI, projection, MediaStore.Downloads.DISPLAY_NAME + " LIKE ?", new String[] { AUTO_PREFIX + "%.json" }, MediaStore.Downloads.DISPLAY_NAME + " DESC")) {
          if (cursor == null) return;
          int seen = 0;
          while (cursor.moveToNext()) {
            seen += 1;
            if (seen <= KEEP_AUTO) continue;
            final long id = cursor.getLong(0);
            resolver.delete(ContentUris.withAppendedId(MediaStore.Downloads.EXTERNAL_CONTENT_URI, id), null, null);
          }
        }
        return;
      }
      final File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
      final File[] files = dir == null ? null : dir.listFiles((folder, fileName) -> fileName.startsWith(AUTO_PREFIX) && fileName.endsWith(".json"));
      if (files == null || files.length <= KEEP_AUTO) return;
      Arrays.sort(files, (left, right) -> right.getName().compareTo(left.getName()));
      for (int index = KEEP_AUTO; index < files.length; index += 1) {
        if (!files[index].getName().equals(justWritten)) files[index].delete();
      }
    } catch (Exception ignored) {
      // Rotația e o curățenie; copia nouă e deja scrisă.
    }
  }

  private String writePublicDownload(String name, String text) throws Exception {
    final byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      final ContentResolver resolver = getContext().getContentResolver();
      final ContentValues values = new ContentValues();
      values.put(MediaStore.Downloads.DISPLAY_NAME, name);
      values.put(MediaStore.Downloads.MIME_TYPE, "application/json");
      values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
      values.put(MediaStore.Downloads.IS_PENDING, 1);
      final Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
      if (uri == null) {
        throw new IllegalStateException("MediaStore insert a eșuat");
      }
      try (OutputStream out = resolver.openOutputStream(uri)) {
        if (out == null) {
          throw new IllegalStateException("openOutputStream a eșuat");
        }
        out.write(bytes);
        out.flush();
      }
      values.clear();
      values.put(MediaStore.Downloads.IS_PENDING, 0);
      resolver.update(uri, values, null, null);
      return "Download/" + name;
    }

    final File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
    if (dir == null) {
      throw new IllegalStateException("Download public indisponibil");
    }
    if (!dir.exists() && !dir.mkdirs()) {
      throw new IllegalStateException("Nu am putut crea folderul Download");
    }
    final File file = new File(dir, name);
    try (FileOutputStream out = new FileOutputStream(file, false)) {
      out.write(bytes);
      out.flush();
    }
    if (!file.isFile() || file.length() <= 0) {
      throw new IllegalStateException("Fișierul Download a rămas gol");
    }
    return "Download/" + name;
  }
}
