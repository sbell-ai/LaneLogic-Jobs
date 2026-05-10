// Standalone wizard shell — intentionally NOT nested inside DashboardLayout.
// No sidebar, no app chrome. The user is in a focused, linear flow until
// they finish (or skip).

import { Link } from "wouter";

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="font-display font-bold text-lg tracking-tight text-foreground"
            data-testid="onboarding-wordmark"
          >
            LaneLogic <span className="text-primary">Jobs</span>
          </Link>
          <span className="text-xs text-muted-foreground">Account setup</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  );
}
