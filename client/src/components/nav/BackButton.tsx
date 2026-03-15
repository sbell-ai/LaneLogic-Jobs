import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { getPreviousPath } from "@/lib/navigationHistory";

interface BackButtonProps {
  fallback?: string;
}

export function BackButton({ fallback = "/" }: BackButtonProps) {
  const [location, navigate] = useLocation();

  function handleClick() {
    const prev = getPreviousPath();
    if (prev && prev !== location) {
      navigate(prev);
    } else {
      navigate(fallback);
    }
  }

  return (
    <Button
      variant="ghost"
      className="mb-6 text-muted-foreground hover:text-foreground"
      onClick={handleClick}
      aria-label="Back"
      data-testid="button-back"
    >
      <ChevronLeft size={16} className="mr-1" /> Back
    </Button>
  );
}
