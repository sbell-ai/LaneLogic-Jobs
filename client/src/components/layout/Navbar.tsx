import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useSiteSettings } from "@/hooks/use-settings";
import { Truck, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const settings = useSiteSettings();

  const navLinks = [
    { name: "Jobs", path: "/jobs" },
    { name: "Employers", path: "/employers" },
    { name: "Resources", path: "/resources" },
    { name: "Blog", path: "/blog" },
    { name: "Pricing", path: "/pricing" },
  ];

  return (
    <header>
      {settings.headerAnnouncement?.trim() && (
        <div className="w-full bg-primary text-primary-foreground text-center text-sm font-medium py-2 px-4">
          {settings.headerAnnouncementLink?.trim() ? (
            <Link href={settings.headerAnnouncementLink} className="hover:underline" data-testid="link-header-announcement">
              {settings.headerAnnouncement}
            </Link>
          ) : (
            <span data-testid="text-header-announcement">{settings.headerAnnouncement}</span>
          )}
        </div>
      )}
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            {settings.logoBase64 ? (
              <img src={settings.logoBase64} alt={settings.siteName} className="h-9 object-contain" />
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground group-hover:scale-105 transition-transform duration-200">
                  <Truck size={20} strokeWidth={2.5} />
                </div>
                <span className="font-display font-bold text-xl tracking-tight text-foreground">
                  {settings.siteName.includes("Jobs")
                    ? <>{settings.siteName.replace("Jobs", "")}<span className="text-primary">Jobs</span></>
                    : settings.siteName}
                </span>
              </>
            )}
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-6 text-sm font-medium">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  className={`transition-colors hover:text-primary ${location === link.path ? "text-primary" : "text-muted-foreground"}`}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            <div className="h-6 w-px bg-border mx-2"></div>

            {user ? (
              <div className="flex items-center gap-4">
                <Link href="/dashboard" className="text-sm font-semibold hover:text-primary transition-colors">
                  Dashboard
                </Link>
                <Button variant="outline" size="sm" onClick={() => logout()} className="hover-elevate">
                  Log out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login" className="text-sm font-semibold hover:text-primary transition-colors">
                  Log in
                </Link>
                <Button asChild size="sm" className="hover-elevate bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <Link href="/register">Post a Job</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden text-foreground p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-background border-b border-border px-4 py-4 space-y-4"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  className="block py-2 text-base font-medium text-foreground hover:text-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              <div className="pt-4 border-t border-border flex flex-col gap-3">
                {user ? (
                  <>
                    <Link href="/dashboard" className="block py-2 font-medium" onClick={() => setMobileMenuOpen(false)}>
                      Dashboard
                    </Link>
                    <Button variant="outline" className="w-full" onClick={() => { logout(); setMobileMenuOpen(false); }}>
                      Log out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="outline" className="w-full" onClick={() => setMobileMenuOpen(false)}>
                      <Link href="/login">Log in</Link>
                    </Button>
                    <Button asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                      <Link href="/register">Sign up</Link>
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
