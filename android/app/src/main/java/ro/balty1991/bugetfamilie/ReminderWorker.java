package ro.balty1991.bugetfamilie;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * Afișează o reamintire locală (tranșă, salariu, plic) fără a citi registrul financiar.
 * Payload-ul vine din WorkManager (titlu + text), programat din WebView când aplicația e deschisă.
 */
public class ReminderWorker extends Worker {
  public static final String CHANNEL_ID = "bf_plan_reminders";
  public static final String KEY_TITLE = "title";
  public static final String KEY_BODY = "body";
  public static final String KEY_TAG = "tag";
  public static final String KEY_NOTIFY_ID = "notifyId";

  public ReminderWorker(@NonNull Context context, @NonNull WorkerParameters params) {
    super(context, params);
  }

  @NonNull
  @Override
  public Result doWork() {
    final String title = getInputData().getString(KEY_TITLE);
    final String body = getInputData().getString(KEY_BODY);
    final String tag = getInputData().getString(KEY_TAG);
    final int notifyId = getInputData().getInt(KEY_NOTIFY_ID, (int) System.currentTimeMillis());
    if (title == null || title.isEmpty() || body == null || body.isEmpty()) {
      return Result.success();
    }
    notifyNow(getApplicationContext(), title, body, notifyId, tag);
    return Result.success();
  }

  static void notifyNow(Context context, String title, String body, int notifyId) {
    notifyNow(context, title, body, notifyId, "alerts-on");
  }

  static void notifyNow(Context context, String title, String body, int notifyId, String tag) {
    if (Build.VERSION.SDK_INT >= 33) {
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
        != PackageManager.PERMISSION_GRANTED) {
        return;
      }
    }
    ensureChannel(context);
    final Intent open = new Intent(context, MainActivity.class);
    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    final PendingIntent content = PendingIntent.getActivity(
      context,
      notifyId,
      open,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    final NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(content)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setCategory(NotificationCompat.CATEGORY_REMINDER);
    if (tag != null && !tag.isEmpty()) {
      builder.setGroup(tag);
    }
    try {
      NotificationManagerCompat.from(context).notify(tag != null ? tag : "bf", notifyId, builder.build());
    } catch (SecurityException ignored) {
      // Fără POST_NOTIFICATIONS pe Android 13+ — utilizatorul poate activa din Setări.
    }
  }

  static void ensureChannel(Context context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    final NotificationManager manager = context.getSystemService(NotificationManager.class);
    if (manager == null) return;
    NotificationChannel channel = manager.getNotificationChannel(CHANNEL_ID);
    if (channel != null) return;
    channel = new NotificationChannel(
      CHANNEL_ID,
      context.getString(R.string.reminder_channel_name),
      NotificationManager.IMPORTANCE_DEFAULT
    );
    channel.setDescription(context.getString(R.string.reminder_channel_desc));
    manager.createNotificationChannel(channel);
  }
}
