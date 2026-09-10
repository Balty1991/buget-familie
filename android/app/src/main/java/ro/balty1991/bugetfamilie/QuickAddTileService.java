package ro.balty1991.bugetfamilie;

import android.app.PendingIntent;
import android.os.Build;
import android.service.quicksettings.TileService;

/**
 * Dala din Setări rapide: o cheltuială se poate nota din trasarea de sus,
 * fără a căuta pictograma aplicației.
 */
// minSdk este 24, deci TileService există pe orice dispozitiv acceptat.
public class QuickAddTileService extends TileService {
  @Override
  public void onClick() {
    super.onClick();
    final PendingIntent intent = QuickActions.pendingIntent(this, QuickActions.ACTION_EXPENSE, 4);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      // Android 14 cere deschiderea prin PendingIntent, nu prin Intent direct.
      startActivityAndCollapse(intent);
    } else {
      startActivityAndCollapse(QuickActions.launchIntent(this, QuickActions.ACTION_EXPENSE));
    }
  }
}
