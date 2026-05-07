import { db } from "./db";
import {
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
  type AdminProduct, type InsertAdminProduct,
  type AdminEntitlement, type InsertAdminEntitlement,
  type AdminProductOverride, type InsertAdminProductOverride,
  type AdminProductEntitlement, type InsertAdminProductEntitlement,
  type MigrationState, type InsertMigrationState,
  type EntitlementUsageWindow, type InsertEntitlementUsageWindow,
  type EntitlementCreditGrant, type InsertEntitlementCreditGrant,
  type EntitlementCreditConsumption, type InsertEntitlementCreditConsumption,
  type SiteSettingsData,
  type JobSource, type InsertJobSource,
  type ImportTarget, type InsertImportTarget,
  type JobImportRun, type InsertJobImportRun,
  type EmployerVerificationRequest, type InsertEmployerVerificationRequest,
  type EmployerEvidenceItem, type InsertEmployerEvidenceItem,
  type SeekerCredentialRequirement, type InsertSeekerCredentialRequirement,
  type SeekerRequirementRule, type InsertSeekerRequirementRule,
  type SeekerVerificationRequest, type InsertSeekerVerificationRequest,
  type SeekerCredentialEvidenceItem, type InsertSeekerCredentialEvidenceItem,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage,
  type EmailTemplate, type InsertEmailTemplate,
  type EmailCronConfig, type InsertEmailCronConfig,
  type JobAlertSubscription, type InsertJobAlertSubscription,
  type SavedJob, type InsertSavedJob,
  type Menu, type InsertMenu, type MenuItem, type InsertMenuItem,
} from "@shared/schema";

