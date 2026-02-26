import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@shared/schema";
import { z } from "zod";
import { Truck, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettings } from "@/hooks/use-settings";

export default function Login() {
  const { login, isLoggingIn } = useAuth();
  const { toast } = useToast();
  const settings = useSiteSettings();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      await login(data);
      window.location.href = "/dashboard";
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex font-sans">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24 bg-background">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-8 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
          </Link>
          
          <div className="mb-8 text-center sm:text-left">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              {settings.logoBase64 ? (
                <img src={settings.logoBase64} alt={settings.siteName} className={`w-auto object-contain ${
                  settings.logoSize === "small" ? "h-9" :
                  settings.logoSize === "large" ? "h-16" :
                  "h-12"
                }`} data-testid="img-login-logo" />
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
                    <Truck size={20} strokeWidth={2.5} />
                  </div>
                  <span className="font-display font-bold text-2xl tracking-tight text-foreground" data-testid="text-login-brand">
                    {settings.siteName}
                  </span>
                </>
              )}
            </Link>
            <h2 className="text-3xl font-bold font-display text-foreground mb-2" data-testid="text-login-heading">{settings.loginHeading}</h2>
            <p className="text-muted-foreground text-lg" data-testid="text-login-subtitle">{settings.loginSubtitle}</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Email address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="name@example.com"
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 px-4 focus-visible:ring-primary"
                {...form.register("email")} 
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
                <a href="#" className="text-sm text-primary font-medium hover:underline">Forgot password?</a>
              </div>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••"
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 px-4 focus-visible:ring-primary"
                {...form.register("password")} 
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              disabled={isLoggingIn} 
              className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20 hover-elevate"
            >
              {isLoggingIn ? "Logging in..." : "Log in"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:block relative flex-1">
        {/* landing page hero scenic mountain landscape */}
        <img 
          src={settings.loginBackgroundImage} 
          alt="Semi truck on highway" 
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent flex flex-col justify-end p-12">
          <blockquote className="text-white max-w-lg mb-6" data-testid="text-login-testimonial">
            <p className="text-2xl font-medium font-display leading-tight mb-4">"{settings.loginTestimonial}"</p>
            <footer className="text-slate-300 font-medium" data-testid="text-login-testimonial-author">
              {settings.loginTestimonialAuthor}
            </footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
