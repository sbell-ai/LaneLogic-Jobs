import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

type Props = {
  headline: string;
  valueProp: string;
  ctaLabel?: string;
  onContinue: () => void;
};

export function WelcomeStep({ headline, valueProp, ctaLabel = "Get Started →", onContinue }: Props) {
  return (
    <Card className="p-8 space-y-5 text-center">
      <div className="flex justify-center">
        <div className="rounded-full bg-primary/10 p-3">
          <Sparkles className="text-primary" size={28} />
        </div>
      </div>
      <h1 className="text-2xl font-bold">{headline}</h1>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{valueProp}</p>
      <div className="pt-2">
        <Button onClick={onContinue} size="lg" data-testid="welcome-continue">
          {ctaLabel}
        </Button>
      </div>
    </Card>
  );
}
