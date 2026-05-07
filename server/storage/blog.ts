import { db } from "../db";
import { blogPosts, type BlogPost, type InsertBlogPost } from "@shared/schema";
import { eq } from "drizzle-orm";

export const blogStorage = {
  async getBlogPosts(): Promise<BlogPost[]> {
    return await db.select().from(blogPosts);
  },
  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  },
  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post;
  },
  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [blogPost] = await db.insert(blogPosts).values(post as any).returning();
    return blogPost;
  },
  async updateBlogPost(id: number, updates: Partial<InsertBlogPost>): Promise<BlogPost> {
    const [post] = await db.update(blogPosts).set(updates as any).where(eq(blogPosts.id, id)).returning();
    return post;
  },
  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  },
};
