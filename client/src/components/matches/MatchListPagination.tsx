import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  limit: number;
  total: number;
  onChange: (page: number) => void;
};

export function MatchListPagination({ page, limit, total, onChange }: Props) {
  const lastPage = Math.max(1, Math.ceil(total / limit));
  if (lastPage <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <p className="text-sm text-muted-foreground">
        Page {page} of {lastPage} · {total} match{total === 1 ? "" : "es"}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          data-testid="page-prev"
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= lastPage}
          onClick={() => onChange(page + 1)}
          data-testid="page-next"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
