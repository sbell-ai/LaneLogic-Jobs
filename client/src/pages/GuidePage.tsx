import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, BookOpen } from "lucide-react";
import { Link } from "wouter";

interface RichTextItem {
  plain_text: string;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
    underline?: boolean;
  };
  href?: string | null;
  type?: string;
}

interface NotionBlock {
  id: string;
  type: string;
  [key: string]: any;
}

interface GuideData {
  title: string;
  blocks: NotionBlock[];
}

function richText(items: RichTextItem[]): string {
  return (items || []).map((t) => t.plain_text).join("");
}

function RichTextSpans({ items }: { items: RichTextItem[] }) {
  return (
    <>
      {(items || []).map((t, i) => {
        let node: React.ReactNode = t.plain_text;
        const a = t.annotations ?? {};
        if (a.code) node = <code key={i} className="px-1.5 py-0.5 rounded bg-muted font-mono text-[0.85em]">{node}</code>;
        else {
          if (a.bold) node = <strong key={`b${i}`}>{node}</strong>;
          if (a.italic) node = <em key={`e${i}`}>{node}</em>;
          if (a.strikethrough) node = <s key={`s${i}`}>{node}</s>;
          if (a.underline) node = <u key={`u${i}`}>{node}</u>;
        }
        if (t.href) {
          node = (
            <a key={`a${i}`} href={t.href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">
              {node}
            </a>
          );
        }
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

function NotionBlockRenderer({ block, depth = 0 }: { block: NotionBlock; depth?: number }) {
  const b = block[block.type] ?? {};

  switch (block.type) {
    case "heading_1":
      return (
        <h1 className="text-3xl font-bold font-display mt-10 mb-4 text-foreground">
          <RichTextSpans items={b.rich_text} />
        </h1>
      );
    case "heading_2":
      return (
        <h2 className="text-2xl font-bold font-display mt-8 mb-3 text-foreground">
          <RichTextSpans items={b.rich_text} />
        </h2>
      );
    case "heading_3":
      return (
        <h3 className="text-xl font-semibold font-display mt-6 mb-2 text-foreground">
          <RichTextSpans items={b.rich_text} />
        </h3>
      );
    case "paragraph":
      if (!b.rich_text?.length) return <div className="my-3" />;
      return (
        <p className="my-3 text-base leading-7 text-foreground/90">
          <RichTextSpans items={b.rich_text} />
        </p>
      );
    case "bulleted_list_item":
      return (
        <li className="ml-6 my-1.5 list-disc text-foreground/90">
          <RichTextSpans items={b.rich_text} />
        </li>
      );
    case "numbered_list_item":
      return (
        <li className="ml-6 my-1.5 list-decimal text-foreground/90">
          <RichTextSpans items={b.rich_text} />
        </li>
      );
    case "divider":
      return <hr className="my-8 border-border" />;
    case "callout": {
      const emoji = b.icon?.type === "emoji" ? b.icon.emoji : "💡";
      return (
        <div className="my-5 flex gap-3 rounded-xl border border-border bg-muted/50 px-5 py-4">
          <span className="text-xl leading-7 shrink-0">{emoji}</span>
          <div className="text-base leading-7 text-foreground/90">
            <RichTextSpans items={b.rich_text} />
          </div>
        </div>
      );
    }
    case "toggle":
      return (
        <details className="my-3 rounded-xl border border-border bg-background open:shadow-sm">
          <summary className="cursor-pointer px-5 py-3 font-medium text-foreground select-none">
            <RichTextSpans items={b.rich_text} />
          </summary>
          {block.children?.map((child: NotionBlock) => (
            <div key={child.id} className="px-5 pb-3">
              <NotionBlockRenderer block={child} depth={depth + 1} />
            </div>
          ))}
        </details>
      );
    case "quote":
      return (
        <blockquote className="my-4 border-l-4 border-primary pl-5 text-muted-foreground italic">
          <RichTextSpans items={b.rich_text} />
        </blockquote>
      );
    case "code":
      return (
        <pre className="my-4 rounded-xl bg-slate-900 dark:bg-slate-800 text-slate-100 p-5 overflow-x-auto text-sm font-mono leading-6">
          <code>{richText(b.rich_text)}</code>
        </pre>
      );
    default:
      console.log("[GuidePage] skipped block type:", block.type);
      return null;
  }
}

function groupBlocks(blocks: NotionBlock[]): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block.type === "bulleted_list_item") {
      const items: NotionBlock[] = [];
      while (i < blocks.length && blocks[i].type === "bulleted_list_item") {
        items.push(blocks[i++]);
      }
      nodes.push(
        <ul key={`ul-${block.id}`} className="my-3 space-y-0.5">
          {items.map((b) => <NotionBlockRenderer key={b.id} block={b} />)}
        </ul>
      );
    } else if (block.type === "numbered_list_item") {
      const items: NotionBlock[] = [];
      while (i < blocks.length && blocks[i].type === "numbered_list_item") {
        items.push(blocks[i++]);
      }
      nodes.push(
        <ol key={`ol-${block.id}`} className="my-3 space-y-0.5">
          {items.map((b) => <NotionBlockRenderer key={b.id} block={b} />)}
        </ol>
      );
    } else {
      nodes.push(<NotionBlockRenderer key={block.id} block={block} />);
      i++;
    }
  }
  return nodes;
}

const GUIDE_META: Record<string, { audience: string; crumb: string }> = {
  "job-seeker": { audience: "Job Seekers", crumb: "Job Seeker Guide" },
  "employer":   { audience: "Employers",   crumb: "Employer Guide"   },
};

export default function GuidePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const meta = GUIDE_META[slug];

  const { data, isLoading, error } = useQuery<GuideData>({
    queryKey: ["/api/content/notion-guide", slug],
    queryFn: async () => {
      const res = await fetch(`/api/content/notion-guide?slug=${slug}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to load guide");
      }
      return res.json();
    },
    enabled: !!slug && !!meta,
    staleTime: 5 * 60 * 1000,
  });

  if (!meta) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Guide not found.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="bg-gradient-to-b from-primary/5 to-transparent py-12 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <span>/</span>
              <Link href="/guides" className="hover:text-foreground transition-colors">User Guides</Link>
              <span>/</span>
              <span className="text-foreground font-medium">{meta.crumb}</span>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-0.5">User Guide</p>
                <h1 className="text-3xl font-bold font-display text-foreground">
                  {isLoading ? <Skeleton className="h-8 w-64" /> : data?.title ?? meta.crumb}
                </h1>
              </div>
            </div>
            <p className="text-muted-foreground mt-2">For {meta.audience}</p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-10">
          {isLoading && (
            <div className="space-y-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className={`h-5 ${i % 3 === 0 ? "w-2/3" : "w-full"}`} />
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-destructive">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Could not load guide</p>
                <p className="text-sm mt-1 opacity-80">{(error as Error).message}</p>
              </div>
            </div>
          )}

          {data && !isLoading && (
            <article className="prose-custom" data-testid="guide-content">
              {groupBlocks(data.blocks)}
            </article>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
