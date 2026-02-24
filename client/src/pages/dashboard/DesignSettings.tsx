import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Palette, Type, ImageIcon, Eye, EyeOff, Save, RotateCcw, CheckCircle2, Globe, Megaphone } from "lucide-react";
import type { SiteSettingsData } from "@shared/schema";
import { DEFAULT_SETTINGS } from "@shared/schema";
import { applySettingsToDOM, hexToHsl } from "@/hooks/use-settings";

const HEADING_FONTS = [
  "Plus Jakarta Sans", "Montserrat", "Poppins", "Raleway",
  "Oswald", "Playfair Display", "DM Sans", "Nunito",
];
const BODY_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato",
  "Nunito", "Source Sans 3", "DM Sans", "Mulish",
];

function ColorSwatch({ color }: { color: string }) {
  return (
    <div
      className="w-8 h-8 rounded-lg border border-gray-300 shrink-0 shadow-sm"
      style={{ backgroundColor: color }}
    />
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon size={18} className="text-primary" />
        </div>
        <h3 className="font-bold font-display text-lg">{title}</h3>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

export default function DesignSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: saved, isLoading } = useQuery<SiteSettingsData>({ queryKey: ["/api/settings"] });
  const [livePreview, setLivePreview] = useState(true);
  const [draft, setDraft] = useState<SiteSettingsData>(DEFAULT_SETTINGS);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (saved) {
      setDraft({ ...DEFAULT_SETTINGS, ...saved });
      setLogoPreview(saved.logoBase64 || null);
    }
  }, [saved]);

  useEffect(() => {
    if (livePreview) {
      applySettingsToDOM(draft);
    }
  }, [draft, livePreview]);

  const updateMutation = useMutation({
    mutationFn: (settings: SiteSettingsData) =>
      apiRequest("PUT", "/api/settings", settings).then(r => r.json()),
    onSuccess: (data: SiteSettingsData) => {
      queryClient.setQueryData(["/api/settings"], data);
      applySettingsToDOM(data);
      toast({ title: "Design settings saved!", description: "Changes are now live across the site." });
    },
    onError: () => toast({ title: "Error", description: "Could not save settings.", variant: "destructive" }),
  });

  const update = (key: keyof SiteSettingsData, value: string | null) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast({ title: "File too large", description: "Please use an image under 500KB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setLogoPreview(base64);
      update("logoBase64", base64);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const resetToDefaults = () => {
    setDraft({ ...DEFAULT_SETTINGS });
    setLogoPreview(null);
    if (livePreview) applySettingsToDOM(DEFAULT_SETTINGS);
    toast({ title: "Reset to defaults" });
  };

  if (isLoading) return (
    <DashboardLayout>
      <div className="animate-pulse space-y-4 max-w-2xl mx-auto">
        {[1, 2, 3].map(i => <div key={i} className="h-48 bg-slate-100 rounded-2xl" />)}
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold font-display">Design Settings</h2>
            <p className="text-muted-foreground text-sm mt-1">Customize your site's look and feel globally.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2">
              {livePreview ? <Eye size={15} className="text-primary" /> : <EyeOff size={15} className="text-muted-foreground" />}
              <span className="text-sm font-medium">Live Preview</span>
              <Switch
                checked={livePreview}
                onCheckedChange={setLivePreview}
                data-testid="switch-live-preview"
              />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {/* Brand Colors */}
          <Section icon={Palette} title="Brand Colors">
            <div>
              <Label className="text-sm font-semibold mb-3 block">Primary Color</Label>
              <p className="text-xs text-muted-foreground mb-3">Used for buttons, active nav items, links, and key UI elements.</p>
              <div className="flex items-center gap-3">
                <ColorSwatch color={draft.primaryColor} />
                <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 flex-1">
                  <input
                    type="color"
                    value={draft.primaryColor}
                    onChange={e => update("primaryColor", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                    data-testid="input-primary-color"
                  />
                  <Input
                    value={draft.primaryColor}
                    onChange={e => update("primaryColor", e.target.value)}
                    className="border-0 shadow-none p-0 h-auto font-mono text-sm focus-visible:ring-0"
                    data-testid="input-primary-color-hex"
                  />
                </div>
                <div className="text-xs text-muted-foreground font-mono bg-slate-50 border border-border rounded px-2 py-1 whitespace-nowrap">
                  {hexToHsl(draft.primaryColor)}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-3 block">Secondary / Accent Color</Label>
              <p className="text-xs text-muted-foreground mb-3">Used for badges, highlights, and accent elements.</p>
              <div className="flex items-center gap-3">
                <ColorSwatch color={draft.secondaryColor} />
                <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 flex-1">
                  <input
                    type="color"
                    value={draft.secondaryColor}
                    onChange={e => update("secondaryColor", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                    data-testid="input-secondary-color"
                  />
                  <Input
                    value={draft.secondaryColor}
                    onChange={e => update("secondaryColor", e.target.value)}
                    className="border-0 shadow-none p-0 h-auto font-mono text-sm focus-visible:ring-0"
                    data-testid="input-secondary-color-hex"
                  />
                </div>
                <div className="text-xs text-muted-foreground font-mono bg-slate-50 border border-border rounded px-2 py-1 whitespace-nowrap">
                  {hexToHsl(draft.secondaryColor)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="text-center p-3 rounded-xl border border-border" style={{ backgroundColor: draft.primaryColor }}>
                <span className="text-white text-sm font-semibold">Primary Button</span>
              </div>
              <div className="text-center p-3 rounded-xl border" style={{ borderColor: draft.secondaryColor }}>
                <span className="text-sm font-semibold" style={{ color: draft.secondaryColor }}>Accent Badge</span>
              </div>
            </div>
          </Section>

          {/* Typography */}
          <Section icon={Type} title="Typography">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Heading Font</Label>
              <p className="text-xs text-muted-foreground mb-3">Used for page titles, section headings, and the site logo.</p>
              <Select value={draft.headingFont} onValueChange={v => update("headingFont", v)}>
                <SelectTrigger data-testid="select-heading-font">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEADING_FONTS.map(f => (
                    <SelectItem key={f} value={f}>
                      <span style={{ fontFamily: `'${f}', sans-serif` }}>{f}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div
                className="mt-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-border"
                style={{ fontFamily: `'${draft.headingFont}', sans-serif` }}
              >
                <p className="text-2xl font-bold">Transportation Jobs</p>
                <p className="text-lg font-semibold text-muted-foreground mt-1">Find Your Next Career Move</p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">Body Font</Label>
              <p className="text-xs text-muted-foreground mb-3">Used for paragraphs, labels, and all general text.</p>
              <Select value={draft.bodyFont} onValueChange={v => update("bodyFont", v)}>
                <SelectTrigger data-testid="select-body-font">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BODY_FONTS.map(f => (
                    <SelectItem key={f} value={f}>
                      <span style={{ fontFamily: `'${f}', sans-serif` }}>{f}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div
                className="mt-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-border text-sm"
                style={{ fontFamily: `'${draft.bodyFont}', sans-serif` }}
              >
                <p>Browse thousands of transportation, logistics, and trucking jobs. Apply directly or connect with employers looking for your exact skill set.</p>
              </div>
            </div>
          </Section>

          {/* Logo */}
          <Section icon={ImageIcon} title="Site Logo">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a custom logo to replace the text logo in the navigation. Recommended: PNG or SVG under 500KB, ideally with transparent background.
              </p>

              <div className="flex items-start gap-4">
                <div className="w-48 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-slate-50 dark:bg-slate-800 overflow-hidden shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain p-2" />
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="mx-auto text-muted-foreground mb-1" size={24} />
                      <p className="text-xs text-muted-foreground">No logo</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2 flex-1">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    data-testid="input-logo-upload"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileRef.current?.click()}
                    data-testid="button-upload-logo"
                  >
                    <ImageIcon size={15} className="mr-2" />
                    {logoPreview ? "Change Logo" : "Upload Logo"}
                  </Button>
                  {logoPreview && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={() => { setLogoPreview(null); update("logoBase64", null); }}
                      data-testid="button-remove-logo"
                    >
                      Remove Logo
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">PNG, JPG, SVG · Max 500KB</p>
                </div>
              </div>

              {logoPreview && (
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Navbar Preview</p>
                  <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-border">
                    <img src={logoPreview} alt="Nav logo" className="h-8 object-contain" />
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Site Content */}
          <Section icon={Globe} title="Site Content">
            <div className="grid grid-cols-1 gap-5">
              <div>
                <Label className="text-sm font-semibold mb-1 block">Site Name</Label>
                <p className="text-xs text-muted-foreground mb-2">Appears in the navbar logo, footer, and browser bookmarks.</p>
                <Input
                  value={draft.siteName}
                  onChange={e => update("siteName", e.target.value)}
                  placeholder="TranspoJobs"
                  data-testid="input-site-name"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold mb-1 block">Page / SEO Title</Label>
                <p className="text-xs text-muted-foreground mb-2">Shown in the browser tab and search engine results.</p>
                <Input
                  value={draft.siteTitle}
                  onChange={e => update("siteTitle", e.target.value)}
                  placeholder="TranspoJobs – Transportation & Logistics Jobs"
                  data-testid="input-site-title"
                />
                <p className="text-xs text-muted-foreground mt-1">{draft.siteTitle.length} / 70 characters recommended</p>
              </div>

              <div>
                <Label className="text-sm font-semibold mb-1 block">Site Description</Label>
                <p className="text-xs text-muted-foreground mb-2">Meta description used by search engines and social media previews.</p>
                <Textarea
                  value={draft.siteDescription}
                  onChange={e => update("siteDescription", e.target.value)}
                  placeholder="Find the best transportation and logistics jobs..."
                  className="min-h-[80px] resize-none"
                  data-testid="textarea-site-description"
                />
                <p className="text-xs text-muted-foreground mt-1">{draft.siteDescription.length} / 160 characters recommended</p>
              </div>
            </div>
          </Section>

          {/* Header & Footer */}
          <Section icon={Megaphone} title="Header & Footer">
            <div>
              <Label className="text-sm font-semibold mb-1 block">Header Announcement Banner</Label>
              <p className="text-xs text-muted-foreground mb-2">Optional text shown in a banner at the very top of every page. Leave empty to hide.</p>
              <Input
                value={draft.headerAnnouncement}
                onChange={e => update("headerAnnouncement", e.target.value)}
                placeholder="e.g. Now hiring nationwide — browse open roles →"
                data-testid="input-header-announcement"
              />
              {draft.headerAnnouncement && (
                <div className="mt-3 rounded-lg overflow-hidden border border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-2 pb-1">Preview</p>
                  <div className="px-4 py-2 text-sm font-medium text-center text-white" style={{ backgroundColor: draft.primaryColor }}>
                    {draft.headerAnnouncement}
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm font-semibold mb-1 block">Footer Tagline</Label>
              <p className="text-xs text-muted-foreground mb-2">The description paragraph shown in the footer's brand column.</p>
              <Textarea
                value={draft.footerTagline}
                onChange={e => update("footerTagline", e.target.value)}
                placeholder="The premier destination for transportation professionals..."
                className="min-h-[80px] resize-none"
                data-testid="textarea-footer-tagline"
              />
            </div>

            <div>
              <Label className="text-sm font-semibold mb-1 block">Footer Copyright</Label>
              <p className="text-xs text-muted-foreground mb-2">Copyright notice shown at the very bottom of the footer.</p>
              <Input
                value={draft.footerCopyright}
                onChange={e => update("footerCopyright", e.target.value)}
                placeholder="© TranspoJobs. All rights reserved."
                data-testid="input-footer-copyright"
              />
            </div>
          </Section>

          {/* Actions */}
          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-border">
            <Button
              variant="outline"
              onClick={resetToDefaults}
              data-testid="button-reset-defaults"
              className="text-muted-foreground"
            >
              <RotateCcw size={15} className="mr-2" />
              Reset to Defaults
            </Button>
            <Button
              onClick={() => updateMutation.mutate(draft)}
              disabled={updateMutation.isPending}
              data-testid="button-save-settings"
              className="gap-2"
            >
              {updateMutation.isPending ? (
                <><span className="animate-spin">⟳</span> Saving...</>
              ) : (
                <><Save size={15} /> Save Changes</>
              )}
            </Button>
          </div>

          {updateMutation.isSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
              <CheckCircle2 className="text-green-600 shrink-0" size={18} />
              <p className="text-sm text-green-800 dark:text-green-400 font-medium">
                Settings saved and applied globally.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
