package ro.balty1991.bugetfamilie;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  /**
   * Acțiunea cerută din widget sau din dală, până când stratul web o cere.
   * Nativul nu împinge nimic către pagină: la o pornire rece pagina încă nu
   * există, așa că JS-ul o ridică singur când e gata.
   */
  private String pendingQuickAction;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    pendingQuickAction = readQuickAction(getIntent());
    final WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) return;
    webView.addJavascriptInterface(new QuickActionBridge(), "BugetFamilieQuickAction");
    webView.addJavascriptInterface(new ReminderBridge(), "BugetFamilieReminders");
    ViewCompat.setOnApplyWindowInsetsListener(webView, (view, insets) -> {
      final Insets bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
      );
      injectSafeArea(webView, bars);
      return insets;
    });
    ViewCompat.requestApplyInsets(webView);
    webView.post(() -> ViewCompat.requestApplyInsets(webView));
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    final String action = readQuickAction(intent);
    if (action != null) pendingQuickAction = action;
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
    final String top = (bars.top / density) + "px";
    final String right = (bars.right / density) + "px";
    final String bottom = (bars.bottom / density) + "px";
    final String left = (bars.left / density) + "px";
    final String js =
      "(function(){var r=document.documentElement;"
        + "r.classList.add('capacitor-android');"
        + "r.style.setProperty('--safe-area-inset-top','" + top + "');"
        + "r.style.setProperty('--safe-area-inset-right','" + right + "');"
        + "r.style.setProperty('--safe-area-inset-bottom','" + bottom + "');"
        + "r.style.setProperty('--safe-area-inset-left','" + left + "');"
        + "})()";
    webView.evaluateJavascript(js, null);
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
  }

}
