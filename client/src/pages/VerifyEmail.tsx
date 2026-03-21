import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

type State = "loading" | "success" | "error";

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");

  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("No verification token found. Please use the link from your email.");
      return;
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setState("success");
          // Refresh the current user in cache so emailVerified updates immediately
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        } else {
          setState("error");
          setMessage(data.message || "Verification failed.");
        }
      })
      .catch(() => {
        setState("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm text-center space-y-4">
          {state === "loading" && (
            <>
              <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
              <h1 className="text-2xl font-bold">Verifying your email…</h1>
            </>
          )}
          {state === "success" && (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <h1 className="text-2xl font-bold">Email verified!</h1>
              <p className="text-sm text-muted-foreground">
                Your email address has been confirmed. You're all set.
              </p>
              <Button
                className="w-full rounded-xl h-12"
                onClick={() => navigate("/dashboard")}
                data-testid="button-go-to-dashboard"
              >
                Go to dashboard
              </Button>
            </>
          )}
          {state === "error" && (
            <>
              <XCircle className="w-12 h-12 text-destructive mx-auto" />
              <h1 className="text-2xl font-bold">Verification failed</h1>
              <p className="text-sm text-muted-foreground" data-testid="text-verify-error">{message}</p>
              <Button
                variant="outline"
                className="w-full rounded-xl h-12"
                onClick={() => navigate("/")}
              >
                Back to home
              </Button>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
