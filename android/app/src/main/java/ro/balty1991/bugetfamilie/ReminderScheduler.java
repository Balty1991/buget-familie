package ro.balty1991.bugetfamilie;

import android.content.Context;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Programează reamintiri OneTime prin WorkManager. Unique work pe tag — reprogramarea
 * înlocuiește vechiul job, ca să nu spamăm la fiecare deschidere a aplicației.
 * Maximum 6 reamintiri pe apel (tranșă / salariu / plicuri).
 */
public final class ReminderScheduler {
  private ReminderScheduler() {}

  public static void scheduleJson(Context context, String payload) {
    if (payload == null || payload.trim().isEmpty()) return;
    ReminderWorker.ensureChannel(context);
    try {
      final JSONArray items = new JSONArray(payload);
      final int limit = Math.min(items.length(), 6);
      for (int i = 0; i < limit; i += 1) {
        final JSONObject item = items.getJSONObject(i);
        final String title = item.optString("title", "").trim();
        final String body = item.optString("body", "").trim();
        final String tag = item.optString("tag", "bf-reminder-" + i).trim();
        final long atMs = item.optLong("at", 0L);
        final int notifyId = item.optInt("id", 4200 + i);
        if (title.isEmpty() || body.isEmpty() || atMs <= 0L) continue;
        long delay = atMs - System.currentTimeMillis();
        if (delay < 5_000L) delay = 5_000L;
        // Nu programa mai departe de 14 zile — WorkManager e pentru orizont scurt.
        if (delay > TimeUnit.DAYS.toMillis(14)) continue;
        final Data data = new Data.Builder()
          .putString(ReminderWorker.KEY_TITLE, title)
          .putString(ReminderWorker.KEY_BODY, body)
          .putString(ReminderWorker.KEY_TAG, tag)
          .putInt(ReminderWorker.KEY_NOTIFY_ID, notifyId)
          .build();
        final OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(ReminderWorker.class)
          .setInitialDelay(delay, TimeUnit.MILLISECONDS)
          .setInputData(data)
          .addTag("bf-reminder")
          .build();
        WorkManager.getInstance(context).enqueueUniqueWork(
          "bf-" + tag,
          ExistingWorkPolicy.REPLACE,
          request
        );
      }
    } catch (Exception ignored) {
      // Payload invalid — nu blocăm aplicația.
    }
  }

  public static void cancelAll(Context context) {
    WorkManager.getInstance(context).cancelAllWorkByTag("bf-reminder");
  }
}
