package ro.balty1991.bugetfamilie;

import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Adaugă punțile JS înainte ca pagina să se încarce. addJavascriptInterface
 * după loadUrl nu există pe pagina curentă — de-aia alertele nu se activau.
 */
@CapacitorPlugin(name = "BugetFamilieNative")
public class BugetFamilieNativePlugin extends Plugin {
  @Override
  public void load() {
    final MainActivity activity = (MainActivity) getActivity();
    if (activity == null || getBridge() == null) return;
    final WebView webView = getBridge().getWebView();
    activity.attachNativeBridges(webView);
  }
}
