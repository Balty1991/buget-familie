package ro.balty1991.bugetfamilie;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget „Săptămâna banilor”: ultimele 7 zile ca bare colorate după cât s-a cheltuit (aceleași
 * praguri ca în Calendarul banilor), totalul săptămânii și comparația cu cea dinainte.
 * Barele sunt desenate aici, într-o imagine: RemoteViews nu știe grafice.
 * Ca celelalte widgeturi cu sume, e opțional și arată când datele sunt de altă zi.
 */
public class WeekWidgetProvider extends AppWidgetProvider {
  private static final String PREFS = "buget_familie_widget";
  private static final String KEY = "week";
  private static final int[] HEAT_LIGHT = { 0xFFDCE2DB, 0xFFA9D3BE, 0xFF4E9C7E, 0xFFD9A441, 0xFFC9564B };
  private static final int[] HEAT_DARK = { 0xFF26332E, 0xFF2F5E4C, 0xFF4E9C7E, 0xFFC99A3A, 0xFFD06257 };

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
    for (int widgetId : widgetIds) updateOne(context, manager, widgetId);
  }

  static void save(Context context, String json) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json == null ? "" : json).apply();
  }

  static void updateAll(Context context) {
    final AppWidgetManager manager = AppWidgetManager.getInstance(context);
    final int[] ids = manager.getAppWidgetIds(new ComponentName(context, WeekWidgetProvider.class));
    for (int id : ids) updateOne(context, manager, id);
  }

  private static void updateOne(Context context, AppWidgetManager manager, int widgetId) {
    final RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_week);
    views.setOnClickPendingIntent(R.id.widget_week_root, QuickActions.pendingIntent(context, QuickActions.ACTION_TODAY, 31));
    final SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    String total = "";
    String caption = "";
    String date = "";
    String stale = "";
    String zone = "";
    JSONArray days = new JSONArray();
    try {
      final JSONObject row = new JSONObject(prefs.getString(KEY, "{}"));
      total = row.optString("total", "");
      caption = row.optString("caption", "");
      date = row.optString("date", "");
      stale = row.optString("stale", "");
      zone = row.optString("zone", "");
      final JSONArray read = row.optJSONArray("days");
      if (read != null) days = read;
    } catch (Exception ignored) {
      /* fără date: mesajul de mai jos */
    }
    final SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
    if (!zone.isEmpty()) format.setTimeZone(TimeZone.getTimeZone(zone));
    final String today = format.format(new Date());
    if (days.length() == 0) {
      views.setTextViewText(R.id.widget_week_total, "—");
      views.setTextViewText(R.id.widget_week_caption, context.getString(R.string.widget_week_empty));
    } else {
      views.setTextViewText(R.id.widget_week_total, total);
      views.setTextViewText(R.id.widget_week_caption, today.equals(date) || stale.isEmpty() ? caption : stale);
      try {
        views.setImageViewBitmap(R.id.widget_week_chart, draw(context, days));
      } catch (Exception ignored) {
        /* fără grafic; cifrele rămân */
      }
    }
    manager.updateAppWidget(widgetId, views);
  }

  /** Șapte bare rotunjite, cu suma scurtă deasupra și inițiala zilei dedesubt; azi e conturată. */
  static Bitmap draw(Context context, JSONArray days) throws Exception {
    final float density = context.getResources().getDisplayMetrics().density;
    final int width = Math.round(280 * density);
    final int height = Math.round(96 * density);
    final Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
    final Canvas canvas = new Canvas(bitmap);
    final boolean night = (context.getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES;
    final int[] heat = night ? HEAT_DARK : HEAT_LIGHT;
    final int ink = context.getColor(R.color.widget_ink);
    final int muted = context.getColor(R.color.widget_muted);
    double max = 1;
    for (int i = 0; i < days.length(); i++) max = Math.max(max, days.getJSONObject(i).optDouble("amount", 0));
    final int count = Math.max(1, days.length());
    final float slot = width / (float) count;
    final float top = 16 * density;
    final float bottom = height - 16 * density;
    final Paint bar = new Paint(Paint.ANTI_ALIAS_FLAG);
    final Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
    ring.setStyle(Paint.Style.STROKE);
    ring.setStrokeWidth(2 * density);
    ring.setColor(ink);
    final Paint label = new Paint(Paint.ANTI_ALIAS_FLAG);
    label.setTextAlign(Paint.Align.CENTER);
    label.setTextSize(10 * density);
    for (int i = 0; i < days.length(); i++) {
      final JSONObject day = days.getJSONObject(i);
      final double amount = day.optDouble("amount", 0);
      final int level = Math.max(0, Math.min(4, day.optInt("heat", 0)));
      final float h = (float) Math.max(3 * density, (amount / max) * (bottom - top));
      final float cx = slot * i + slot / 2f;
      final float half = Math.min(slot * 0.32f, 14 * density);
      final RectF rect = new RectF(cx - half, bottom - h, cx + half, bottom);
      bar.setColor(heat[level]);
      canvas.drawRoundRect(rect, 5 * density, 5 * density, bar);
      final boolean isToday = day.optBoolean("today", false);
      if (isToday) canvas.drawRoundRect(rect, 5 * density, 5 * density, ring);
      label.setColor(isToday ? ink : muted);
      label.setTypeface(isToday ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
      canvas.drawText(day.optString("label", ""), cx, height - 3 * density, label);
      final String shortAmount = day.optString("short", "");
      if (!shortAmount.isEmpty()) canvas.drawText(shortAmount, cx, Math.max(11 * density, bottom - h - 4 * density), label);
    }
    return bitmap;
  }
}
