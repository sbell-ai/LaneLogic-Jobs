import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { Truck, ArrowLeft, Briefcase, UserRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const { register, isRegistering } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof insertUserSchema>>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { 
      email: "", 
      password: "", 
      role: "job_seeker",
      firstName: "",
      lastName: "",
      companyName: "",
      membershipTier: "free"
    },
  });

  const role = form.watch("role");

  const onSubmit = async (data: z.infer<typeof insertUserSchema>) => {
    try {
      await register(data);
      window.location.href = "/dashboard";
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex font-sans">
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 py-12 bg-background overflow-y-auto">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-8 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
          </Link>
          
          <div className="mb-8 text-center sm:text-left">
            <h2 className="text-3xl font-bold font-display text-foreground mb-2">Create an account</h2>
            <p className="text-muted-foreground text-lg">Join TranspoJobs to take the next step.</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">I want to...</Label>
              <RadioGroup 
                defaultValue="job_seeker" 
                onValueChange={(val) => form.setValue("role", val)}
                className="grid grid-cols-2 gap-4"
              >
                <div className={`relative flex items-center border-2 rounded-xl p-4 cursor-pointer transition-all ${role === 'job_seeker' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                  <RadioGroupItem value="job_seeker" id="job_seeker" className="sr-only" />
                  <Label htmlFor="job_seeker" className="flex flex-col cursor-pointer w-full">
                    <UserRound className={`mb-2 w-6 h-6 ${role === 'job_seeker' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="font-semibold block">Find a Job</span>
                    <span className="text-xs text-muted-foreground font-normal mt-1">I'm looking for work</span>
                  </Label>
                </div>
                <div className={`relative flex items-center border-2 rounded-xl p-4 cursor-pointer transition-all ${role === 'employer' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                  <RadioGroupItem value="employer" id="employer" className="sr-only" />
                  <Label htmlFor="employer" className="flex flex-col cursor-pointer w-full">
                    <Briefcase className={`mb-2 w-6 h-6 ${role === 'employer' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="font-semibold block">Hire Talent</span>
                    <span className="text-xs text-muted-foreground font-normal mt-1">I'm an employer</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-semibold">First name</Label>
                <Input 
                  id="firstName" 
                  className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  {...form.register("firstName")} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-semibold">Last name</Label>
                <Input 
                  id="lastName" 
                  className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  {...form.register("lastName")} 
                />
              </div>
            </div>

            {role === "employer" && (
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-sm font-semibold">Company Name</Label>
                <Input 
                  id="companyName" 
                  className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  {...form.register("companyName")} 
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Email address</Label>
              <Input 
                id="email" 
                type="email" 
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                {...form.register("email")} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <Input 
                id="password" 
                type="password" 
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                {...form.register("password")} 
              />
            </div>

            <Button 
              type="submit" 
              disabled={isRegistering} 
              className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20 hover-elevate"
            >
              {isRegistering ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:block relative flex-1 bg-slate-900">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        <div className="h-full flex flex-col justify-center items-center p-12 text-center relative z-10">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-white mb-8 shadow-2xl shadow-primary/50">
            <Truck size={40} strokeWidth={2} />
          </div>
          <h2 className="text-4xl font-bold font-display text-white mb-6">Join the Network</h2>
          <p className="text-xl text-slate-300 max-w-md text-balance">
            TranspoJobs connects the best drivers, dispatchers, and managers with top-tier logistics companies.
          </p>
        </div>
      </div>
    </div>
  );
}
