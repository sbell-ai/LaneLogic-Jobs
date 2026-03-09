import { db } from "./db";
import {
  users, jobs, applications, resources, blogPosts, resumes, siteSettings, categories, coupons, pages,
  importRuns, importArtifacts, socialPosts,
  type User, type InsertUser, type Job, type InsertJob,
  type Application, type InsertApplication,
  type Resource, type InsertResource,
  type BlogPost, type InsertBlogPost,
  type Resume, type InsertResume,
  type Category, type InsertCategory,
  type Coupon, type InsertCoupon,
  type Page, type InsertPage,
  type ImportRun, type InsertImportRun,
  type ImportArtifact, type InsertImportArtifact,
  type SocialPost, type InsertSocialPost,
  type SiteSettingsData, DEFAULT_SETTINGS
} from "@shared/schema";
import { eq, and, sql, desc, isNotNull } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  // Jobs
  getJobs(): Promise<Job[]>;
  getJob(id: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: number, updates: Partial<InsertJob>): Promise<Job>;
  deleteJob(id: number): Promise<void>;

  // Applications
  getApplications(): Promise<Application[]>;
  createApplication(app: InsertApplication): Promise<Application>;
  updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application>;

  // Resources
  getResources(): Promise<Resource[]>;
  getResource(id: number): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: number, updates: Partial<InsertResource>): Promise<Resource>;
  deleteResource(id: number): Promise<void>;

  // Blog
  getBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: number, updates: Partial<InsertBlogPost>): Promise<BlogPost>;
  deleteBlogPost(id: number): Promise<void>;

  // Resumes
  getResumes(jobSeekerId: number): Promise<Resume[]>;
  createResume(resume: InsertResume): Promise<Resume>;

  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Coupons
  getCoupons(): Promise<Coupon[]>;
  getCoupon(id: number): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: number, updates: Partial<InsertCoupon>): Promise<Coupon>;
  deleteCoupon(id: number): Promise<void>;
  incrementCouponUses(id: number): Promise<void>;

  // Pages
  getPages(): Promise<Page[]>;
  getPage(id: number): Promise<Page | undefined>;
  getPageBySlug(slug: string): Promise<Page | undefined>;
  createPage(page: InsertPage): Promise<Page>;
  updatePage(id: number, updates: Partial<InsertPage>): Promise<Page>;
  deletePage(id: number): Promise<void>;

  // Import Runs
  upsertJobByExternalKey(employerId: number, externalJobKey: string, job: InsertJob): Promise<Job>;
  createImportRun(run: InsertImportRun): Promise<ImportRun>;
  updateImportRun(id: number, updates: Partial<InsertImportRun>): Promise<ImportRun>;
  getImportRun(id: number): Promise<ImportRun | undefined>;
  getImportRuns(): Promise<ImportRun[]>;
  createImportArtifact(artifact: InsertImportArtifact): Promise<ImportArtifact>;
  getImportArtifact(runId: number, filename: string): Promise<ImportArtifact | undefined>;

  // Social Posts
  createSocialPost(data: InsertSocialPost): Promise<SocialPost>;
  getSocialPost(id: number): Promise<SocialPost | undefined>;
  listSocialPosts(filters?: { status?: string; entityType?: string }): Promise<SocialPost[]>;
  updateSocialPost(id: number, updates: Partial<InsertSocialPost>): Promise<SocialPost>;

  // Site Settings
  getSiteSettings(): Promise<SiteSettingsData>;
  updateSiteSettings(settings: SiteSettingsData): Promise<SiteSettingsData>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }
  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Jobs
  async getJobs(): Promise<Job[]> {
    return await db.select().from(jobs).orderBy(desc(jobs.createdAt));
  }
  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }
  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(insertJob).returning();
    return job;
  }
  async updateJob(id: number, updates: Partial<InsertJob>): Promise<Job> {
    const [job] = await db.update(jobs).set(updates).where(eq(jobs.id, id)).returning();
    return job;
  }
  async deleteJob(id: number): Promise<void> {
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  // Applications
  async getApplications(): Promise<Application[]> {
    return await db.select().from(applications);
  }
  async createApplication(insertApp: InsertApplication): Promise<Application> {
    const [app] = await db.insert(applications).values(insertApp).returning();
    return app;
  }
  async updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application> {
    const [app] = await db.update(applications).set(updates).where(eq(applications.id, id)).returning();
    return app;
  }

  // Resources
  async getResources(): Promise<Resource[]> {
    return await db.select().from(resources);
  }
  async getResource(id: number): Promise<Resource | undefined> {
    const [res] = await db.select().from(resources).where(eq(resources.id, id));
    return res;
  }
  async createResource(resource: InsertResource): Promise<Resource> {
    const [res] = await db.insert(resources).values(resource).returning();
    return res;
  }
  async updateResource(id: number, updates: Partial<InsertResource>): Promise<Resource> {
    const [res] = await db.update(resources).set(updates).where(eq(resources.id, id)).returning();
    return res;
  }
  async deleteResource(id: number): Promise<void> {
    await db.delete(resources).where(eq(resources.id, id));
  }

  // Blog
  async getBlogPosts(): Promise<BlogPost[]> {
    return await db.select().from(blogPosts);
  }
  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }
  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [blogPost] = await db.insert(blogPosts).values(post).returning();
    return blogPost;
  }
  async updateBlogPost(id: number, updates: Partial<InsertBlogPost>): Promise<BlogPost> {
    const [post] = await db.update(blogPosts).set(updates).where(eq(blogPosts.id, id)).returning();
    return post;
  }
  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  // Resumes
  async getResumes(jobSeekerId: number): Promise<Resume[]> {
    return await db.select().from(resumes).where(eq(resumes.jobSeekerId, jobSeekerId));
  }
  async createResume(resume: InsertResume): Promise<Resume> {
    const [res] = await db.insert(resumes).values(resume).returning();
    return res;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }
  async createCategory(category: InsertCategory): Promise<Category> {
    const [cat] = await db.insert(categories).values(category).returning();
    return cat;
  }
  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    return await db.select().from(coupons);
  }
  async getCoupon(id: number): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id));
    return coupon;
  }
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code));
    return coupon;
  }
  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [c] = await db.insert(coupons).values(coupon).returning();
    return c;
  }
  async updateCoupon(id: number, updates: Partial<InsertCoupon>): Promise<Coupon> {
    const [c] = await db.update(coupons).set(updates).where(eq(coupons.id, id)).returning();
    return c;
  }
  async deleteCoupon(id: number): Promise<void> {
    await db.delete(coupons).where(eq(coupons.id, id));
  }
  async incrementCouponUses(id: number): Promise<void> {
    await db.update(coupons)
      .set({ currentUses: sql`${coupons.currentUses} + 1` })
      .where(eq(coupons.id, id));
  }

  // Pages
  async getPages(): Promise<Page[]> {
    return await db.select().from(pages).orderBy(desc(pages.createdAt));
  }
  async getPage(id: number): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.id, id));
    return page;
  }
  async getPageBySlug(slug: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.slug, slug));
    return page;
  }
  async createPage(page: InsertPage): Promise<Page> {
    const [p] = await db.insert(pages).values(page).returning();
    return p;
  }
  async updatePage(id: number, updates: Partial<InsertPage>): Promise<Page> {
    const [p] = await db.update(pages).set({ ...updates, updatedAt: new Date() }).where(eq(pages.id, id)).returning();
    return p;
  }
  async deletePage(id: number): Promise<void> {
    await db.delete(pages).where(eq(pages.id, id));
  }

  // Import Runs
  async upsertJobByExternalKey(employerId: number, externalJobKey: string, job: InsertJob): Promise<Job> {
    const existing = await db.select().from(jobs).where(
      and(eq(jobs.employerId, employerId), eq(jobs.externalJobKey, externalJobKey))
    );
    if (existing.length > 0) {
      const { employerId: _eid, externalJobKey: _ek, ...updates } = job;
      const [updated] = await db.update(jobs).set(updates).where(eq(jobs.id, existing[0].id)).returning();
      return updated;
    }
    const [created] = await db.insert(jobs).values(job).returning();
    return created;
  }
  async createImportRun(run: InsertImportRun): Promise<ImportRun> {
    const [r] = await db.insert(importRuns).values(run).returning();
    return r;
  }
  async updateImportRun(id: number, updates: Partial<InsertImportRun>): Promise<ImportRun> {
    const [r] = await db.update(importRuns).set(updates).where(eq(importRuns.id, id)).returning();
    return r;
  }
  async getImportRun(id: number): Promise<ImportRun | undefined> {
    const [r] = await db.select().from(importRuns).where(eq(importRuns.id, id));
    return r;
  }
  async getImportRuns(): Promise<ImportRun[]> {
    return await db.select().from(importRuns).orderBy(desc(importRuns.uploadedAt));
  }
  async createImportArtifact(artifact: InsertImportArtifact): Promise<ImportArtifact> {
    const [a] = await db.insert(importArtifacts).values(artifact).returning();
    return a;
  }
  async getImportArtifact(runId: number, filename: string): Promise<ImportArtifact | undefined> {
    const [a] = await db.select().from(importArtifacts).where(
      and(eq(importArtifacts.runId, runId), eq(importArtifacts.filename, filename))
    );
    return a;
  }

  // Social Posts
  async createSocialPost(data: InsertSocialPost): Promise<SocialPost> {
    const [post] = await db.insert(socialPosts).values(data).returning();
    return post;
  }
  async getSocialPost(id: number): Promise<SocialPost | undefined> {
    const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, id));
    return post;
  }
  async listSocialPosts(filters?: { status?: string; entityType?: string }): Promise<SocialPost[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(socialPosts.status, filters.status));
    if (filters?.entityType) conditions.push(eq(socialPosts.entityType, filters.entityType));
    if (conditions.length > 0) {
      return await db.select().from(socialPosts).where(and(...conditions)).orderBy(desc(socialPosts.createdAt));
    }
    return await db.select().from(socialPosts).orderBy(desc(socialPosts.createdAt));
  }
  async updateSocialPost(id: number, updates: Partial<InsertSocialPost>): Promise<SocialPost> {
    const [post] = await db.update(socialPosts).set({ ...updates, updatedAt: new Date() }).where(eq(socialPosts.id, id)).returning();
    return post;
  }

  // Site Settings
  async getSiteSettings(): Promise<SiteSettingsData> {
    const rows = await db.select().from(siteSettings).limit(1);
    if (rows.length === 0) return { ...DEFAULT_SETTINGS };
    return rows[0].settings;
  }
  async updateSiteSettings(settings: SiteSettingsData): Promise<SiteSettingsData> {
    const rows = await db.select().from(siteSettings).limit(1);
    if (rows.length === 0) {
      const [row] = await db.insert(siteSettings).values({ settings }).returning();
      return row.settings;
    } else {
      const [row] = await db.update(siteSettings)
        .set({ settings, updatedAt: new Date() })
        .where(eq(siteSettings.id, rows[0].id))
        .returning();
      return row.settings;
    }
  }
}

export const storage = new DatabaseStorage();