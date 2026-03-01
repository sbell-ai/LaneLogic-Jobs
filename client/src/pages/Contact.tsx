import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettings } from "@/hooks/use-settings";
import { apiRequest } from "@/lib/queryClient";
import { Mail, Send, MapPin, Phone, Loader2, CheckCircle2 } from "lucide-react";

export default function Contact() {
  const settings = useSiteSettings();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.subject || !form.message) {
      toast({ title: "Missing fields", description: "Please fill out all fields.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await apiRequest("POST", "/api/contact", form);
      const data = await res.json();
      if (data.success) {
        setSent(true);
        setForm({ name: "", email: "", subject: "", message: "" });
        toast({ title: "Message sent!", description: "We'll get back to you shortly." });
      } else {
        toast({ title: "Error", description: data.message || "Failed to send message.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <main className="flex-1">
        <div className="bg-gradient-to-b from-primary/5 to-transparent py-16">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <h1 className="text-4xl font-bold font-display mb-3" data-testid="text-contact-heading">
              Get in Touch
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-contact-subtitle">
              Have a question or need help? We'd love to hear from you. Fill out the form below and we'll get back to you as soon as possible.
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 pb-20 -mt-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-8 shadow-sm">
                {sent ? (
                  <div className="text-center py-12" data-testid="contact-success">
                    <CheckCircle2 className="mx-auto text-green-500 mb-4" size={48} />
                    <h2 className="text-2xl font-bold font-display mb-2">Message Sent!</h2>
                    <p className="text-muted-foreground mb-6">Thank you for reaching out. We'll respond within 1-2 business days.</p>
                    <Button onClick={() => setSent(false)} data-testid="button-send-another">
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Full Name</Label>
                        <Input
                          value={form.name}
                          onChange={e => update("name", e.target.value)}
                          placeholder="John Doe"
                          data-testid="input-contact-name"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Email Address</Label>
                        <Input
                          type="email"
                          value={form.email}
                          onChange={e => update("email", e.target.value)}
                          placeholder="john@example.com"
                          data-testid="input-contact-email"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-2 block">Subject</Label>
                      <Input
                        value={form.subject}
                        onChange={e => update("subject", e.target.value)}
                        placeholder="How can we help?"
                        data-testid="input-contact-subject"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-2 block">Message</Label>
                      <Textarea
                        value={form.message}
                        onChange={e => update("message", e.target.value)}
                        placeholder="Tell us more about your question or feedback..."
                        className="min-h-[160px] resize-none"
                        data-testid="textarea-contact-message"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={sending}
                      className="w-full sm:w-auto gap-2"
                      data-testid="button-contact-submit"
                    >
                      {sending ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Mail size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold font-display">Email Us</h3>
                    <p className="text-sm text-muted-foreground">We'll respond within 24 hours</p>
                  </div>
                </div>
                <a
                  href={`mailto:contact@${settings.siteName ? "lanelogicjobs.com" : "lanelogicjobs.com"}`}
                  className="text-primary hover:underline text-sm font-medium"
                  data-testid="link-contact-email"
                >
                  contact@lanelogicjobs.com
                </a>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <MapPin size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold font-display">Location</h3>
                    <p className="text-sm text-muted-foreground">Serving nationwide</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">United States</p>
              </div>

              <div className="bg-primary/5 rounded-2xl border border-primary/20 p-6">
                <h3 className="font-semibold font-display mb-2">Quick Response</h3>
                <p className="text-sm text-muted-foreground">
                  We aim to respond to all inquiries within 1-2 business days. For urgent matters, please include "URGENT" in your subject line.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
