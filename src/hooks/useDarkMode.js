import { useState, useEffect } from "react";

const THEME_KEY = "mrc_darkmode";

export function useDarkMode() {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored !== null) {
      return stored === "true";
    }
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return true;
    }
    return false;
  });

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, String(darkMode));
    } catch {
      // Ignore storage errors
    }
  }, [darkMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === null) {
        setDarkMode(e.matches);
      }
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return [darkMode, setDarkMode];
}
