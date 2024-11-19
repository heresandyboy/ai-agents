import { signal, computed } from "@preact/signals-react";

export type Theme = "light" | "dark";

class ThemeState {
  private theme = signal<Theme>("light");

  constructor() {
    if (typeof window !== "undefined") {
      // Check localStorage first, then system preference
      const savedTheme = localStorage.getItem("theme");
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

      const initialTheme =
        (savedTheme as Theme) || (prefersDark ? "dark" : "light");
      this.theme.value = initialTheme;

      // Apply theme immediately
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(initialTheme);
    }
  }

  currentTheme = computed(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(this.theme.value);
      localStorage.setItem("theme", this.theme.value);
    }
    return this.theme.value;
  });

  toggle() {
    this.theme.value = this.theme.value === "dark" ? "light" : "dark";
  }
}

export const themeState = new ThemeState();
