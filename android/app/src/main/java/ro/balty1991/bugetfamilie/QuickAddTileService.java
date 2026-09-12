package ro.balty1991.bugetfamilie;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.TileService;

/**
 * Dala din Setări rapide: o cheltuială se poate nota din trasarea de sus,
 * fără a căuta pictograma aplicației.
 */
public class QuickAddTileService extends TileService {
  @Override
  public void onClick() {
    super.onClick();
    final PendingIntent pending = QuickActions.pendingIntent(this, QuickActions.ACTION_EXPENSE, 4);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      // Android 14+ cere PendingIntent.
      startActivityAndCollapse(pending);
      return;
    }
    final Intent intent = QuickActions.launchIntent(this, QuickActions.ACTION_EXPENSE);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    startActivityAndCollapse(intent);
  }
}
