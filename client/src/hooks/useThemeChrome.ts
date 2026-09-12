/**
 * Temă, fundal, contrast și program automat — efecte pe documentElement + localStorage.
 */
import { useEffect, useRef, useState } from "react";
import {
  LIGHT_THEMES,
  automaticTheme,
  backgroundOptions,
  currentLocalMinutes,
  defaultScheduleTimes,
  type BackgroundId,
  type ThemeId,
  type ThemeSchedule,
  type ThemeScheduleTimes,
} from "@/pages/home-kit";
import { ALL_THEME_CLASS_IDS, resolveInitialTheme } from "@/lib/theme-default";
import { safeSetItem } from "@/lib/safe-storage";

export function useThemeChrome() {
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(() => resolveInitialTheme(window.localStorage));
  const [themeSchedule, setThemeSchedule] = useState<ThemeSchedule>(() =>
    window.localStorage.getItem("buget-familie:theme-schedule") === "auto" ? "auto" : "manual",
  );
  const [background, setBackground] = useState<BackgroundId>(() => {
    const saved = window.localStorage.getItem("buget-familie:background");
    return backgroundOptions.some((item) => item.id === saved) ? (saved as BackgroundId) : "plain";
  });
  const previousBackgroundRef = useRef<BackgroundId>(background);
  const backgroundTransitionReady = useRef(false);
  const [highContrast, setHighContrast] = useState(() => window.localStorage.getItem("buget-familie:high-contrast") === "true");
  const [scheduleTimes, setScheduleTimes] = useState<ThemeScheduleTimes>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("buget-familie:theme-schedule-times") || "null") as Partial<ThemeScheduleTimes> | null;
      return {
        dayStart: typeof saved?.dayStart === "string" ? saved.dayStart : defaultScheduleTimes.dayStart,
        eveningStart: typeof saved?.eveningStart === "string" ? saved.eveningStart : defaultScheduleTimes.eveningStart,
        nightStart: typeof saved?.nightStart === "string" ? saved.nightStart : defaultScheduleTimes.nightStart,
      };
    } catch {
      return defaultScheduleTimes;
    }
  });
  const activeTheme = themeSchedule === "auto" ? automaticTheme(currentLocalMinutes(), scheduleTimes) : theme;
  const previousThemeRef = useRef<ThemeId>(activeTheme);
  const themeTransitionReady = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    const previous = previousThemeRef.current;
    root.classList.remove(...ALL_THEME_CLASS_IDS.map((id) => `theme-${id}`));
    root.classList.add(`theme-${activeTheme}`);
    root.classList.toggle("dark", !LIGHT_THEMES.includes(activeTheme));
    if (themeTransitionReady.current && previous !== activeTheme) {
      root.classList.remove("theme-transitioning");
      root.classList.add("theme-transitioning");
      const timer = window.setTimeout(() => root.classList.remove("theme-transitioning"), 420);
      previousThemeRef.current = activeTheme;
      return () => window.clearTimeout(timer);
    }
    themeTransitionReady.current = true;
    previousThemeRef.current = activeTheme;
  }, [activeTheme]);

  useEffect(() => {
    safeSetItem(window.localStorage, "buget-familie:theme", theme);
  }, [theme]);
  useEffect(() => {
    safeSetItem(window.localStorage, "buget-familie:theme-schedule", themeSchedule);
  }, [themeSchedule]);
  useEffect(() => {
    safeSetItem(window.localStorage, "buget-familie:theme-schedule-times", JSON.stringify(scheduleTimes));
  }, [scheduleTimes]);

  useEffect(() => {
    const root = document.documentElement;
    const previous = previousBackgroundRef.current;
    if (backgroundTransitionReady.current && previous !== background) {
      root.classList.remove(
        "background-transitioning",
        "background-from-plain",
        "background-from-paper",
        "background-from-grid",
        "background-from-aurora",
        "background-from-dots",
      );
      root.classList.add("background-transitioning", `background-from-${previous}`);
      const timer = window.setTimeout(() => root.classList.remove("background-transitioning", `background-from-${previous}`), 520);
      previousBackgroundRef.current = background;
      return () => window.clearTimeout(timer);
    }
    backgroundTransitionReady.current = true;
    previousBackgroundRef.current = background;
  }, [background]);

  useEffect(() => {
    document.documentElement.classList.remove("background-plain", "background-paper", "background-grid", "background-aurora", "background-dots");
    document.documentElement.classList.add(`background-${background}`);
    safeSetItem(window.localStorage, "buget-familie:background", background);
  }, [background]);

  useEffect(() => {
    document.documentElement.classList.toggle("bf-high-contrast", highContrast);
    safeSetItem(window.localStorage, "buget-familie:high-contrast", String(highContrast));
  }, [highContrast]);

  useEffect(() => {
    const openTheme = () => setThemePickerOpen(true);
    window.addEventListener("buget-familie:open-theme", openTheme);
    return () => window.removeEventListener("buget-familie:open-theme", openTheme);
  }, []);

  return {
    themePickerOpen,
    setThemePickerOpen,
    theme,
    setTheme,
    themeSchedule,
    setThemeSchedule,
    background,
    setBackground,
    highContrast,
    setHighContrast,
    scheduleTimes,
    setScheduleTimes,
  };
}
