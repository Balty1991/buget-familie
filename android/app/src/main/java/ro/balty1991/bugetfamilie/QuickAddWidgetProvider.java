package ro.balty1991.bugetfamilie;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

/**
 * Widget de pe ecranul principal: adaugă o cheltuială sau fotografiază un bon
 * fără a deschide întâi aplicația. Nu afișează sume — ecranul de start rămâne
 * neutru pentru cine se uită peste umăr.
 */
public class QuickAddWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
    for (int widgetId : widgetIds) {
      final RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_add);
      views.setOnClickPendingIntent(R.id.widget_root, QuickActions.pendingIntent(context, QuickActions.ACTION_TODAY, 1));
      views.setOnClickPendingIntent(R.id.widget_expense, QuickActions.pendingIntent(context, QuickActions.ACTION_EXPENSE, 2));
      views.setOnClickPendingIntent(R.id.widget_receipt, QuickActions.pendingIntent(context, QuickActions.ACTION_RECEIPT, 3));
      manager.updateAppWidget(widgetId, views);
    }
  }
}
