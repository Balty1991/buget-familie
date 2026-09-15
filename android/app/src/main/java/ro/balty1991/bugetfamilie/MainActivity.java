package ro.balty1991.bugetfamilie;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.core.splashscreen.SplashScreen;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private static final int REQ_POST_NOTIFICATIONS = 4101;
  private static final String PREFS_CHROME = "bf_chrome";
  private static final String PREF_DARK = "dark";
  private volatile boolean keepSplash = true;
  private boolean launchDark;

  /**
   * Acțiunea cerută din widget sau din dală, până când stratul web o cere.
   * La pornire rece pagina încă nu există, deci JS o ridică singur (consume).
   * Dacă aplicația e deja vizibilă, onNewIntent semnalează JS să consume imediat.
   */
  private String pendingQuickAction;
  private boolean nativeBridgesAttached;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    launchDark = getSharedPreferences(PREFS_CHROME, MODE_PRIVATE).getBoolean(PREF_DARK, false);
    if (launchDark) {
      setTheme(R.style.AppTheme_NoActionBarLaunchDark);
    }
    SplashScreen splash = SplashScreen.installSplashScreen(this);
    splash.setKeepOnScreenCondition(() -> keepSplash);
    /* Fără zoom/fade. Overlay-ul HTML (#bf-boot) acoperă golul; nu ținem
       plicul nativ extra 280ms — se vedea ca o imagine de 5s. */
    splash.setOnExitAnimationListener(splashView -> splashView.remove());
    registerPlugin(BugetFamilieNativePlugin.class);
    super.onCreate(savedInstanceState);
    getWindow().setBackgroundDrawableResource(
      launchDark ? R.color.splash_background_dark : R.color.splash_background
    );
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    if (Build.VERSION.SDK_INT >= 29) {
      getWindow().setNavigationBarContrastEnforced(false);
    }
    applyChrome(Color.parseColor(launchDark ? "#12161C" : "#EEF1EF"), !launchDark);
    pendingQuickAction = readQuickAction(getIntent());
    if (getBridge() != null) attachNativeBridges(getBridge().getWebView());
    new Handler(Looper.getMainLooper()).postDelayed(() -> keepSplash = false, 1600);
  }

  private void applyChrome(int navColor, boolean lightIcons) {
    getWindow().setNavigationBarColor(navColor);
    getWindow().setStatusBarColor(Color.TRANSPARENT);
    WindowInsetsControllerCompat controller =
      WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    if (controller != null) {
      controller.setAppearanceLightNavigationBars(lightIcons);
      controller.setAppearanceLightStatusBars(lightIcons);
    }
  }

  /**
   * Trebuie apelat din Plugin.load() — înainte de loadUrl. Altfel
   * window.BugetFamilieReminders rămâne undefined pe sesiunea curentă.
   */
  void attachNativeBridges(WebView webView) {
    if (webView == null || nativeBridgesAttached) return;
    nativeBridgesAttached = true;
    webView.setBackgroundColor(Color.parseColor(launchDark ? "#0B0F0E" : "#E4E9E6"));
    webView.addJavascriptInterface(new QuickActionBridge(), "BugetFamilieQuickAction");
    webView.addJavascriptInterface(new ReminderBridge(), "BugetFamilieReminders");
    webView.addJavascriptInterface(new SplashBridge(), "BugetFamilieSplash");
    ViewCompat.setOnApplyWindowInsetsListener(webView, (view, insets) -> {
      final Insets bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
      );
      injectSafeArea(webView, bars);
      return insets;
    });
    ViewCompat.requestApplyInsets(webView);
    webView.post(() -> ViewCompat.requestApplyInsets(webView));
    /* Primul cadru HTML (#bf-boot) e destul — nu așteptăm React. */
    webView.postDelayed(() -> {
      if (Build.VERSION.SDK_INT >= 23) {
        webView.postVisualStateCallback(0xBF01, new WebView.VisualStateCallback() {
          @Override
          public void onComplete(long requestId) {
            keepSplash = false;
          }
        });
      }
    }, 180);
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    final String action = readQuickAction(intent);
    if (action != null) {
      pendingQuickAction = action;
      notifyWebQuickAction();
    }
  }

  /**
   * Dacă WebView-ul e deja în prim-plan, JS nu primește visibilitychange/focus.
   * Îl trezim să consume() — fără a pune acțiunea în string (doar un semnal).
   */
  private void notifyWebQuickAction() {
    final WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) return;
    webView.post(() -> webView.evaluateJavascript(
      "try{window.dispatchEvent(new CustomEvent('buget-familie:quick-action'))}catch(e){}",
      null
    ));
  }

  private String readQuickAction(Intent intent) {
    if (intent == null) return null;
    final String action = intent.getStringExtra(QuickActions.EXTRA_ACTION);
    if (!QuickActions.isKnown(action)) return null;
    if (action.startsWith(QuickActions.ACTION_TEMPLATE_PREFIX)) return action;
    final String templateId = intent.getStringExtra(QuickActions.EXTRA_TEMPLATE_ID);
    if (templateId != null && !templateId.isEmpty() && QuickActions.ACTION_EXPENSE.equals(action)) {
      return QuickActions.ACTION_TEMPLATE_PREFIX + templateId;
    }
    return action;
  }

  private final class SplashBridge {
    @JavascriptInterface
    public void hide() {
      new Handler(Looper.getMainLooper()).post(() -> keepSplash = false);
    }

    @JavascriptInterface
    public void setChrome(String navHex, boolean lightIcons) {
      new Handler(Looper.getMainLooper()).post(() -> {
        try {
          final int color = Color.parseColor(navHex);
          applyChrome(color, lightIcons);
        } catch (Exception ignored) {
          /* hex invalid din JS — păstrăm culoarea curentă */
        }
      });
    }

    @JavascriptInterface
    public void persistTheme(boolean dark) {
      getSharedPreferences(PREFS_CHROME, MODE_PRIVATE).edit().putBoolean(PREF_DARK, dark).apply();
      new Handler(Looper.getMainLooper()).post(() -> {
        launchDark = dark;
        getWindow().setBackgroundDrawableResource(
          dark ? R.color.splash_background_dark : R.color.splash_background
        );
        final WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
          webView.setBackgroundColor(Color.parseColor(dark ? "#0B0F0E" : "#E4E9E6"));
        }
      });
    }
  }

  /**
   * Singurul lucru pe care îl expune este numele acțiunii cerute, o singură dată.
   * publishTemplates scrie doar etichete pe widget — fără sume.
   */
  private final class QuickActionBridge {
    @JavascriptInterface
    public String consume() {
      final String action = pendingQuickAction;
      pendingQuickAction = null;
      return action == null ? "" : action;
    }

    @JavascriptInterface
    public void publishTemplates(String json) {
      WidgetTemplates.saveJson(MainActivity.this.getApplicationContext(), json);
      QuickAddWidgetProvider.updateAll(MainActivity.this.getApplicationContext());
    }
  }

  private void injectSafeArea(WebView webView, Insets bars) {
    final float density = getResources().getDisplayMetrics().density;
    int bottomPx = bars.bottom;
    /* Overlay 3 butoane (Huawei): systemBars.bottom e 0, dar bara acoperă WebView-ul. */
    if (bottomPx < (int) (28f * density)) {
      bottomPx = (int) (52f * density);
    }
    final String top = (bars.top / density) + "px";
    final String right = (bars.right / density) + "px";
    final String bottom = (bottomPx / density) + "px";
    final String left = (bars.left / density) + "px";
    final String js =
      "(function(){var r=document.documentElement;"
        + "r.classList.add('capacitor-android');"
        + "r.style.setProperty('--safe-area-inset-top','" + top + "');"
        + "r.style.setProperty('--safe-area-inset-right','" + right + "');"
        + "r.style.setProperty('--safe-area-inset-bottom','" + bottom + "');"
        + "r.style.setProperty('--safe-area-inset-left','" + left + "');"
        + "r.style.setProperty('--os-inset-top','" + top + "');"
        + "r.style.setProperty('--os-inset-right','" + right + "');"
        + "r.style.setProperty('--os-inset-bottom','" + bottom + "');"
        + "r.style.setProperty('--os-inset-left','" + left + "');"
        + "})()";
    webView.evaluateJavascript(js, null);
  }

  boolean hasNotifyPermission() {
    if (Build.VERSION.SDK_INT < 33) return true;
    return ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
      == PackageManager.PERMISSION_GRANTED;
  }

  private void notifyWebNotifyPermission(boolean granted) {
    final WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) return;
    final String js =
      "try{window.dispatchEvent(new CustomEvent('buget-familie:notify-permission',{detail:{granted:"
        + (granted ? "true" : "false")
        + "}}))}catch(e){}";
    webView.post(() -> webView.evaluateJavascript(js, null));
    /* WebView-ul e adesea pauzat cât e deschis dialogul de permisiune; repetăm după reluare. */
    webView.postDelayed(() -> webView.evaluateJavascript(js, null), 400);
    webView.postDelayed(() -> webView.evaluateJavascript(js, null), 1200);
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    if (requestCode != REQ_POST_NOTIFICATIONS) return;
    final boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
    notifyWebNotifyPermission(granted);
  }

  private final class ReminderBridge {
    @JavascriptInterface
    public void schedule(String payloadJson) {
      ReminderScheduler.scheduleJson(MainActivity.this.getApplicationContext(), payloadJson);
    }

    @JavascriptInterface
    public void cancelAll() {
      ReminderScheduler.cancelAll(MainActivity.this.getApplicationContext());
    }

    @JavascriptInterface
    public boolean hasPermission() {
      return MainActivity.this.hasNotifyPermission();
    }

    @JavascriptInterface
    public void requestPermission() {
      MainActivity.this.runOnUiThread(() -> {
        if (MainActivity.this.hasNotifyPermission()) {
          notifyWebNotifyPermission(true);
          return;
        }
        ActivityCompat.requestPermissions(
          MainActivity.this,
          new String[]{Manifest.permission.POST_NOTIFICATIONS},
          REQ_POST_NOTIFICATIONS
        );
      });
    }

    @JavascriptInterface
    public void notifyNow(String title, String body) {
      if (title == null || title.trim().isEmpty()) return;
      ReminderWorker.notifyNow(
        MainActivity.this.getApplicationContext(),
        title,
        body == null ? "" : body,
        4090
      );
    }
  }

}
