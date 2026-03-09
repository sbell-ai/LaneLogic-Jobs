export function parseHex(hex: string): [number, number, number] | null {
  const m = hex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let r: number, g: number, b: number;
  if (m[1].length === 3) {
    r = parseInt(m[1][0] + m[1][0], 16);
    g = parseInt(m[1][1] + m[1][1], 16);
    b = parseInt(m[1][2] + m[1][2], 16);
  } else {
    r = parseInt(m[1].slice(0, 2), 16);
    g = parseInt(m[1].slice(2, 4), 16);
    b = parseInt(m[1].slice(4, 6), 16);
  }
  return [r, g, b];
}

export function normalizeHex(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return `#${rgb.map(c => c.toString(16).padStart(2, "0")).join("")}`;
}

export function alphaBlend(
  fgR: number, fgG: number, fgB: number, fgA: number,
  bgR: number, bgG: number, bgB: number,
): [number, number, number] {
  return [
    Math.round(fgR * fgA + bgR * (1 - fgA)),
    Math.round(fgG * fgA + bgG * (1 - fgA)),
    Math.round(fgB * fgA + bgB * (1 - fgA)),
  ];
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
): number {
  const l1 = luminance(r1, g1, b1);
  const l2 = luminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function computeEffectiveBg(
  footerBgHex: string,
  footerBgOpacity: number,
  pageBgHex: string,
): [number, number, number] | null {
  const fg = parseHex(footerBgHex);
  const bg = parseHex(pageBgHex);
  if (!fg || !bg) return null;
  return alphaBlend(fg[0], fg[1], fg[2], footerBgOpacity, bg[0], bg[1], bg[2]);
}

export interface ContrastCheckResult {
  field: string;
  ratio: number;
  passes: boolean;
  message: string;
}

export function checkFooterContrast(
  footerBgHex: string,
  footerBgOpacity: number,
  pageBgHex: string,
  footerTextColor: string,
  footerLinkColor: string,
  footerLinkHoverColor: string,
): ContrastCheckResult[] {
  const effectiveBg = computeEffectiveBg(footerBgHex, footerBgOpacity, pageBgHex);
  if (!effectiveBg) return [];

  const checks: { field: string; label: string; hex: string }[] = [
    { field: "footerTextColor", label: "Footer text", hex: footerTextColor },
    { field: "footerLinkColor", label: "Footer link", hex: footerLinkColor },
    { field: "footerLinkHoverColor", label: "Footer link hover", hex: footerLinkHoverColor },
  ];

  return checks.map(({ field, label, hex }) => {
    const fg = parseHex(hex);
    if (!fg) return { field, ratio: 0, passes: false, message: `${label} color is invalid` };
    const ratio = contrastRatio(fg[0], fg[1], fg[2], effectiveBg[0], effectiveBg[1], effectiveBg[2]);
    const rounded = Math.round(ratio * 10) / 10;
    return {
      field,
      ratio: rounded,
      passes: ratio >= 4.5,
      message: ratio >= 4.5
        ? `${label}: ${rounded}:1 (passes)`
        : `${label} fails contrast against effective footer background (${rounded}:1, needs 4.5:1)`,
    };
  });
}
