package ro.balty1991.bugetfamilie;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
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
      final JSObject result = new JSObject();
      result.put("path", path);
      call.resolve(result);
    } catch (Exception error) {
      call.reject(error.getMessage() != null ? error.getMessage() : "salvare eșuată", error);
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
