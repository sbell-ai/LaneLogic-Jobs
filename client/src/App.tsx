import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Import pages
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Overview from "@/pages/dashboard/Overview";

// Placeholder components for routes not fully fleshed out in the minimal example but required for complete UI flow
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center min-h-screen p-4">
    <h1 className="text-3xl font-display font-bold mb-4">{title}</h1>
    <a href="/" className="text-primary hover:underline">Return Home</a>
  </div>
);

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Public Pages */}
      <Route path="/jobs" component={() => <PlaceholderPage title="Jobs Board" />} />
      <Route path="/jobs/:id" component={() => <PlaceholderPage title="Job Details" />} />
      <Route path="/blog" component={() => <PlaceholderPage title="Blog" />} />
      <Route path="/resources" component={() => <PlaceholderPage title="Resources Library" />} />
      <Route path="/pricing" component={() => <PlaceholderPage title="Membership Pricing" />} />
      
      {/* Dashboard Routes */}
      <Route path="/dashboard" component={Overview} />
      <Route path="/dashboard/:section" component={() => <PlaceholderPage title="Dashboard Section" />} />
      <Route path="/dashboard/admin/:section" component={() => <PlaceholderPage title="Admin Panel" />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
