package ro.balty1991.bugetfamilie;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import java.util.List;

/**
 * Widget de pe ecranul principal: cheltuială, bon și până la 3 șabloane locale.
 * Nu afișează sume — ecranul de start rămâne neutru.
 */
public class QuickAddWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
    for (int widgetId : widgetIds) {
      updateOne(context, manager, widgetId);
    }
  }

  static void updateAll(Context context) {
    final AppWidgetManager manager = AppWidgetManager.getInstance(context);
    final int[] ids = manager.getAppWidgetIds(new ComponentName(context, QuickAddWidgetProvider.class));
    for (int id : ids) updateOne(context, manager, id);
  }

  private static void updateOne(Context context, AppWidgetManager manager, int widgetId) {
    final RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_add);
    views.setOnClickPendingIntent(R.id.widget_root, QuickActions.pendingIntent(context, QuickActions.ACTION_TODAY, 1));
    views.setOnClickPendingIntent(R.id.widget_expense, QuickActions.pendingIntent(context, QuickActions.ACTION_EXPENSE, 2));
    views.setOnClickPendingIntent(R.id.widget_receipt, QuickActions.pendingIntent(context, QuickActions.ACTION_RECEIPT, 3));

    final List<WidgetTemplates.Entry> templates = WidgetTemplates.load(context);
    final int[] slotIds = { R.id.widget_template_1, R.id.widget_template_2, R.id.widget_template_3 };
    for (int i = 0; i < slotIds.length; i++) {
      if (i < templates.size()) {
        final WidgetTemplates.Entry entry = templates.get(i);
        views.setViewVisibility(slotIds[i], View.VISIBLE);
        views.setTextViewText(slotIds[i], entry.label);
        views.setOnClickPendingIntent(slotIds[i], QuickActions.templatePendingIntent(context, entry.id, 10 + i));
      } else {
        views.setViewVisibility(slotIds[i], View.GONE);
      }
    }
    views.setViewVisibility(R.id.widget_templates_row, templates.isEmpty() ? View.GONE : View.VISIBLE);
    manager.updateAppWidget(widgetId, views);
  }
}
