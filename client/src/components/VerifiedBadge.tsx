import { BadgeCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface VerifiedBadgeProps {
  type: "employer" | "seeker";
  size?: "sm" | "md";
  showTooltip?: boolean;
}

const TOOLTIP_TEXT = {
  employer: "This employer has been verified by LaneLogic",
  seeker: "This candidate has been credential-verified by LaneLogic",
};

export function VerifiedBadge({ type, size = "sm", showTooltip = true }: VerifiedBadgeProps) {
  const iconSize = size === "sm" ? 13 : 16;
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  const padding = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";

  const badge = (
    <span
      className={`inline-flex items-center gap-1 ${padding} rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 font-semibold ${textSize} whitespace-nowrap`}
      data-testid={`badge-verified-${type}`}
    >
      <BadgeCheck size={iconSize} className="shrink-0" />
      Verified
    </span>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top">
          <p>{TOOLTIP_TEXT[type]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