import { userStorage } from "./storage/users";
import { jobStorage } from "./storage/jobs";
import { applicationStorage } from "./storage/applications";
import { savedJobStorage } from "./storage/savedJobs";
import { resourceStorage } from "./storage/resources";
import { blogStorage } from "./storage/blog";
import { resumeStorage } from "./storage/resumes";
import { categoryStorage } from "./storage/categories";
import { couponStorage } from "./storage/coupons";
import { pageStorage } from "./storage/pages";
import { importRunStorage } from "./storage/importRuns";
import { socialPostStorage } from "./storage/socialPosts";
import { siteSettingsStorage } from "./storage/siteSettings";
import { emailTemplateStorage } from "./storage/emailTemplates";
import { adminProductStorage } from "./storage/adminProducts";
import { adminEntitlementStorage } from "./storage/adminEntitlements";
import { adminOverrideStorage } from "./storage/adminOverrides";
import { adminProductEntitlementStorage } from "./storage/adminProductEntitlements";
import { migrationStateStorage } from "./storage/migrationState";
import { entitlementUsageStorage } from "./storage/entitlementUsage";
import { entitlementCreditStorage } from "./storage/entitlementCredits";
import { jobSourceStorage } from "./storage/jobSources";
import { importTargetStorage } from "./storage/importTargets";
import { jobImportRunStorage } from "./storage/jobImportRuns";
import { apifyJobStorage } from "./storage/apifyJobs";
import { employerVerificationStorage } from "./storage/employerVerification";
import { seekerVerificationStorage } from "./storage/seekerVerification";
import { messagingStorage } from "./storage/messaging";
import { enrichedApplicantStorage } from "./storage/enrichedApplicants";
import { jobAlertStorage } from "./storage/jobAlerts";
import { emailCronStorage } from "./storage/emailCron";
import { adminProfileStorage } from "./storage/adminProfile";
import { menuStorage } from "./storage/menus";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmailVerificationToken(token: string): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  findOrCreateEmployerByCompanyName(companyName: string): Promise<User>;
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
  getApplicationsBySeeker(seekerId: number): Promise<Application[]>;
  createApplication(app: InsertApplication): Promise<Application>;
  updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application>;
  deleteApplication(id: number): Promise<void>;
  markApplicationViewed(id: number): Promise<void>;

  // Saved Jobs
  getSavedJobsBySeeker(seekerId: number): Promise<SavedJob[]>;
  saveJob(seekerId: number, jobId: number): Promise<SavedJob>;
  unsaveJob(seekerId: number, jobId: number): Promise<void>;

  // Resources
  getResources(context?: "admin" | "public"): Promise<Resource[]>;
  getResource(id: number): Promise<Resource | undefined>;
  getResourceBySlug(slug: string): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: number, updates: Partial<InsertResource>): Promise<Resource>;
  deleteResource(id: number): Promise<void>;

  // Blog
  getBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
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
  deleteSocialPost(id: number): Promise<void>;

  // Site Settings
  getSiteSettings(): Promise<SiteSettingsData>;
  updateSiteSettings(settings: SiteSettingsData): Promise<SiteSettingsData>;

  // Email Templates
  getEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplateBySlug(slug: string): Promise<EmailTemplate | undefined>;
  upsertEmailTemplate(slug: string, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate>;

  // Admin Products
  getAdminProducts(): Promise<AdminProduct[]>;
  getAdminProduct(id: number): Promise<AdminProduct | undefined>;
  createAdminProduct(product: InsertAdminProduct): Promise<AdminProduct>;
  updateAdminProduct(id: number, updates: Partial<InsertAdminProduct>): Promise<AdminProduct>;
  deleteAdminProduct(id: number): Promise<void>;

  // Admin Entitlements
  getAdminEntitlements(): Promise<AdminEntitlement[]>;
  getAdminEntitlement(id: number): Promise<AdminEntitlement | undefined>;
  createAdminEntitlement(entitlement: InsertAdminEntitlement): Promise<AdminEntitlement>;
  updateAdminEntitlement(id: number, updates: Partial<InsertAdminEntitlement>): Promise<AdminEntitlement>;
  deleteAdminEntitlement(id: number): Promise<void>;

  // Admin Product Overrides
  getAdminProductOverrides(productId?: number): Promise<AdminProductOverride[]>;
  getAdminProductOverride(id: number): Promise<AdminProductOverride | undefined>;
  createAdminProductOverride(override: InsertAdminProductOverride): Promise<AdminProductOverride>;
  updateAdminProductOverride(id: number, updates: Partial<InsertAdminProductOverride>): Promise<AdminProductOverride>;
  deleteAdminProductOverride(id: number): Promise<void>;

  // Admin Product Entitlements (join table)
  getAdminProductEntitlements(productId: number): Promise<AdminProductEntitlement[]>;
  setAdminProductEntitlements(productId: number, entitlementIds: number[]): Promise<void>;

  // Migration State
  getMigrationState(key: string): Promise<MigrationState | undefined>;
  setMigrationState(state: InsertMigrationState): Promise<MigrationState>;

  // Entitlement Usage Windows
  getOrCreateUsageWindow(userId: number, entitlementKey: string, windowStart: Date, windowEnd: Date): Promise<EntitlementUsageWindow>;
  incrementUsageWindow(windowId: number): Promise<EntitlementUsageWindow>;
  incrementUsageWindowAtomic(windowId: number, maxCount: number): Promise<EntitlementUsageWindow | null>;

  // Entitlement Credit Grants
  createCreditGrant(grant: InsertEntitlementCreditGrant): Promise<EntitlementCreditGrant>;
  getActiveCreditGrants(userId: number, entitlementKey: string): Promise<EntitlementCreditGrant[]>;
  consumeCreditFromGrant(grantId: number, amount: number): Promise<EntitlementCreditGrant>;
  createCreditConsumption(consumption: InsertEntitlementCreditConsumption): Promise<EntitlementCreditConsumption>;
  getUserCreditSummary(userId: number, entitlementKey: string): Promise<{ totalRemaining: number; grants: EntitlementCreditGrant[] }>;
  getCreditGrantByPaymentIntent(paymentIntentId: string): Promise<EntitlementCreditGrant | undefined>;

  // Job Sources (Apify import pipeline)
  getJobSources(): Promise<JobSource[]>;
  getJobSource(id: number): Promise<JobSource | undefined>;
  createJobSource(source: InsertJobSource): Promise<JobSource>;
  updateJobSource(id: number, updates: Partial<InsertJobSource>): Promise<JobSource>;
  getActiveJobSourcesDueForPoll(): Promise<JobSource[]>;
  claimJobSourceForRun(sourceId: number): Promise<boolean>;

  // Import Targets (discovered Workday domains)
  getImportTargets(sourceId?: number): Promise<ImportTarget[]>;
  getImportTarget(id: number): Promise<ImportTarget | undefined>;
  upsertImportTarget(sourceId: number, sourceDomain: string, companyName: string, employerWebsiteDomain?: string | null): Promise<ImportTarget>;
  updateImportTarget(id: number, updates: Partial<InsertImportTarget>): Promise<ImportTarget>;
  getJobCountByImportTarget(importTargetId: number): Promise<number>;

  // Job Import Runs
  createJobImportRun(run: InsertJobImportRun): Promise<JobImportRun>;
  updateJobImportRun(id: number, updates: Partial<InsertJobImportRun>): Promise<JobImportRun>;
  getJobImportRuns(sourceId?: number, limit?: number): Promise<JobImportRun[]>;
  getJobImportRun(id: number): Promise<JobImportRun | undefined>;

  deleteJobSource(id: number): Promise<void>;
  getActiveRunCountForSource(sourceId: number): Promise<number>;
  getPendingImportTargetsCount(): Promise<number>;
  bulkUpdateImportTargets(ids: number[], status: string): Promise<number>;
  getImportTargetsWithSource(sourceId?: number): Promise<(ImportTarget & { sourceName: string; jobCount: number })[]>;
  getJobImportRunsFiltered(opts: { sourceId?: number; status?: string; dateFrom?: Date; dateTo?: Date; page: number; limit: number }): Promise<{ runs: (JobImportRun & { sourceName: string })[], total: number }>;
  getJobsForImportRun(runId: number): Promise<{ id: number; title: string; companyName: string | null; status: string | null; createdAt: Date | null; lastImportedAt: Date | null }[]>;

  // Apify job upsert
  upsertImportedJob(sourceId: number, importTargetId: number, externalJobId: string, jobData: Partial<InsertJob>): Promise<{ job: Job; action: "created" | "updated" | "skipped" }>;
  expireJobsNotInSet(importTargetId: number, seenExternalJobIds: string[]): Promise<number>;
  expireJobsByImportTarget(importTargetId: number): Promise<number>;

  // Employer Verification
  getActiveVerificationRequest(employerId: number): Promise<EmployerVerificationRequest | undefined>;
  getLatestVerificationRequest(employerId: number): Promise<EmployerVerificationRequest | undefined>;
  getOrCreateVerificationRequest(employerId: number): Promise<EmployerVerificationRequest>;
  getVerificationRequestsByStatus(statuses: string[]): Promise<(EmployerVerificationRequest & { employerName: string | null; employerEmail: string })[]>;
  updateVerificationRequestStatus(requestId: number, status: string, adminNotes?: string, decidedBy?: number): Promise<EmployerVerificationRequest>;
  createEvidenceItem(item: InsertEmployerEvidenceItem): Promise<EmployerEvidenceItem>;
  getEvidenceItemsByRequest(requestId: number): Promise<EmployerEvidenceItem[]>;
  updateEmployerVerificationStatus(employerId: number, status: string): Promise<User>;

  // Seeker Credential Verification
  getSeekerCredentialRequirements(): Promise<SeekerCredentialRequirement[]>;
  upsertSeekerCredentialRequirement(req: InsertSeekerCredentialRequirement): Promise<SeekerCredentialRequirement>;
  getSeekerRequirementRules(): Promise<SeekerRequirementRule[]>;
  upsertSeekerRequirementRule(rule: InsertSeekerRequirementRule): Promise<SeekerRequirementRule>;
  getActiveSeekerVerificationRequest(seekerId: number): Promise<SeekerVerificationRequest | undefined>;
  getLatestSeekerVerificationRequest(seekerId: number): Promise<SeekerVerificationRequest | undefined>;
  getOrCreateSeekerVerificationRequest(seekerId: number): Promise<SeekerVerificationRequest>;
  appendRequirementsSnapshot(requestId: number, keys: string[]): Promise<SeekerVerificationRequest>;
  getSeekerVerificationRequestsByStatus(statuses: string[]): Promise<(SeekerVerificationRequest & { seekerName: string | null; seekerEmail: string; seekerTrack: string | null; cdlIsNonDomiciled: boolean; cdlMarkedNonDomiciledIssuingState: boolean })[]>;
  updateSeekerVerificationRequestStatus(requestId: number, status: string, adminNotes?: string, decidedBy?: number): Promise<SeekerVerificationRequest>;
  createSeekerEvidenceItem(item: InsertSeekerCredentialEvidenceItem): Promise<SeekerCredentialEvidenceItem>;
  getSeekerEvidenceItemsByRequest(requestId: number): Promise<SeekerCredentialEvidenceItem[]>;
  updateSeekerVerificationStatus(seekerId: number, status: string): Promise<User>;

  // Messaging
  getOrCreateConversation(seekerId: number, employerId: number, jobId?: number | null): Promise<Conversation>;
  getConversations(userId: number): Promise<(Conversation & { otherPartyName: string; lastMessage: string | null; unreadCount: number })[]>;
  getMessages(conversationId: number): Promise<Message[]>;
  createMessage(conversationId: number, senderId: number, content: string): Promise<Message>;
  markConversationRead(conversationId: number, userId: number): Promise<void>;
  getUnreadMessageCount(userId: number): Promise<number>;
  getConversationUnreadCount(conversationId: number, recipientId: number): Promise<number>;
  getConversation(conversationId: number): Promise<Conversation | undefined>;

  // Employer enriched applicants
  getEmployerApplicationsEnriched(employerId: number): Promise<(Application & { seekerName: string; seekerEmail: string; seekerVerificationStatus: string | null; employerNotes?: string | null })[]>;

  // Job Alert Subscriptions
  getJobAlerts(userId: number): Promise<JobAlertSubscription[]>;
  createJobAlert(data: InsertJobAlertSubscription): Promise<JobAlertSubscription>;
  deleteJobAlert(id: number, userId: number): Promise<void>;
  getAllJobAlerts(): Promise<JobAlertSubscription[]>;
  updateJobAlertNotifiedAt(id: number, notifiedAt: Date): Promise<void>;
  updateJobAlert(id: number, userId: number, updates: { isActive?: boolean; name?: string }): Promise<JobAlertSubscription>;

  // Email Cron Configs
  getEmailCronConfigs(): Promise<EmailCronConfig[]>;
  getEmailCronConfig(id: number): Promise<EmailCronConfig | undefined>;
  getEmailCronConfigByName(name: string): Promise<EmailCronConfig | undefined>;
  createEmailCronConfig(config: InsertEmailCronConfig): Promise<EmailCronConfig>;
  updateEmailCronConfig(id: number, updates: Partial<InsertEmailCronConfig>): Promise<EmailCronConfig>;
  deleteEmailCronConfig(id: number): Promise<void>;
  touchEmailCronConfigLastRun(id: number): Promise<void>;

  // Admin Profile
  getAdminUsers(): Promise<User[]>;
  updateLastLoginAt(id: number): Promise<void>;
  getNotificationPreferences(id: number): Promise<Record<string, boolean>>;
  updateNotificationPreferences(id: number, prefs: Record<string, boolean>): Promise<void>;
  inviteAdminUser(email: string, firstName: string, lastName: string, tempPassword: string, permissions: string[] | null): Promise<User>;
  updateAdminUserRole(id: number, role: string): Promise<User>;

  // Menus
  getMenus(): Promise<Menu[]>;
  getMenuById(id: number): Promise<Menu | undefined>;
  getMenuBySlug(slug: string): Promise<Menu | undefined>;
  createMenu(data: InsertMenu): Promise<Menu>;
  updateMenu(id: number, data: Partial<InsertMenu>): Promise<Menu>;
  deleteMenu(id: number): Promise<void>;
  getMenuItems(menuId: number): Promise<MenuItem[]>;
  createMenuItem(data: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: number, data: Partial<InsertMenuItem>): Promise<MenuItem>;
  deleteMenuItem(id: number): Promise<void>;
  reorderMenuItems(items: { id: number; sortOrder: number; parentId: number | null }[]): Promise<void>;
  menuSlugExists(slug: string, excludeId?: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Users
  getUser = userStorage.getUser;
  getUserByEmail = userStorage.getUserByEmail;
  getUserByEmailVerificationToken = userStorage.getUserByEmailVerificationToken;
  getUserByPasswordResetToken = userStorage.getUserByPasswordResetToken;
  getUsers = userStorage.getUsers;
  createUser = userStorage.createUser;
  findOrCreateEmployerByCompanyName = userStorage.findOrCreateEmployerByCompanyName;
  updateUser = userStorage.updateUser;
  deleteUser = userStorage.deleteUser;

  // Jobs
  getJobs = jobStorage.getJobs;
  getJob = jobStorage.getJob;
  createJob = jobStorage.createJob;
  updateJob = jobStorage.updateJob;
  deleteJob = jobStorage.deleteJob;

  // Applications
  getApplications = applicationStorage.getApplications;
  updateApplication = applicationStorage.updateApplication;
  deleteApplication = applicationStorage.deleteApplication;
  getApplicationsBySeeker = applicationStorage.getApplicationsBySeeker;
  markApplicationViewed = applicationStorage.markApplicationViewed;
  createApplication = applicationStorage.createApplication;

  // Saved Jobs
  getSavedJobsBySeeker = savedJobStorage.getSavedJobsBySeeker;
  saveJob = savedJobStorage.saveJob;
  unsaveJob = savedJobStorage.unsaveJob;

  // Resources
  getResources = resourceStorage.getResources;
  getResource = resourceStorage.getResource;
  getResourceBySlug = resourceStorage.getResourceBySlug;
  createResource = resourceStorage.createResource;
  updateResource = resourceStorage.updateResource;
  deleteResource = resourceStorage.deleteResource;

  // Blog
  getBlogPosts = blogStorage.getBlogPosts;
  getBlogPost = blogStorage.getBlogPost;
  getBlogPostBySlug = blogStorage.getBlogPostBySlug;
  createBlogPost = blogStorage.createBlogPost;
  updateBlogPost = blogStorage.updateBlogPost;
  deleteBlogPost = blogStorage.deleteBlogPost;

  // Resumes
  getResumes = resumeStorage.getResumes;
  createResume = resumeStorage.createResume;

  // Categories
  getCategories = categoryStorage.getCategories;
  createCategory = categoryStorage.createCategory;
  deleteCategory = categoryStorage.deleteCategory;

  // Coupons
  getCoupons = couponStorage.getCoupons;
  getCoupon = couponStorage.getCoupon;
  getCouponByCode = couponStorage.getCouponByCode;
  createCoupon = couponStorage.createCoupon;
  updateCoupon = couponStorage.updateCoupon;
  deleteCoupon = couponStorage.deleteCoupon;
  incrementCouponUses = couponStorage.incrementCouponUses;

  // Pages
  getPages = pageStorage.getPages;
  getPage = pageStorage.getPage;
  getPageBySlug = pageStorage.getPageBySlug;
  createPage = pageStorage.createPage;
  updatePage = pageStorage.updatePage;
  deletePage = pageStorage.deletePage;

  // Import Runs
  upsertJobByExternalKey = importRunStorage.upsertJobByExternalKey;
  createImportRun = importRunStorage.createImportRun;
  updateImportRun = importRunStorage.updateImportRun;
  getImportRun = importRunStorage.getImportRun;
  getImportRuns = importRunStorage.getImportRuns;
  createImportArtifact = importRunStorage.createImportArtifact;
  getImportArtifact = importRunStorage.getImportArtifact;

  // Social Posts
  createSocialPost = socialPostStorage.createSocialPost;
  getSocialPost = socialPostStorage.getSocialPost;
  listSocialPosts = socialPostStorage.listSocialPosts;
  updateSocialPost = socialPostStorage.updateSocialPost;
  deleteSocialPost = socialPostStorage.deleteSocialPost;

  // Site Settings
  getSiteSettings = siteSettingsStorage.getSiteSettings;
  updateSiteSettings = siteSettingsStorage.updateSiteSettings;

  // Email Templates
  getEmailTemplates = emailTemplateStorage.getEmailTemplates;
  getEmailTemplateBySlug = emailTemplateStorage.getEmailTemplateBySlug;
  upsertEmailTemplate = emailTemplateStorage.upsertEmailTemplate;

  // Admin Products
  getAdminProducts = adminProductStorage.getAdminProducts;
  getAdminProduct = adminProductStorage.getAdminProduct;
  createAdminProduct = adminProductStorage.createAdminProduct;
  updateAdminProduct = adminProductStorage.updateAdminProduct;
  deleteAdminProduct = adminProductStorage.deleteAdminProduct;

  // Admin Entitlements
  getAdminEntitlements = adminEntitlementStorage.getAdminEntitlements;
  getAdminEntitlement = adminEntitlementStorage.getAdminEntitlement;
  createAdminEntitlement = adminEntitlementStorage.createAdminEntitlement;
  updateAdminEntitlement = adminEntitlementStorage.updateAdminEntitlement;
  deleteAdminEntitlement = adminEntitlementStorage.deleteAdminEntitlement;

  // Admin Product Overrides
  getAdminProductOverrides = adminOverrideStorage.getAdminProductOverrides;
  getAdminProductOverride = adminOverrideStorage.getAdminProductOverride;
  createAdminProductOverride = adminOverrideStorage.createAdminProductOverride;
  updateAdminProductOverride = adminOverrideStorage.updateAdminProductOverride;
  deleteAdminProductOverride = adminOverrideStorage.deleteAdminProductOverride;

  // Admin Product Entitlements (join table)
  getAdminProductEntitlements = adminProductEntitlementStorage.getAdminProductEntitlements;
  setAdminProductEntitlements = adminProductEntitlementStorage.setAdminProductEntitlements;

  // Migration State
  getMigrationState = migrationStateStorage.getMigrationState;
  setMigrationState = migrationStateStorage.setMigrationState;

  // Entitlement Usage Windows
  getOrCreateUsageWindow = entitlementUsageStorage.getOrCreateUsageWindow;
  incrementUsageWindow = entitlementUsageStorage.incrementUsageWindow;
  incrementUsageWindowAtomic = entitlementUsageStorage.incrementUsageWindowAtomic;

  // Entitlement Credit Grants
  createCreditGrant = entitlementCreditStorage.createCreditGrant;
  getActiveCreditGrants = entitlementCreditStorage.getActiveCreditGrants;
  consumeCreditFromGrant = entitlementCreditStorage.consumeCreditFromGrant;
  createCreditConsumption = entitlementCreditStorage.createCreditConsumption;
  getUserCreditSummary = entitlementCreditStorage.getUserCreditSummary;
  getCreditGrantByPaymentIntent = entitlementCreditStorage.getCreditGrantByPaymentIntent;

  // Job Sources
  getJobSources = jobSourceStorage.getJobSources;
  getJobSource = jobSourceStorage.getJobSource;
  createJobSource = jobSourceStorage.createJobSource;
  updateJobSource = jobSourceStorage.updateJobSource;
  getActiveJobSourcesDueForPoll = jobSourceStorage.getActiveJobSourcesDueForPoll;
  claimJobSourceForRun = jobSourceStorage.claimJobSourceForRun;
  deleteJobSource = jobSourceStorage.deleteJobSource;
  getActiveRunCountForSource = jobSourceStorage.getActiveRunCountForSource;

  // Import Targets
  getImportTargets = importTargetStorage.getImportTargets;
  getImportTarget = importTargetStorage.getImportTarget;
  upsertImportTarget = importTargetStorage.upsertImportTarget;
  updateImportTarget = importTargetStorage.updateImportTarget;
  getJobCountByImportTarget = importTargetStorage.getJobCountByImportTarget;
  getPendingImportTargetsCount = importTargetStorage.getPendingImportTargetsCount;
  bulkUpdateImportTargets = importTargetStorage.bulkUpdateImportTargets;
  getImportTargetsWithSource = importTargetStorage.getImportTargetsWithSource;

  // Job Import Runs
  createJobImportRun = jobImportRunStorage.createJobImportRun;
  updateJobImportRun = jobImportRunStorage.updateJobImportRun;
  getJobImportRuns = jobImportRunStorage.getJobImportRuns;
  getJobImportRun = jobImportRunStorage.getJobImportRun;
  getJobImportRunsFiltered = jobImportRunStorage.getJobImportRunsFiltered;
  getJobsForImportRun = jobImportRunStorage.getJobsForImportRun;

  // Apify job upsert
  upsertImportedJob = apifyJobStorage.upsertImportedJob;
  expireJobsNotInSet = apifyJobStorage.expireJobsNotInSet;
  expireJobsByImportTarget = apifyJobStorage.expireJobsByImportTarget;

  // Employer Verification
  getActiveVerificationRequest = employerVerificationStorage.getActiveVerificationRequest;
  getLatestVerificationRequest = employerVerificationStorage.getLatestVerificationRequest;
  getOrCreateVerificationRequest = employerVerificationStorage.getOrCreateVerificationRequest;
  getVerificationRequestsByStatus = employerVerificationStorage.getVerificationRequestsByStatus;
  updateVerificationRequestStatus = employerVerificationStorage.updateVerificationRequestStatus;
  createEvidenceItem = employerVerificationStorage.createEvidenceItem;
  getEvidenceItemsByRequest = employerVerificationStorage.getEvidenceItemsByRequest;
  updateEmployerVerificationStatus = employerVerificationStorage.updateEmployerVerificationStatus;

  // Seeker Credential Verification
  getSeekerCredentialRequirements = seekerVerificationStorage.getSeekerCredentialRequirements;
  upsertSeekerCredentialRequirement = seekerVerificationStorage.upsertSeekerCredentialRequirement;
  getSeekerRequirementRules = seekerVerificationStorage.getSeekerRequirementRules;
  upsertSeekerRequirementRule = seekerVerificationStorage.upsertSeekerRequirementRule;
  getActiveSeekerVerificationRequest = seekerVerificationStorage.getActiveSeekerVerificationRequest;
  getLatestSeekerVerificationRequest = seekerVerificationStorage.getLatestSeekerVerificationRequest;
  getOrCreateSeekerVerificationRequest = seekerVerificationStorage.getOrCreateSeekerVerificationRequest;
  appendRequirementsSnapshot = seekerVerificationStorage.appendRequirementsSnapshot;
  getSeekerVerificationRequestsByStatus = seekerVerificationStorage.getSeekerVerificationRequestsByStatus;
  updateSeekerVerificationRequestStatus = seekerVerificationStorage.updateSeekerVerificationRequestStatus;
  createSeekerEvidenceItem = seekerVerificationStorage.createSeekerEvidenceItem;
  getSeekerEvidenceItemsByRequest = seekerVerificationStorage.getSeekerEvidenceItemsByRequest;
  updateSeekerVerificationStatus = seekerVerificationStorage.updateSeekerVerificationStatus;

  // Messaging
  getOrCreateConversation = messagingStorage.getOrCreateConversation;
  getConversations = messagingStorage.getConversations;
  getMessages = messagingStorage.getMessages;
  createMessage = messagingStorage.createMessage;
  markConversationRead = messagingStorage.markConversationRead;
  getUnreadMessageCount = messagingStorage.getUnreadMessageCount;
  getConversationUnreadCount = messagingStorage.getConversationUnreadCount;
  getConversation = messagingStorage.getConversation;

  // Employer enriched applicants
  getEmployerApplicationsEnriched = enrichedApplicantStorage.getEmployerApplicationsEnriched;

  // Job Alert Subscriptions
  getJobAlerts = jobAlertStorage.getJobAlerts;
  createJobAlert = jobAlertStorage.createJobAlert;
  deleteJobAlert = jobAlertStorage.deleteJobAlert;
  getAllJobAlerts = jobAlertStorage.getAllJobAlerts;
  updateJobAlertNotifiedAt = jobAlertStorage.updateJobAlertNotifiedAt;
  updateJobAlert = jobAlertStorage.updateJobAlert;

  // Email Cron Configs
  getEmailCronConfigs = emailCronStorage.getEmailCronConfigs;
  getEmailCronConfig = emailCronStorage.getEmailCronConfig;
  getEmailCronConfigByName = emailCronStorage.getEmailCronConfigByName;
  createEmailCronConfig = emailCronStorage.createEmailCronConfig;
  updateEmailCronConfig = emailCronStorage.updateEmailCronConfig;
  deleteEmailCronConfig = emailCronStorage.deleteEmailCronConfig;
  touchEmailCronConfigLastRun = emailCronStorage.touchEmailCronConfigLastRun;

  // Admin Profile
  getAdminUsers = adminProfileStorage.getAdminUsers;
  updateLastLoginAt = adminProfileStorage.updateLastLoginAt;
  getNotificationPreferences = adminProfileStorage.getNotificationPreferences;
  updateNotificationPreferences = adminProfileStorage.updateNotificationPreferences;
  inviteAdminUser = adminProfileStorage.inviteAdminUser;
  updateAdminUserRole = adminProfileStorage.updateAdminUserRole;

  // Menus
  getMenus = menuStorage.getMenus;
  getMenuById = menuStorage.getMenuById;
  getMenuBySlug = menuStorage.getMenuBySlug;
  createMenu = menuStorage.createMenu;
  updateMenu = menuStorage.updateMenu;
  deleteMenu = menuStorage.deleteMenu;
  getMenuItems = menuStorage.getMenuItems;
  createMenuItem = menuStorage.createMenuItem;
  updateMenuItem = menuStorage.updateMenuItem;
  deleteMenuItem = menuStorage.deleteMenuItem;
  reorderMenuItems = menuStorage.reorderMenuItems;
  menuSlugExists = menuStorage.menuSlugExists;

  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return db.transaction(fn);
  }
}

export const storage = new DatabaseStorage();
