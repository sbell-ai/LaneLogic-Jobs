import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("job_seeker"), // admin, employer, job_seeker
  membershipTier: text("membership_tier").notNull().default("free"), // free, basic, premium
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  employerId: integer("employer_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements").notNull(),
  location: text("location").notNull(),
  salary: text("salary"),
  applyUrl: text("apply_url"), // external link
  isExternalApply: boolean("is_external_apply").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  jobSeekerId: integer("job_seeker_id").notNull(),
  resumeUrl: text("resume_url"),
  status: text("status").notNull().default("pending"), // pending, reviewed, accepted, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  targetAudience: text("target_audience").notNull(), // employer, job_seeker, both
  requiredTier: text("required_tier").notNull().default("free"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  publishedAt: timestamp("published_at").defaultNow(),
});

export const resumes = pgTable("resumes", {
  id: serial("id").primaryKey(),
  jobSeekerId: integer("job_seeker_id").notNull(),
  content: text("content").notNull(), // text-based resume or file URL
  isUpload: boolean("is_upload").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, createdAt: true });
export const insertResourceSchema = createInsertSchema(resources).omit({ id: true, createdAt: true });
export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ id: true, createdAt: true });
export const insertResumeSchema = createInsertSchema(resumes).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type Resume = typeof resumes.$inferSelect;
export type InsertResume = z.infer<typeof insertResumeSchema>;

// Site Settings
export interface SiteSettingsData {
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
  logoBase64: string | null;
  siteName: string;
  siteTitle: string;
  siteDescription: string;
  headerAnnouncement: string;
  footerTagline: string;
  footerCopyright: string;
}

export const DEFAULT_SETTINGS: SiteSettingsData = {
  primaryColor: "#3b82f6",
  secondaryColor: "#f97316",
  headingFont: "Plus Jakarta Sans",
  bodyFont: "Inter",
  logoBase64: null,
  siteName: "TranspoJobs",
  siteTitle: "TranspoJobs – Transportation & Logistics Jobs",
  siteDescription: "Find the best transportation, trucking, and logistics jobs. Browse thousands of CDL and freight roles across the country.",
  headerAnnouncement: "",
  footerTagline: "The premier destination for transportation and logistics professionals to advance their careers.",
  footerCopyright: "© TranspoJobs. All rights reserved.",
};

export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  settings: jsonb("settings").notNull().$type<SiteSettingsData>(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SiteSettingsRow = typeof siteSettings.$inferSelect;

// Auth requests
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});