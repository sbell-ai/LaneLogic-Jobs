// Final employer step. Two paths, both call complete() — one redirects to
// the existing /dashboard/jobs/new flow, the other returns to /dashboard.
// We don't build the job-posting flow here.

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Briefcase, Clock } from "lucide-react";

type Props = {
  onPostNow: () => Promise<void>;
  onLater: () => Promise<void>;
  finishing: boolean;
};

export function PostJobStep({ onPostNow, onLater, finishing }: Props) {
  return (
    <div className="space-y-4" data-testid="step-post-job">
      <div>
        <h2 className="text-xl font-bold">Post your first job</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Posting a job is how seekers find you. You can do this now or later.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-5 space-y-3 hover:border-primary/50 transition-colors">
          <div className="rounded-md bg-primary/10 p-2 w-fit">
            <Briefcase className="text-primary" size={20} />
          </div>
          <h3 className="font-semibold">Post a Job Now</h3>
          <p className="text-sm text-muted-foreground">
            Open the job posting form. Takes about 2 minutes.
          </p>
          <Button onClick={onPostNow} disabled={finishing} className="w-full" data-testid="post-job-now">
            {finishing ? "Saving…" : "Post a Job Now →"}
          </Button>
        </Card>

        <Card className="p-5 space-y-3 hover:border-border transition-colors">
          <div className="rounded-md bg-muted p-2 w-fit">
            <Clock className="text-muted-foreground" size={20} />
          </div>
          <h3 className="font-semibold">I'll do this later</h3>
          <p className="text-sm text-muted-foreground">
            Skip for now and head straight to your dashboard.
          </p>
          <Button variant="outline" onClick={onLater} disabled={finishing} className="w-full" data-testid="post-job-later">
            {finishing ? "Saving…" : "I'll do this later →"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
