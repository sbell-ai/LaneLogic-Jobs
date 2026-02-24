import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useQuery } from "@tanstack/react-query";
import type { BlogPost } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Clock, Newspaper } from "lucide-react";
import { motion } from "framer-motion";

export default function Blog() {
  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
  });

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-b border-border py-12">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <span className="inline-block py-1 px-3 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-4 border border-primary/20">
              Industry News & Insights
            </span>
            <h1 className="text-4xl font-bold font-display mb-3">TranspoJobs Blog</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Stay informed on hiring trends, career tips, and the latest news in the transportation industry.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-12">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-border h-64 animate-pulse" />
              ))}
            </div>
          ) : !posts || posts.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
              <Newspaper className="mx-auto mb-4 text-muted-foreground" size={40} />
              <h2 className="text-xl font-bold font-display mb-2">No posts yet</h2>
              <p className="text-muted-foreground">Check back soon for industry news and tips.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link href={`/blog/${post.id}`}>
                    <div
                      data-testid={`card-blog-${post.id}`}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-border shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-200 cursor-pointer group overflow-hidden h-full flex flex-col"
                    >
                      <div className="h-40 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 flex items-center justify-center">
                        <Newspaper className="text-primary/30" size={56} />
                      </div>
                      <div className="p-6 flex flex-col flex-grow">
                        <h2 className="text-lg font-bold font-display mb-3 group-hover:text-primary transition-colors line-clamp-2">
                          {post.title}
                        </h2>
                        <p className="text-muted-foreground text-sm line-clamp-3 flex-grow">
                          {post.content}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
                          <Clock size={13} />
                          {post.publishedAt
                            ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true })
                            : "Recently"}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
