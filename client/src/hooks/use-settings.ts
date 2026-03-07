import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { SiteSettingsData } from "@shared/schema";
import { DEFAULT_SETTINGS } from "@shared/schema";

export function hexToHsl(hex: string): string {
  const safeHex = hex.startsWith("#") ? hex : "#3b82f6";
  const r = parseInt(safeHex.slice(1, 3), 16) / 255;
  const g = parseInt(safeHex.slice(3, 5), 16) / 255;
  const b = parseInt(safeHex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function injectGoogleFonts(fonts: string[]) {
  const unique = [...new Set(fonts)];
  const existing = document.getElementById("dynamic-google-fonts");
  if (existing) existing.remove();
  const families = unique.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`).join("&");
  const link = document.createElement("link");
  link.id = "dynamic-google-fonts";
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
}

function updateMetaTags(settings: SiteSettingsData) {
  if ((window as any).__pageTitleOverride) return;
  if (settings.siteTitle) {
    document.title = settings.siteTitle;
  }
  if (settings.siteDescription) {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = settings.siteDescription;
  }
  const existingFavicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (settings.faviconBase64) {
    const link = existingFavicon || document.createElement("link");
    link.rel = "icon";
    link.href = settings.faviconBase64;
    if (!existingFavicon) document.head.appendChild(link);
  } else if (existingFavicon) {
    existingFavicon.href = "/favicon.ico";
  }
}

export function applySettingsToDOM(settings: SiteSettingsData) {
  const root = document.documentElement;
  const primaryHsl = hexToHsl(settings.primaryColor);
  const secondaryHsl = hexToHsl(settings.secondaryColor);
  root.style.setProperty("--primary", primaryHsl);
  root.style.setProperty("--ring", primaryHsl);
  root.style.setProperty("--sidebar-primary", primaryHsl);
  root.style.setProperty("--sidebar-ring", primaryHsl);
  root.style.setProperty("--accent", secondaryHsl);
  root.style.setProperty("--font-display", `'${settings.headingFont}', sans-serif`);
  root.style.setProperty("--font-sans", `'${settings.bodyFont}', sans-serif`);
  injectGoogleFonts([settings.headingFont, settings.bodyFont]);
  updateMetaTags(settings);
}

export function useSettings() {
  const query = useQuery<SiteSettingsData>({
    queryKey: ["/api/settings"],
    staleTime: 1000 * 60 * 5,
  });

  const settings = query.data ?? DEFAULT_SETTINGS;

  useEffect(() => {
    if (query.data) {
      applySettingsToDOM(query.data);
    }
  }, [query.data]);

  return { settings, isLoading: query.isLoading };
}

export function useSiteSettings(): SiteSettingsData {
  const { data } = useQuery<SiteSettingsData>({
    queryKey: ["/api/settings"],
    staleTime: 1000 * 60 * 5,
  });
  return data ? { ...DEFAULT_SETTINGS, ...data } : DEFAULT_SETTINGS;
}
