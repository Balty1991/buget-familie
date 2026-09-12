package ro.balty1991.bugetfamilie;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

/**
 * Acțiunile pornite din afara aplicației: widgetul de pe ecranul principal și
 * dala din Setări rapide. Nu poartă sume — doar intenția; ecranul cere confirmarea.
 */
public final class QuickActions {
  public static final String EXTRA_ACTION = "ro.balty1991.bugetfamilie.QUICK_ACTION";
  public static final String EXTRA_TEMPLATE_ID = "ro.balty1991.bugetfamilie.TEMPLATE_ID";
  public static final String ACTION_EXPENSE = "expense";
  public static final String ACTION_RECEIPT = "receipt";
  public static final String ACTION_TODAY = "today";
  /** Prefix pentru un șablon local: „template:&lt;id&gt;”. */
  public static final String ACTION_TEMPLATE_PREFIX = "template:";

  private QuickActions() {}

  static Intent launchIntent(Context context, String action) {
    return launchIntent(context, action, null);
  }

  static Intent launchIntent(Context context, String action, String templateId) {
    final Intent intent = new Intent(context, MainActivity.class);
    intent.setAction(Intent.ACTION_MAIN);
    intent.addCategory(Intent.CATEGORY_LAUNCHER);
    intent.putExtra(EXTRA_ACTION, action);
    if (templateId != null && !templateId.isEmpty()) {
      intent.putExtra(EXTRA_TEMPLATE_ID, templateId);
    }
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    return intent;
  }

  static PendingIntent pendingIntent(Context context, String action, int requestCode) {
    return PendingIntent.getActivity(
      context,
      requestCode,
      launchIntent(context, action),
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
  }

  static PendingIntent templatePendingIntent(Context context, String templateId, int requestCode) {
    final String action = ACTION_TEMPLATE_PREFIX + templateId;
    return PendingIntent.getActivity(
      context,
      requestCode,
      launchIntent(context, action, templateId),
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
  }

  /** Doar acțiunile cunoscute ajung în stratul web; orice altceva este ignorat. */
  static boolean isKnown(String action) {
    if (action == null) return false;
    return ACTION_EXPENSE.equals(action)
      || ACTION_RECEIPT.equals(action)
      || ACTION_TODAY.equals(action)
      || action.startsWith(ACTION_TEMPLATE_PREFIX);
  }
}
