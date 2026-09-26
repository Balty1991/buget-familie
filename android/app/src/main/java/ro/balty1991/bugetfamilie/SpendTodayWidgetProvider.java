package ro.balty1991.bugetfamilie;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONObject;

/**
 * Widget „Poți cheltui azi”: cifra zilei și zilele până la salariu, publicate de aplicație
 * la fiecare schimbare. Arată o sumă pe ecranul principal, de aceea e un widget separat,
 * pe care omul îl adaugă doar dacă vrea; cel rapid rămâne fără sume.
 *
 * Nu calculează nimic singur: dacă aplicația n-a mai fost deschisă azi, spune că cifra e
 * de ieri (sau mai veche), în loc să arate o sumă care nu mai e adevărată. Android îl
 * reîmprospătează la 30 de minute (updatePeriodMillis), ca eticheta să apară și după miezul nopții.
 */
public class SpendTodayWidgetProvider extends AppWidgetProvider {
  private static final String PREFS = "buget_familie_widget";
  private static final String KEY = "spend_today";

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
    for (int widgetId : widgetIds) {
      updateOne(context, manager, widgetId);
    }
  }

  static void save(Context context, String json) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY, json == null ? "" : json)
      .apply();
  }

  static void updateAll(Context context) {
    final AppWidgetManager manager = AppWidgetManager.getInstance(context);
    final int[] ids = manager.getAppWidgetIds(new ComponentName(context, SpendTodayWidgetProvider.class));
    for (int id : ids) updateOne(context, manager, id);
  }

  private static void updateOne(Context context, AppWidgetManager manager, int widgetId) {
    final RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_spend_today);
    views.setOnClickPendingIntent(R.id.widget_spend_root, QuickActions.pendingIntent(context, QuickActions.ACTION_TODAY, 21));
    views.setOnClickPendingIntent(R.id.widget_spend_add, QuickActions.pendingIntent(context, QuickActions.ACTION_EXPENSE, 22));

    final SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    String amount = "";
    String caption = "";
    String date = "";
    String stale = "";
    String zone = "";
    try {
      final JSONObject row = new JSONObject(prefs.getString(KEY, "{}"));
      amount = row.optString("amount", "");
      caption = row.optString("caption", "");
      date = row.optString("date", "");
      stale = row.optString("stale", "");
      zone = row.optString("zone", "");
    } catch (Exception ignored) {
      /* fără date: mesajul de mai jos */
    }
    // Ziua familiei (fusul ales în aplicație), aceeași cu care aplicația a scris „date”.
    final SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
    if (!zone.isEmpty()) format.setTimeZone(TimeZone.getTimeZone(zone));
    final String today = format.format(new Date());
    if (amount.isEmpty()) {
      views.setTextViewText(R.id.widget_spend_amount, "—");
      views.setTextViewText(R.id.widget_spend_caption, context.getString(R.string.widget_spend_empty));
    } else {
      views.setTextViewText(R.id.widget_spend_amount, amount);
      // Cifra e a zilei în care a fost publicată; altă zi înseamnă „deschide aplicația”.
      views.setTextViewText(R.id.widget_spend_caption, today.equals(date) || stale.isEmpty() ? caption : stale);
    }
    manager.updateAppWidget(widgetId, views);
  }
}
