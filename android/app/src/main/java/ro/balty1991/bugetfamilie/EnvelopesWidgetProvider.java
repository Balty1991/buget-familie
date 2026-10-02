package ro.balty1991.bugetfamilie;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget „Plicurile mele”: primele trei plicuri, cu cât a rămas și o bară de consum.
 * Ca „Poți cheltui azi”, arată sume pe ecranul principal, deci e separat și opțional.
 *
 * Nu calculează nimic: aplicația publică rândurile la fiecare schimbare. Dacă ziua publicării
 * nu mai e azi, rândul de jos spune că sumele sunt vechi, în loc să le prezinte drept curente.
 */
public class EnvelopesWidgetProvider extends AppWidgetProvider {
  private static final String PREFS = "buget_familie_widget";
  private static final String KEY = "envelopes";
  private static final int[] ROWS = { R.id.widget_env_row1, R.id.widget_env_row2, R.id.widget_env_row3 };
  private static final int[] NAMES = { R.id.widget_env_name1, R.id.widget_env_name2, R.id.widget_env_name3 };
  private static final int[] LEFTS = { R.id.widget_env_left1, R.id.widget_env_left2, R.id.widget_env_left3 };
  private static final int[] BARS = { R.id.widget_env_bar1, R.id.widget_env_bar2, R.id.widget_env_bar3 };

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
    for (int widgetId : widgetIds) updateOne(context, manager, widgetId);
  }

  static void save(Context context, String json) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json == null ? "" : json).apply();
  }

  static void updateAll(Context context) {
    final AppWidgetManager manager = AppWidgetManager.getInstance(context);
    final int[] ids = manager.getAppWidgetIds(new ComponentName(context, EnvelopesWidgetProvider.class));
    for (int id : ids) updateOne(context, manager, id);
  }

  private static void updateOne(Context context, AppWidgetManager manager, int widgetId) {
    final RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_envelopes);
    views.setOnClickPendingIntent(R.id.widget_env_root, QuickActions.pendingIntent(context, QuickActions.ACTION_TODAY, 31));
    views.setOnClickPendingIntent(R.id.widget_env_add, QuickActions.pendingIntent(context, QuickActions.ACTION_EXPENSE, 32));

    JSONArray rows = new JSONArray();
    String date = "";
    String zone = "";
    String stale = "";
    try {
      final JSONObject data = new JSONObject(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "{}"));
      rows = data.optJSONArray("rows") == null ? new JSONArray() : data.optJSONArray("rows");
      date = data.optString("date", "");
      zone = data.optString("zone", "");
      stale = data.optString("stale", "");
    } catch (Exception ignored) {
      /* fără date: mesajul gol de mai jos */
    }

    for (int i = 0; i < ROWS.length; i++) {
      final JSONObject row = rows.optJSONObject(i);
      if (row == null) {
        views.setViewVisibility(ROWS[i], View.GONE);
        continue;
      }
      views.setViewVisibility(ROWS[i], View.VISIBLE);
      views.setTextViewText(NAMES[i], row.optString("label", ""));
      views.setTextViewText(LEFTS[i], row.optString("left", ""));
      views.setProgressBar(BARS[i], 100, Math.max(0, Math.min(100, row.optInt("used", 0))), false);
    }

    final SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
    if (!zone.isEmpty()) format.setTimeZone(TimeZone.getTimeZone(zone));
    final boolean fresh = format.format(new Date()).equals(date);
    if (rows.length() == 0) {
      views.setTextViewText(R.id.widget_env_note, context.getString(R.string.widget_env_empty));
    } else {
      views.setTextViewText(R.id.widget_env_note, fresh || stale.isEmpty() ? context.getString(R.string.widget_env_title) : stale);
    }
    manager.updateAppWidget(widgetId, views);
  }
}
