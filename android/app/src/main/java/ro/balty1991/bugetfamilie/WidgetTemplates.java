package ro.balty1991.bugetfamilie;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/**
 * Ultimele șabloane de cheltuială publicate din WebView — doar id + etichetă,
 * fără sume (privacy pe ecranul de start).
 */
public final class WidgetTemplates {
  private static final String PREFS = "buget_familie_widget";
  private static final String KEY = "expense_templates";

  public static final class Entry {
    public final String id;
    public final String label;
    Entry(String id, String label) {
      this.id = id;
      this.label = label;
    }
  }

  private WidgetTemplates() {}

  public static void saveJson(Context context, String json) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY, json == null ? "[]" : json)
      .apply();
  }

  public static List<Entry> load(Context context) {
    final List<Entry> out = new ArrayList<>();
    final SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    final String raw = prefs.getString(KEY, "[]");
    try {
      final JSONArray arr = new JSONArray(raw);
      for (int i = 0; i < arr.length() && out.size() < 3; i++) {
        final JSONObject row = arr.getJSONObject(i);
        final String id = row.optString("id", "");
        final String label = row.optString("label", "").trim();
        if (!id.isEmpty() && !label.isEmpty()) out.add(new Entry(id, label));
      }
    } catch (Exception ignored) {
      /* șabloanele pe widget sunt opționale */
    }
    return out;
  }
}
