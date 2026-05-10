// Sprint 7 — shared scraper filters.
//
// isUSLocation is conservative: a posting is kept only when its location
// string carries an unambiguous US marker. Postings without enough signal
// (e.g. "Atlanta Warehouse" with no country) are dropped — better to miss a
// US job than seed a non-US one. Multi-location strings (semicolon-separated)
// are accepted if ANY entry is US.

const NON_US_COUNTRY_PATTERNS: RegExp[] = [
  /\bmexico\b/,
  /\bcanada\b/,
  /\bindia\b/,
  /\bchina\b/,
  /\bvietnam\b/,
  /\bindonesia\b/,
  /\bmalaysia\b/,
  /\bphilippines\b/,
  /\btaiwan\b/,
  /\bcambodia\b/,
  /\bitaly\b/,
  /\bfrance\b/,
  /\bgermany\b/,
  /\bnetherlands\b/,
  /\bbelgium\b/,
  /\bdenmark\b/,
  /\bpoland\b/,
  /\baustralia\b/,
  /\bengland\b/,
  /\bscotland\b/,
  /\bwales\b/,
  /\bireland\b/,
  /\bunited kingdom\b/,
  /\bu\.?k\.?\b/,
  /\bspain\b/,
  /\bportugal\b/,
  /\bbrazil\b/,
  /\bargentina\b/,
  /\bcolombia\b/,
  /\bchile\b/,
  /\bjapan\b/,
  /\bkorea\b/,
  /\bsingapore\b/,
  /\bthailand\b/,
  /\bswitzerland\b/,
  /\baustria\b/,
  /\bsweden\b/,
  /\bnorway\b/,
  /\bfinland\b/,
];

// Comma-prefixed two-letter US state — matches "Denver, CO" or "Frisco, TX 75034"
// without false-firing on words that happen to contain those letters mid-string.
const US_STATE_REGEX =
  /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)(\s|,|$|\d)/i;

function isUSPart(part: string): boolean {
  if (!part) return false;
  const lower = part.toLowerCase();

  // Reject explicit non-US country mentions immediately.
  if (NON_US_COUNTRY_PATTERNS.some((re) => re.test(lower))) return false;

  // Strong positive markers.
  if (lower.includes("united states")) return true;
  if (/\busa?\b/.test(lower)) return true; // matches "us", "usa"
  if (US_STATE_REGEX.test(part)) return true;

  // Default: not enough signal — reject.
  return false;
}

export function isUSLocation(loc: string | null | undefined): boolean {
  if (!loc) return false;
  // Multi-location postings (e.g. "Denver, CO, USA; Seattle, WA, United States")
  // pass if any entry is US.
  if (loc.includes(";")) {
    return loc.split(";").some((p) => isUSPart(p.trim()));
  }
  return isUSPart(loc.trim());
}
