/**
 * Un singur import, ca foile de după prima pictare să vină într-un pachet,
 * nu în 10 cereri una după alta. Ordinea rămâne cea a cascadei.
 * contrast-fix, apk-safe-area, display-fixes și ui-modern-pass sunt deja
 * pe drumul critic, în main.tsx — nu le mai tragem a doua oară.
 */
import "./deferred-atelier.css";
import "./visual-polish.css";
import "./ui-modern-pass-aggressive.css";
import "./ui-modern-pass-max.css";
import "./ui-screens-modern-2026.css";
import "./ui-themes-modern-2026.css";
import "./ui-fix-analysis-line.css";
import "./ui-fix-more-space.css";
import "./tokens.css";
import "./today.css";
import "./movements.css";
import "./plan.css";
