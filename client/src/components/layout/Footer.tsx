import { Link } from "wouter";
import { Truck } from "lucide-react";
import { SiX, SiLinkedin, SiFacebook, SiInstagram, SiYoutube, SiTiktok } from "react-icons/si";
import { useSiteSettings } from "@/hooks/use-settings";
import { normalizeHex } from "@shared/colorUtils";

export function Footer() {
  const settings = useSiteSettings();

  const bgColor = normalizeHex(settings.footerBgColor || "#0b1220") || "#0b1220";
  const bgOpacity = settings.footerBgOpacity ?? 1;
  const textColor = normalizeHex(settings.footerTextColor || "#e5e7eb") || "#e5e7eb";
  const linkColor = normalizeHex(settings.footerLinkColor || "#93c5fd") || "#93c5fd";
  const linkHoverColor = normalizeHex(settings.footerLinkHoverColor || "#bfdbfe") || "#bfdbfe";

  const hexToRgba = (hex: string, alpha: number = 1) => {
    const n = normalizeHex(hex);
    if (!n) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(n.slice(1, 3), 16);
    const g = parseInt(n.slice(3, 5), 16);
    const b = parseInt(n.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const footerStyle = {
    "--footer-text": textColor,
    "--footer-link": linkColor,
    "--footer-link-hover": linkHoverColor,
    backgroundColor: hexToRgba(bgColor, bgOpacity),
  } as React.CSSProperties;

  const socialLinks = [
    { url: settings.socialTwitter, icon: SiX, label: "X / Twitter" },
    { url: settings.socialLinkedin, icon: SiLinkedin, label: "LinkedIn" },
    { url: settings.socialFacebook, icon: SiFacebook, label: "Facebook" },
    { url: settings.socialInstagram, icon: SiInstagram, label: "Instagram" },
    { url: settings.socialYoutube, icon: SiYoutube, label: "YouTube" },
    { url: settings.socialTiktok, icon: SiTiktok, label: "TikTok" },
  ].filter(s => s.url?.trim());

  return (
    <footer
      className="py-12 border-t border-white/10"
      style={footerStyle}
      data-testid="footer"
    >
      <style>{`
        [data-testid="footer"] .ftl {
          color: var(--footer-link);
          transition: color 150ms;
        }
        [data-testid="footer"] .ftl:hover,
        [data-testid="footer"] .ftl:focus-visible {
          color: var(--footer-link-hover);
        }
      `}</style>
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4 group">
              {settings.logoBase64 ? (
                <img src={settings.logoBase64} alt={settings.siteName} className={`object-contain ${
                  settings.logoSize === "small" ? "h-8" :
                  settings.logoSize === "large" ? "h-16" :
                  settings.logoSize === "x-large" ? "h-20" :
                  "h-12"
                }`} />
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
                    <Truck size={16} strokeWidth={2.5} />
                  </div>
                  <span className="font-display font-bold text-xl tracking-tight" style={{ color: "var(--footer-text)" }}>
                    {settings.siteName.includes("Jobs")
                      ? <>{settings.siteName.replace("Jobs", "")}<span className="text-primary">Jobs</span></>
                      : settings.siteName}
                  </span>
                </>
              )}
            </Link>
            <p className="text-sm mb-6 max-w-xs" style={{ color: "var(--footer-text)" }}>
              {settings.footerTagline}
            </p>
            {socialLinks.length > 0 && (
              <div className="flex gap-4" data-testid="footer-social-links">
                {socialLinks.map(({ url, icon: Icon, label }) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ftl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                    aria-label={label}
                    data-testid={`link-social-${label.toLowerCase().replace(/[\s\/]/g, "-")}`}
                  >
                    <Icon size={20} />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-semibold mb-4 font-display" style={{ color: "var(--footer-text)" }}>Candidates</h4>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/jobs", text: "Browse Jobs" },
                { href: "/register", text: "Create Profile" },
                { href: "/resources", text: "Resource Center" },
                { href: "/blog", text: "Career Advice" },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="ftl focus-visible:underline focus-visible:outline-none">
                    {l.text}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 font-display" style={{ color: "var(--footer-text)" }}>Employers</h4>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/register", text: "Post a Job" },
                { href: "/pricing", text: "Pricing" },
                { href: "/resources", text: "Employer Resources" },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="ftl focus-visible:underline focus-visible:outline-none">
                    {l.text}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 font-display" style={{ color: "var(--footer-text)" }}>Company</h4>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/about", text: "About Us", external: false },
                { href: "https://mailgun-form-sender.replit.app", text: "Contact", external: true },
                { href: "/privacy", text: "Privacy Policy", external: false },
                { href: "/terms", text: "Terms of Service", external: false },
              ].map(l => (
                <li key={l.href}>
                  {l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ftl focus-visible:underline focus-visible:outline-none"
                    >
                      {l.text}
                    </a>
                  ) : (
                    <Link href={l.href} className="ftl focus-visible:underline focus-visible:outline-none">
                      {l.text}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 text-sm flex flex-col md:flex-row justify-between items-center" style={{ color: "var(--footer-text)", opacity: 0.7 }}>
          <p>{settings.footerCopyright}</p>
          <p className="mt-2 md:mt-0">Designed for the transportation sector.</p>
        </div>
      </div>
    </footer>
  );
}
