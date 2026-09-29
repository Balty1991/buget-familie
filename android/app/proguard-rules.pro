# Release micșorat. Clasele noastre rămân întregi: punțile JS, widgetul, dala și reminderul
# sunt chemate din JavaScript sau din manifest, nu din codul Java pe care R8 îl vede.

-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class ro.balty1991.bugetfamilie.** { *; }

-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class * extends androidx.work.ListenableWorker { *; }
-keep class * extends android.appwidget.AppWidgetProvider { *; }
-keep class * extends android.service.quicksettings.TileService { *; }
