import { useParams, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Newspaper, User } from "lucide-react";
import { BackButton } from "@/components/nav/BackButton";
import { useQuery } from "@tanstack/react-query";
import type { BlogPost } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";

export default function BlogPostPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: post, isLoading } = useQuery<BlogPost>({
    queryKey: ["/api/blog", id],
    queryFn: async () => {
      const res = await fetch(`/api/blog/${id}`);
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center gap-4">
          <Newspaper className="text-muted-foreground" size={48} />
          <h1 className="text-2xl font-bold font-display">Post Not Found</h1>
          <Button variant="outline" onClick={() => setLocation("/blog")}>Back to Blog</Button>
        </div>
        <Footer />
      </div>
    );
  }

  const isHtml = post.content.trimStart().startsWith("<");

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950 py-10">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <BackButton fallback="/blog" />

          <article className="bg-white dark:bg-slate-900 rounded-2xl border border-border shadow-sm overflow-hidden">
            {post.imageUrl ? (
              <div className="h-64 md:h-80 w-full overflow-hidden">
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="w-full h-full object-cover"
                  data-testid="img-blog-cover"
                />
              </div>
            ) : (
              <div className="h-56 bg-gradient-to-br from-primary/15 via-primary/5 to-accent/10 flex items-center justify-center">
                <Newspaper className="text-primary/25" size={72} />
              </div>
            )}

            <div className="p-8 md:p-12">
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                <span className="flex items-center gap-1.5">
                  <User size={14} /> Editorial Team
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  {post.publishedAt
                    ? format(new Date(post.publishedAt), "MMMM d, yyyy")
                    : "Recently published"}
                </span>
                {post.publishedAt && (
                  <span className="text-xs text-muted-foreground/60">
                    {formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true })}
                  </span>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl font-bold font-display mb-8 leading-tight">
                {post.title}
              </h1>

              {isHtml ? (
                <div
                  className="prose prose-slate dark:prose-invert max-w-none
                    prose-headings:font-display prose-headings:font-bold
                    prose-h2:text-2xl prose-h2:mt-6 prose-h2:mb-3
                    prose-h3:text-xl prose-h3:mt-4 prose-h3:mb-2
                    prose-h4:text-lg prose-h4:mt-3 prose-h4:mb-2
                    prose-p:text-base prose-p:leading-relaxed prose-p:mb-3
                    prose-a:text-primary prose-a:underline
                    prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-3
                    prose-ol:list-decimal prose-ol:pl-6 prose-ol:mb-3
                    prose-li:mb-1
                    prose-strong:font-bold
                    prose-blockquote:border-l-4 prose-blockquote:border-primary/40 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground
                    prose-table:w-full prose-table:border-collapse
                    prose-th:border prose-th:border-border prose-th:p-2 prose-th:bg-slate-50 prose-th:dark:bg-slate-800 prose-th:font-semibold prose-th:text-left
                    prose-td:border prose-td:border-border prose-td:p-2
                    prose-img:rounded-lg prose-img:max-w-full
                    [&_mark]:rounded [&_mark]:px-0.5
                    [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0
                    [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:items-start [&_ul[data-type=taskList]_li]:gap-2 [&_ul[data-type=taskList]_li]:mb-1
                    [&_ul[data-type=taskList]_li_input]:mt-1 [&_ul[data-type=taskList]_li_input]:shrink-0"
                  dangerouslySetInnerHTML={{ __html: post.content }}
                  data-testid="content-blog-post"
                />
              ) : (
                <div className="space-y-4" data-testid="content-blog-post">
                  {post.content.split("\n\n").map((para, i) => (
                    <p key={i} className="text-muted-foreground leading-relaxed">
                      {para}
                    </p>
                  ))}
                </div>
              )}

              <div className="mt-10 pt-8 border-t border-border">
                <Button variant="outline" onClick={() => setLocation("/blog")} data-testid="button-back-blog-bottom">
                  <ArrowLeft size={16} className="mr-2" /> More Articles
                </Button>
              </div>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
