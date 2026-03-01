import { Link } from "wouter";
import { Truck } from "lucide-react";
import { SiX, SiLinkedin, SiFacebook, SiInstagram, SiYoutube, SiTiktok } from "react-icons/si";
import { useSiteSettings } from "@/hooks/use-settings";

export function Footer() {
  const settings = useSiteSettings();

  const socialLinks = [
    { url: settings.socialTwitter, icon: SiX, label: "X / Twitter" },
    { url: settings.socialLinkedin, icon: SiLinkedin, label: "LinkedIn" },
    { url: settings.socialFacebook, icon: SiFacebook, label: "Facebook" },
    { url: settings.socialInstagram, icon: SiInstagram, label: "Instagram" },
    { url: settings.socialYoutube, icon: SiYoutube, label: "YouTube" },
    { url: settings.socialTiktok, icon: SiTiktok, label: "TikTok" },
  ].filter(s => s.url?.trim());

  return (
    <footer className="py-12 border-t border-white/10" style={{ backgroundColor: settings.footerBgColor || "#020617" }}>
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
                  <span className="font-display font-bold text-xl tracking-tight text-white">
                    {settings.siteName.includes("Jobs")
                      ? <>{settings.siteName.replace("Jobs", "")}<span className="text-primary">Jobs</span></>
                      : settings.siteName}
                  </span>
                </>
              )}
            </Link>
            <p className="text-sm text-slate-400 mb-6 max-w-xs">
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
                    className="text-slate-400 hover:text-white transition-colors"
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
            <h4 className="text-white font-semibold mb-4 font-display">Candidates</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/jobs" className="text-slate-400 hover:text-primary transition-colors">Browse Jobs</Link></li>
              <li><Link href="/register" className="text-slate-400 hover:text-primary transition-colors">Create Profile</Link></li>
              <li><Link href="/resources" className="text-slate-400 hover:text-primary transition-colors">Resource Center</Link></li>
              <li><Link href="/blog" className="text-slate-400 hover:text-primary transition-colors">Career Advice</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4 font-display">Employers</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/register" className="text-slate-400 hover:text-primary transition-colors">Post a Job</Link></li>
              <li><Link href="/pricing" className="text-slate-400 hover:text-primary transition-colors">Pricing</Link></li>
              <li><Link href="/resources" className="text-slate-400 hover:text-primary transition-colors">Employer Resources</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4 font-display">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="text-slate-400 hover:text-primary transition-colors">About Us</Link></li>
              <li><a href="https://mailgun-form-sender.replit.app" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-primary transition-colors">Contact</a></li>
              <li><Link href="/privacy" className="text-slate-400 hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-slate-400 hover:text-primary transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 text-sm text-slate-500 flex flex-col md:flex-row justify-between items-center">
          <p>{settings.footerCopyright}</p>
          <p className="mt-2 md:mt-0">Designed for the transportation sector.</p>
        </div>
      </div>
    </footer>
  );
}
