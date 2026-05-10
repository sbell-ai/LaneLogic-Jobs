import { Link } from "wouter";
import { Plus, X, Check } from "lucide-react";

type Props = {
  // null name renders just the code (e.g. when we don't have credentialTypes loaded)
  code: string;
  name?: string | null;
  met: boolean;
  level?: "required" | "preferred";
  showAddCta?: boolean;
};

export function CredentialGapRow({ code, name, met, level, showAddCta }: Props) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {met ? (
          <Check size={14} className="text-green-600 dark:text-green-400 shrink-0" />
        ) : (
          <X size={14} className="text-red-600 dark:text-red-400 shrink-0" />
        )}
        <span className="truncate">
          {name ?? code}
          {level === "required" && !met && (
            <span className="ml-2 text-[10px] uppercase text-red-600 dark:text-red-400 font-semibold">
              required
            </span>
          )}
        </span>
      </div>
      {!met && showAddCta && (
        <Link
          href="/seeker/settings/cert-profile"
          className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
          data-testid={`add-cred-${code}`}
        >
          <Plus size={12} /> Add to Profile
        </Link>
      )}
    </div>
  );
}
