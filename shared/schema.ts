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
  companyAddress: text("company_address"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  aboutCompany: text("about_company"),
  profileImage: text("profile_image"),
  companyLogo: text("company_logo"),
  showProfile: boolean("show_profile").notNull().default(true),
  showName: boolean("show_name").notNull().default(true),
  showCurrentEmployer: boolean("show_current_employer").notNull().default(true),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  employerId: integer("employer_id").notNull(),
  title: text("title").notNull(),
  companyName: text("company_name"),
  jobType: text("job_type"),
  category: text("category"),
  industry: text("industry"),
  description: text("description").notNull(),
  requirements: text("requirements").notNull(),
  benefits: text("benefits"),
  locationCity: text("location_city"),
  locationState: text("location_state"),
  locationCountry: text("location_country"),
  salary: text("salary"),
  applyUrl: text("apply_url"),
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
  category: text("category"),
  publishedAt: timestamp("published_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull(),
  discountValue: integer("discount_value").notNull(),
  maxUses: integer("max_uses"),
  currentUses: integer("current_uses").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  appliesTo: text("applies_to").notNull().default("all"),
  createdAt: timestamp("created_at").defaultNow(),
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
export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ id: true });
export const insertResumeSchema = createInsertSchema(resumes).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true, currentUses: true });

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
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;

// Site Settings
export interface SiteSettingsData {
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
  logoBase64: string | null;
  logoSize: "small" | "medium" | "large" | "x-large";
  siteName: string;
  siteTitle: string;
  siteDescription: string;
  headerAnnouncement: string;
  headerAnnouncementLink: string;
  footerBgColor: string;
  footerTagline: string;
  footerCopyright: string;
  socialTwitter: string;
  socialLinkedin: string;
  socialFacebook: string;
  socialInstagram: string;
  socialYoutube: string;
  socialTiktok: string;
  loginHeading: string;
  loginSubtitle: string;
  loginTestimonial: string;
  loginTestimonialAuthor: string;
  loginBackgroundImage: string;
  signupHeading: string;
  signupSubtitle: string;
  signupDescription: string;
  heroBadge: string;
  heroHeading: string;
  heroSubtext: string;
  heroPopularSearches: string;
  feature1Title: string;
  feature1Description: string;
  feature2Title: string;
  feature2Description: string;
  feature3Title: string;
  feature3Description: string;
  ctaHeading: string;
  ctaSubtext: string;
  ctaBackgroundImage: string;
  heroSize: "compact" | "default" | "large";
  heroBgColor: string;
  heroBorderColor: string;
  heroFontColor: string;
}

export const DEFAULT_SETTINGS: SiteSettingsData = {
  primaryColor: "#3b82f6",
  secondaryColor: "#f97316",
  headingFont: "Plus Jakarta Sans",
  bodyFont: "Inter",
  logoBase64: null,
  logoSize: "medium",
  siteName: "TranspoJobs",
  siteTitle: "TranspoJobs – Transportation & Logistics Jobs",
  siteDescription: "Find the best transportation, trucking, and logistics jobs. Browse thousands of CDL and freight roles across the country.",
  headerAnnouncement: "",
  headerAnnouncementLink: "",
  footerBgColor: "#020617",
  footerTagline: "The premier destination for transportation and logistics professionals to advance their careers.",
  footerCopyright: "© TranspoJobs. All rights reserved.",
  socialTwitter: "",
  socialLinkedin: "",
  socialFacebook: "",
  socialInstagram: "",
  socialYoutube: "",
  socialTiktok: "",
  loginHeading: "Welcome back",
  loginSubtitle: "Log in to your account to continue",
  loginTestimonial: "TranspoJobs helped us find qualified CDL drivers within a week of posting. The quality of candidates is outstanding.",
  loginTestimonialAuthor: "Sarah Jenkins, Logistics Director at FastFreight",
  loginBackgroundImage: "https://images.unsplash.com/photo-1580674285054-bed31e145f59?w=800&q=80",
  signupHeading: "Create an account",
  signupSubtitle: "Join TranspoJobs to take the next step",
  signupDescription: "Connect with thousands of transportation and logistics companies across the country.",
  heroBadge: "#1 Transportation Job Board",
  heroHeading: "Drive Your Career Forward",
  heroSubtext: "Connect with top employers in logistics, freight, and transportation. Find roles that match your skills, from CDL drivers to supply chain directors.",
  heroPopularSearches: "CDL Driver, Logistics Manager, Dispatcher, Fleet Manager",
  feature1Title: "10,000+ Active Jobs",
  feature1Description: "New opportunities added daily from leading transportation companies nationwide.",
  feature2Title: "Direct Employer Access",
  feature2Description: "Skip the middleman. Apply directly to hiring managers and fast-track your career.",
  feature3Title: "Verified Companies",
  feature3Description: "Every employer is vetted to ensure quality opportunities and safe working environments.",
  ctaHeading: "Ready to hire top transport talent?",
  ctaSubtext: "Join thousands of employers who trust us to fill their open logistics, driving, and management positions faster.",
  ctaBackgroundImage: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1920&h=1080&fit=crop",
  heroSize: "default",
  heroBgColor: "",
  heroBorderColor: "",
  heroFontColor: "",
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