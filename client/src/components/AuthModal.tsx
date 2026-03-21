import { createContext, useContext, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { X, UserRound, Briefcase, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettings } from "@/hooks/use-settings";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

type ModalMode = "login" | "signup" | "forgot";

type AuthModalContextType = {
  open: (mode?: ModalMode) => void;
  close: () => void;
  isOpen: boolean;
};

const AuthModalContext = createContext<AuthModalContextType>({
  open: () => {},
  close: () => {},
  isOpen: false,
});

export function useAuthModal() {
  return useContext(AuthModalContext);
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ModalMode>("login");

  const open = useCallback((m: ModalMode = "login") => {
    setMode(m);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <AuthModalContext.Provider value={{ open, close, isOpen }}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <AuthModal mode={mode} setMode={setMode} onClose={close} />
        )}
      </AnimatePresence>
    </AuthModalContext.Provider>
  );
}

function AuthModal({
  mode,
  setMode,
  onClose,
}: {
  mode: ModalMode;
  setMode: (m: ModalMode) => void;
  onClose: () => void;
}) {
  const settings = useSiteSettings();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        data-testid="modal-auth"
      >
        <div className="flex items-center justify-between p-6 pb-0">
          <div className="flex items-center gap-2">
            {mode === "forgot" && (
              <button
                onClick={() => setMode("login")}
                className="p-1 rounded-full hover:bg-muted transition-colors"
                data-testid="button-back-to-login"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="text-lg font-semibold" data-testid="text-auth-modal-title">
              {mode === "forgot" ? "Reset your password" : "Log in or sign up"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted transition-colors"
            data-testid="button-close-auth-modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {mode !== "forgot" && (
            <h3 className="text-2xl font-bold font-display mb-6" data-testid="text-auth-welcome">
              Welcome to {settings.siteName}
            </h3>
          )}

          {mode === "login" && (
            <LoginForm onClose={onClose} onSwitch={() => setMode("signup")} onForgot={() => setMode("forgot")} />
          )}
          {mode === "signup" && (
            <SignupForm onClose={onClose} onSwitch={() => setMode("login")} />
          )}
          {mode === "forgot" && (
            <ForgotPasswordForm onBack={() => setMode("login")} />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function LoginForm({ onClose, onSwitch, onForgot }: { onClose: () => void; onSwitch: () => void; onForgot: () => void }) {
  const { login, isLoggingIn } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      await login(data);
      onClose();
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Input
            type="email"
            placeholder="Email"
            className="h-12 rounded-xl text-base"
            {...form.register("email")}
            data-testid="input-modal-email"
          />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div>
          <Input
            type="password"
            placeholder="Password"
            className="h-12 rounded-xl text-base"
            {...form.register("password")}
            data-testid="input-modal-password"
          />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.password.message}</p>
          )}
          <button
            type="button"
            onClick={onForgot}
            className="mt-1.5 text-xs text-muted-foreground hover:text-primary hover:underline"
            data-testid="button-forgot-password"
          >
            Forgot your password?
          </button>
        </div>
        <Button
          type="submit"
          disabled={isLoggingIn}
          className="w-full h-12 rounded-xl text-base font-semibold"
          data-testid="button-modal-submit"
        >
          {isLoggingIn ? "Logging in..." : "Continue"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <button onClick={onSwitch} className="font-semibold text-primary hover:underline" data-testid="button-switch-to-signup">
          Sign up
        </button>
      </p>
    </>
  );
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email });
      setSent(true);
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl">📬</div>
        <p className="text-sm text-muted-foreground">
          If <span className="font-medium text-foreground">{email}</span> is registered, you'll receive a password reset link shortly. Check your inbox and spam folder.
        </p>
        <Button variant="outline" className="w-full rounded-xl" onClick={onBack} data-testid="button-back-to-login-from-sent">
          Back to log in
        </Button>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-muted-foreground mb-5">
        Enter your email and we'll send you a link to reset your password.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="Email address"
          className="h-12 rounded-xl text-base"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          data-testid="input-forgot-email"
        />
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl text-base font-semibold"
          data-testid="button-send-reset"
        >
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>
    </>
  );
}

function SignupForm({ onClose, onSwitch }: { onClose: () => void; onSwitch: () => void }) {
  const { register: registerUser, isRegistering } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const form = useForm<z.infer<typeof insertUserSchema>>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "job_seeker",
      firstName: "",
      lastName: "",
      companyName: "",
      membershipTier: "free",
    },
  });

  const role = form.watch("role");

  const onSubmit = async (data: z.infer<typeof insertUserSchema>) => {
    try {
      await registerUser(data);
      onClose();
      navigate("/dashboard");
      toast({
        title: "Account created!",
        description: "Check your email for a verification link to confirm your address.",
      });
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label className="text-sm font-semibold mb-2 block">I want to...</Label>
          <RadioGroup
            defaultValue="job_seeker"
            onValueChange={(val) => form.setValue("role", val)}
            className="grid grid-cols-2 gap-3"
          >
            <div className={`relative flex items-center border-2 rounded-xl p-3 cursor-pointer transition-all ${role === 'job_seeker' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
              <RadioGroupItem value="job_seeker" id="modal_job_seeker" className="sr-only" />
              <Label htmlFor="modal_job_seeker" className="flex flex-col cursor-pointer w-full">
                <UserRound className={`mb-1 w-5 h-5 ${role === 'job_seeker' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="font-semibold text-sm">Find a Job</span>
              </Label>
            </div>
            <div className={`relative flex items-center border-2 rounded-xl p-3 cursor-pointer transition-all ${role === 'employer' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
              <RadioGroupItem value="employer" id="modal_employer" className="sr-only" />
              <Label htmlFor="modal_employer" className="flex flex-col cursor-pointer w-full">
                <Briefcase className={`mb-1 w-5 h-5 ${role === 'employer' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="font-semibold text-sm">Hire Talent</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder="First name"
            className="h-12 rounded-xl text-base"
            {...form.register("firstName")}
            data-testid="input-modal-firstname"
          />
          <Input
            placeholder="Last name"
            className="h-12 rounded-xl text-base"
            {...form.register("lastName")}
            data-testid="input-modal-lastname"
          />
        </div>

        {role === "employer" && (
          <Input
            placeholder="Company name"
            className="h-12 rounded-xl text-base"
            {...form.register("companyName")}
            data-testid="input-modal-company"
          />
        )}

        <Input
          type="email"
          placeholder="Email"
          className="h-12 rounded-xl text-base"
          {...form.register("email")}
          data-testid="input-modal-email"
        />
        <div>
          <Input
            type="password"
            placeholder="Password"
            className="h-12 rounded-xl text-base"
            {...form.register("password")}
            data-testid="input-modal-password"
          />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isRegistering}
          className="w-full h-12 rounded-xl text-base font-semibold"
          data-testid="button-modal-submit"
        >
          {isRegistering ? "Creating account..." : "Continue"}
        </Button>
      </form>

      <p className="mt-4 text-xs text-center text-muted-foreground">
        By creating an account, you agree to our Terms and Conditions and Privacy Policy.
      </p>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <button onClick={onSwitch} className="font-semibold text-primary hover:underline" data-testid="button-switch-to-login">
          Log in
        </button>
      </p>
    </>
  );
}
