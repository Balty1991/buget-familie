package ro.balty1991.bugetfamilie;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    final WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) return;
    ViewCompat.setOnApplyWindowInsetsListener(webView, (view, insets) -> {
      final Insets bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
      );
      // Nu paddăm WebView-ul — antetul trebuie să picteze sub ceas, nu un gol negru.
      injectSafeArea(webView, bars);
      return insets;
    });
    ViewCompat.requestApplyInsets(webView);
    webView.post(() -> ViewCompat.requestApplyInsets(webView));
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
}
