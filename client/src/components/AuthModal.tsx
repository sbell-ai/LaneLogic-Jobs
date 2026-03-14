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
import { X, UserRound, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettings } from "@/hooks/use-settings";
import { motion, AnimatePresence } from "framer-motion";

type AuthModalContextType = {
  open: (mode?: "login" | "signup") => void;
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
  const [mode, setMode] = useState<"login" | "signup">("login");

  const open = useCallback((m: "login" | "signup" = "login") => {
    setMode(m);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  return (
    <AuthModalContext.Provider value={{ open, close, isOpen }}>
      {children}
      <AnimatePresence>
        {isOpen && <AuthModalContent mode={mode} setMode={setMode} onClose={close} />}
      </AnimatePresence>
    </AuthModalContext.Provider>
  );
}

function AuthModalContent({
  mode,
  setMode,
  onClose,
}: {
  mode: "login" | "signup";
  setMode: (m: "login" | "signup") => void;
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
          <h2 className="text-lg font-semibold" data-testid="text-auth-modal-title">
            Log in or sign up
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted transition-colors"
            data-testid="button-close-auth-modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <h3 className="text-2xl font-bold font-display mb-6" data-testid="text-auth-welcome">
            Welcome to {settings.siteName}
          </h3>

          {mode === "login" ? (
            <LoginForm onClose={onClose} onSwitch={() => setMode("signup")} />
          ) : (
            <SignupForm onClose={onClose} onSwitch={() => setMode("login")} />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function LoginForm({ onClose, onSwitch }: { onClose: () => void; onSwitch: () => void }) {
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
