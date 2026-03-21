import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CheckCircle2, XCircle } from "lucide-react";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    if (!token) setError("Missing reset token. Please request a new password reset link.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, password });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "This reset link is invalid or has expired. Please request a new one.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          {done ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <h1 className="text-2xl font-bold">Password updated!</h1>
              <p className="text-sm text-muted-foreground">
                Your password has been changed. You can now log in with your new password.
              </p>
              <Button
                className="w-full rounded-xl h-12"
                onClick={() => navigate("/")}
                data-testid="button-go-to-login"
              >
                Go to home
              </Button>
            </div>
          ) : !token ? (
            <div className="text-center space-y-4">
              <XCircle className="w-12 h-12 text-destructive mx-auto" />
              <h1 className="text-2xl font-bold">Invalid link</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" className="w-full rounded-xl h-12" onClick={() => navigate("/")}>
                Back to home
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-2">Set a new password</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Choose a strong password of at least 8 characters.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl text-base"
                  required
                  data-testid="input-new-password"
                />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-12 rounded-xl text-base"
                  required
                  data-testid="input-confirm-password"
                />
                {error && (
                  <p className="text-sm text-destructive" data-testid="text-reset-error">{error}</p>
                )}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl text-base font-semibold"
                  data-testid="button-reset-submit"
                >
                  {loading ? "Updating..." : "Update password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
