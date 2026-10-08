package ro.balty1991.bugetfamilie;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import android.provider.Settings;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.HapticFeedbackConstants;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;
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
    MainActivity.userSecureScreen = enabled;
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

  /**
   * Vibrația scurtă a sistemului, nu un motor pornit de noi: „tick” la schimbarea ecranului,
   * „confirm” la o notare salvată, „reject” la o ștergere. Respectă setarea „Vibrație la atingere”
   * a telefonului (performHapticFeedback o verifică singur) și nu cere permisiunea VIBRATE.
   */
  @PluginMethod
  public void haptic(PluginCall call) {
    final String kind = call.getString("kind", "tick");
    if (getActivity() == null || getBridge() == null) {
      call.resolve();
      return;
    }
    final WebView webView = getBridge().getWebView();
    getActivity().runOnUiThread(() -> {
      int feedback = HapticFeedbackConstants.KEYBOARD_TAP;
      if ("tick".equals(kind)) feedback = HapticFeedbackConstants.CLOCK_TICK;
      else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && "confirm".equals(kind)) feedback = HapticFeedbackConstants.CONFIRM;
      else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && "reject".equals(kind)) feedback = HapticFeedbackConstants.REJECT;
      else if ("confirm".equals(kind) || "reject".equals(kind)) feedback = HapticFeedbackConstants.LONG_PRESS;
      if (webView != null) webView.performHapticFeedback(feedback);
      call.resolve();
    });
  }

  /**
   * Culorile din imaginea de fundal (Material You, Android 12+): accentul închis pentru tema
   * deschisă, cel deschis pentru temele închise. Pe telefoane mai vechi răspunde `supported: false`.
   */
  @PluginMethod
  public void systemAccent(PluginCall call) {
    final JSObject result = new JSObject();
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || getContext() == null) {
      result.put("supported", false);
      call.resolve(result);
      return;
    }
    result.put("supported", true);
    result.put("accent600", hex(getContext().getColor(android.R.color.system_accent1_600)));
    result.put("accent700", hex(getContext().getColor(android.R.color.system_accent1_700)));
    result.put("accent800", hex(getContext().getColor(android.R.color.system_accent1_800)));
    result.put("accent200", hex(getContext().getColor(android.R.color.system_accent1_200)));
    result.put("accent100", hex(getContext().getColor(android.R.color.system_accent1_100)));
    call.resolve(result);
  }

  private static String hex(int color) {
    return String.format("#%06X", 0xFFFFFF & color);
  }

  /**
   * Fereastra de recenzie a Magazinului Play, în aplicație. Play hotărăște dacă o arată
   * (are cotele lui); rezultatul nu spune dacă omul a scris ceva, deci doar rezolvăm.
   */
  @PluginMethod
  public void requestReview(PluginCall call) {
    if (getActivity() == null) {
      call.reject("fără activitate");
      return;
    }
    final ReviewManager manager = ReviewManagerFactory.create(getContext());
    manager.requestReviewFlow().addOnCompleteListener(request -> {
      if (!request.isSuccessful()) {
        call.reject("recenzie indisponibilă");
        return;
      }
      final ReviewInfo info = request.getResult();
      manager.launchReviewFlow(getActivity(), info).addOnCompleteListener(flow -> call.resolve());
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

  /**
   * Copia „la fiecare modificare”: un singur fișier în Documente/Buget Familie, rescris de fiecare dată
   * (nu câte un fișier nou). Pe Android 10+ prin MediaStore: aplicația își găsește propriul fișier și îl
   * suprascrie; după o reinstalare fișierul vechi nu mai e al ei, așa că se face unul nou, alături.
   */
  /**
   * Starea reamintirilor: dacă telefonul lasă aplicația să ruleze în fundal (optimizarea bateriei),
   * producătorul (Huawei, Honor, Xiaomi și alții opresc aplicațiile mai agresiv) și orele la care
   * trebuia să sune ceva și n-a sunat.
   */
  @PluginMethod
  public void reminderHealth(PluginCall call) {
    final Context context = getContext();
    final JSObject result = new JSObject();
    boolean ignoring = true;
    try {
      final PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
      if (power != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) ignoring = power.isIgnoringBatteryOptimizations(context.getPackageName());
    } catch (Exception ignored) { }
    result.put("ignoringBatteryOptimizations", ignoring);
    result.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
    result.put("lastFiredAt", context.getSharedPreferences(ReminderScheduler.PREFS, Context.MODE_PRIVATE).getLong(ReminderScheduler.KEY_LAST_FIRED, 0L));
    result.put("missed", ReminderScheduler.missedSince(context));
    call.resolve(result);
  }

  /** Deschide setarea care lasă aplicația să sune la timp: întâi pornirea automată (Huawei/Honor/Xiaomi), apoi bateria. */
  @PluginMethod
  public void openBatterySettings(PluginCall call) {
    final Context context = getContext();
    final String maker = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase();
    final java.util.List<Intent> tries = new java.util.ArrayList<>();
    if (maker.contains("huawei") || maker.contains("honor")) {
      tries.add(new Intent().setClassName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
      tries.add(new Intent().setClassName("com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
      tries.add(new Intent().setClassName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"));
    } else if (maker.contains("xiaomi") || maker.contains("redmi") || maker.contains("poco")) {
      tries.add(new Intent().setClassName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
    } else if (maker.contains("oppo") || maker.contains("realme") || maker.contains("oneplus")) {
      tries.add(new Intent().setClassName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
    } else if (maker.contains("vivo")) {
      tries.add(new Intent().setClassName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"));
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) tries.add(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
    tries.add(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.getPackageName())));
    for (Intent intent : tries) {
      try {
        // Fără resolveActivity: pe Android 11+ ecranele altor aplicații nu sunt „vizibile”, dar se pot deschide.
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
        final JSObject result = new JSObject();
        result.put("opened", intent.getComponent() != null ? "maker" : intent.getAction());
        call.resolve(result);
        return;
      } catch (Exception ignored) { }
    }
    call.reject("Nicio setare disponibilă");
  }

  @PluginMethod
  public void writeLiveBackup(PluginCall call) {
    final String name = call.getString("name");
    final String data = call.getString("data");
    if (name == null || data == null || !name.endsWith(".json") || name.contains("/") || name.contains("\\")) {
      call.reject("name/data invalid");
      return;
    }
    // „base” leagă numele cu data și ora de același fișier: buget-familie-automat-2026-10-09-0101.json.
    final String requestedBase = call.getString("base");
    final String base = requestedBase != null && !requestedBase.isEmpty() && name.startsWith(requestedBase) && !requestedBase.contains("/") && !requestedBase.contains("%")
      ? requestedBase
      : name.substring(0, name.length() - ".json".length());
    try {
      final byte[] bytes = data.getBytes(StandardCharsets.UTF_8);
      final String folder = Environment.DIRECTORY_DOCUMENTS + "/" + LIVE_FOLDER;
      String writtenName = name;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        final ContentResolver resolver = getContext().getContentResolver();
        final Uri collection = MediaStore.Files.getContentUri("external");
        Uri target = null;
        // După o reinstalare, fișierul vechi nu mai e al aplicației și nu se poate rescrie: Android pune
        // „buget-familie-automat (1).json” lângă el. Căutăm și variantele numerotate ale aplicației (doar ale ei
        // apar în interogare) și îl rescriem pe cel mai nou, altfel la fiecare salvare apărea un fișier nou.
        final String[] projection = { MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME };
        final String selection = MediaStore.MediaColumns.RELATIVE_PATH + "=? AND " + MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ?";
        try (Cursor cursor = resolver.query(collection, projection, selection, new String[] { folder + "/", base + "%.json" }, MediaStore.MediaColumns.DATE_MODIFIED + " DESC")) {
          if (cursor != null && cursor.moveToFirst()) {
            target = ContentUris.withAppendedId(collection, cursor.getLong(0));
            if (cursor.getString(1) != null) writtenName = cursor.getString(1);
          }
        }
        if (target == null) {
          final ContentValues values = new ContentValues();
          values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
          values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
          values.put(MediaStore.MediaColumns.RELATIVE_PATH, folder);
          target = resolver.insert(collection, values);
          if (target == null) throw new IllegalStateException("MediaStore insert a eșuat");
          // Numele dat de Android (poate fi „… (1).json” dacă există deja unul care nu e al aplicației).
          try (Cursor named = resolver.query(target, new String[] { MediaStore.MediaColumns.DISPLAY_NAME }, null, null, null)) {
            if (named != null && named.moveToFirst() && named.getString(0) != null) writtenName = named.getString(0);
          }
        }
        try (OutputStream out = resolver.openOutputStream(target, "wt")) {
          if (out == null) throw new IllegalStateException("openOutputStream a eșuat");
          out.write(bytes);
          out.flush();
        }
        // Numele arată ora ultimei salvări. Dacă Android nu acceptă redenumirea, fișierul rămâne cu numele vechi.
        if (!name.equals(writtenName)) {
          try {
            final ContentValues rename = new ContentValues();
            rename.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            if (resolver.update(target, rename, null, null) > 0) {
              try (Cursor named = resolver.query(target, new String[] { MediaStore.MediaColumns.DISPLAY_NAME }, null, null, null)) {
                if (named != null && named.moveToFirst() && named.getString(0) != null) writtenName = named.getString(0);
              }
            }
          } catch (Exception ignored) {
            // Redenumirea e doar pentru ochi: conținutul e deja scris.
          }
        }
      } else {
        final File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), LIVE_FOLDER);
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Nu am putut crea folderul Documente/" + LIVE_FOLDER);
        // Android 9 și mai vechi: un singur fișier, redenumit la ora ultimei salvări.
        final File[] olds = dir.listFiles((folderFile, fileName) -> fileName.startsWith(base) && fileName.endsWith(".json") && !fileName.equals(name));
        try (FileOutputStream out = new FileOutputStream(new File(dir, name), false)) {
          out.write(bytes);
          out.flush();
        }
        if (olds != null) for (File old : olds) { if (!old.delete()) old.deleteOnExit(); }
      }
      final JSObject result = new JSObject();
      result.put("path", "Documents/" + LIVE_FOLDER + "/" + writtenName);
      call.resolve(result);
    } catch (Exception error) {
      call.reject(error.getMessage() != null ? error.getMessage() : "salvare eșuată", error);
    }
  }

  private static final String LIVE_FOLDER = "Buget Familie";

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
