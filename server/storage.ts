import { db } from "./db";
import {
  users, jobs, applications, resources, blogPosts, resumes, siteSettings,
  type User, type InsertUser, type Job, type InsertJob,
  type Application, type InsertApplication,
  type Resource, type InsertResource,
  type BlogPost, type InsertBlogPost,
  type Resume, type InsertResume,
  type SiteSettingsData, DEFAULT_SETTINGS
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;

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
  createResource(resource: InsertResource): Promise<Resource>;

  // Blog
  getBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;

  // Resumes
  getResumes(jobSeekerId: number): Promise<Resume[]>;
  createResume(resume: InsertResume): Promise<Resume>;

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

  // Jobs
  async getJobs(): Promise<Job[]> {
    return await db.select().from(jobs);
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
  async createResource(resource: InsertResource): Promise<Resource> {
    const [res] = await db.insert(resources).values(resource).returning();
    return res;
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

  // Resumes
  async getResumes(jobSeekerId: number): Promise<Resume[]> {
    return await db.select().from(resumes).where(eq(resumes.jobSeekerId, jobSeekerId));
  }
  async createResume(resume: InsertResume): Promise<Resume> {
    const [res] = await db.insert(resumes).values(resume).returning();
    return res;
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