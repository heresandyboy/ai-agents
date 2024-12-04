'use client';

import { useDocumentEffect } from "@/hooks/useDocumentEffect";

const LIGHT_THEME_COLOR = 'hsl(0 0% 100%)';
const DARK_THEME_COLOR = 'hsl(222.2 84% 4.9%)';

export function ThemeScript() {
  useDocumentEffect((document) => {
    const html = document.documentElement;
    let meta = document.querySelector('meta[name="theme-color"]');
    
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }

    const updateThemeColor = () => {
      const isDark = html.classList.contains('dark');
      meta?.setAttribute('content', isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
    };

    const observer = new MutationObserver(updateThemeColor);
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    updateThemeColor();

    return () => observer.disconnect();
  }, []);

  return null;
}