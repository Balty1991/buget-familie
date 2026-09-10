package ro.balty1991.bugetfamilie;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

/**
 * Acțiunile pornite din afara aplicației: widgetul de pe ecranul principal și
 * dala din Setări rapide. Nu poartă date financiare, doar intenția utilizatorului;
 * ecranul care se deschide cere oricum confirmarea sumei.
 */
public final class QuickActions {
  public static final String EXTRA_ACTION = "ro.balty1991.bugetfamilie.QUICK_ACTION";
  public static final String ACTION_EXPENSE = "expense";
  public static final String ACTION_RECEIPT = "receipt";
  public static final String ACTION_TODAY = "today";

  private QuickActions() {}

  static Intent launchIntent(Context context, String action) {
    final Intent intent = new Intent(context, MainActivity.class);
    intent.setAction(Intent.ACTION_MAIN);
    intent.addCategory(Intent.CATEGORY_LAUNCHER);
    intent.putExtra(EXTRA_ACTION, action);
    // Reia aplicația deja deschisă în loc să pornească o a doua copie.
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
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

  /** Doar acțiunile cunoscute ajung în stratul web; orice altceva este ignorat. */
  static boolean isKnown(String action) {
    return ACTION_EXPENSE.equals(action) || ACTION_RECEIPT.equals(action) || ACTION_TODAY.equals(action);
  }
}
