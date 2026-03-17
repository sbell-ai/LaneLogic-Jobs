import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useSiteSettings } from "@/hooks/use-settings";
import { useAuthModal } from "@/components/AuthModal";
import { Truck, Search, Menu, Briefcase, BookOpen, FileText, CreditCard, LayoutDashboard, LogIn, LogOut, UserPlus, GraduationCap } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { open: openAuth } = useAuthModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const settings = useSiteSettings();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/jobs?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    } else {
      navigate("/jobs");
    }
  };

  const menuLinks = [
    { name: "Jobs", path: "/jobs", icon: Search },
    { name: "Employers", path: "/employers", icon: Briefcase },
    { name: "Resources", path: "/resources", icon: BookOpen },
    { name: "Blog", path: "/blog", icon: FileText },
    { name: "Pricing", path: "/pricing", icon: CreditCard },
    { name: "User Guides", path: "/guides", icon: GraduationCap },
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
        <div className="w-full px-4 md:px-8 min-h-16 py-2 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            {settings.logoBase64 ? (
              <img src={settings.logoBase64} alt={settings.siteName} className={`object-contain ${
                settings.logoSize === "small" ? "h-10" :
                settings.logoSize === "large" ? "h-20" :
                settings.logoSize === "x-large" ? "h-24" :
                "h-14"
              }`} data-testid="img-logo" />
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground group-hover:scale-105 transition-transform duration-200">
                  <Truck size={20} strokeWidth={2.5} />
                </div>
                <span className="font-display font-bold text-xl tracking-tight text-foreground hidden sm:inline">
                  {settings.siteName.includes("Jobs")
                    ? <>{settings.siteName.replace("Jobs", "")}<span className="text-primary">Jobs</span></>
                    : settings.siteName}
                </span>
              </>
            )}
          </Link>

          <form onSubmit={handleSearch} className="flex-1 max-w-xl" data-testid="form-header-search">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-full border border-border bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                data-testid="input-header-search"
              />
            </div>
          </form>

          <div className="relative shrink-0 ml-auto">
            <div className="flex items-center gap-5">
              {!user && (
                <button onClick={() => openAuth("login")} className="hidden md:inline-flex text-sm font-semibold hover:text-primary transition-colors" data-testid="link-header-login">
                  Log in
                </button>
              )}
              <Button size="sm" className="hidden sm:inline-flex hover-elevate bg-primary text-primary-foreground shadow-lg shadow-primary/20" onClick={() => user ? navigate("/dashboard") : openAuth("signup")} data-testid="button-header-post-job">
                Post a Job
              </Button>
              <button
                ref={buttonRef}
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 p-2 rounded-full border border-border hover:shadow-md transition-all bg-background"
                data-testid="button-header-menu"
              >
                <Menu size={18} />
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${user ? 'bg-primary/10 text-primary' : 'bg-orange-500'}`}>
                  {user ? (user.fullName?.charAt(0) || user.email?.charAt(0) || "U").toUpperCase() : ""}
                </div>
              </button>
            </div>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-background rounded-xl border border-border shadow-xl py-2 z-50"
                  data-testid="menu-header-dropdown"
                >
                  {user ? (
                    <>
                      <div className="px-4 py-2 border-b border-border mb-1">
                        <p className="text-sm font-semibold truncate" data-testid="text-menu-username">{user.fullName || user.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <Link
                        href="/dashboard"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                        onClick={() => setMenuOpen(false)}
                        data-testid="link-menu-dashboard"
                      >
                        <LayoutDashboard size={16} className="text-muted-foreground" /> Dashboard
                      </Link>
                    </>
                  ) : (
                    <>
                      <button
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors w-full text-left"
                        onClick={() => { setMenuOpen(false); openAuth("signup"); }}
                        data-testid="link-menu-signup"
                      >
                        <UserPlus size={16} className="text-muted-foreground" /> Sign up
                      </button>
                      <button
                        className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors w-full text-left"
                        onClick={() => { setMenuOpen(false); openAuth("login"); }}
                        data-testid="link-menu-login"
                      >
                        <LogIn size={16} className="text-muted-foreground" /> Log in
                      </button>
                    </>
                  )}

                  <div className="border-t border-border my-1" />

                  {menuLinks.map((link) => (
                    <Link
                      key={link.path}
                      href={link.path}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors ${location === link.path ? "text-primary font-medium" : ""}`}
                      onClick={() => setMenuOpen(false)}
                      data-testid={`link-menu-${link.name.toLowerCase()}`}
                    >
                      <link.icon size={16} className="text-muted-foreground" /> {link.name}
                    </Link>
                  ))}

                  {user && (
                    <>
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => { logout(); setMenuOpen(false); }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors w-full text-left text-red-500"
                        data-testid="button-menu-logout"
                      >
                        <LogOut size={16} /> Log out
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>
    </header>
  );
}
