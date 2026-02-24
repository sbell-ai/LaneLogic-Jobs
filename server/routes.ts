import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session setup
  app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecret',
    resave: false,
    saveUninitialized: false,
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const user = await storage.getUserByEmail(email);
      if (!user || user.password !== password) {
        return done(null, false, { message: 'Incorrect email or password.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Auth Routes
  app.post(api.auth.login.path, passport.authenticate('local'), (req, res) => {
    res.json(req.user);
  });

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existing = await storage.getUserByEmail(input.email);
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }
      const user = await storage.createUser(input);
      req.login(user, (err) => {
        if (err) throw err;
        res.status(201).json(user);
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout((err) => {
      res.json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // Users
  app.get(api.users.list.path, async (req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  // Admin: create a user directly (invite)
  app.post("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const { email, password, role, firstName, lastName, companyName, membershipTier } = req.body;
      if (!email || !password || !role) {
        return res.status(400).json({ message: "email, password and role are required" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already in use" });
      }
      const user = await storage.createUser({
        email,
        password,
        role,
        firstName: firstName || null,
        lastName: lastName || null,
        companyName: companyName || null,
        membershipTier: membershipTier || "free",
      });
      res.status(201).json(user);
    } catch (err) {
      res.status(500).json({ message: "Could not create user" });
    }
  });

  app.put(api.users.update.path, async (req, res) => {
    try {
      const input = api.users.update.input.parse(req.body);
      const user = await storage.updateUser(Number(req.params.id), input);
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Jobs
  app.get(api.jobs.list.path, async (req, res) => {
    const jobs = await storage.getJobs();
    res.json(jobs);
  });

  app.get(api.jobs.get.path, async (req, res) => {
    const job = await storage.getJob(Number(req.params.id));
    if (!job) return res.status(404).json({ message: "Not found" });
    res.json(job);
  });

  app.post(api.jobs.create.path, async (req, res) => {
    try {
      const input = api.jobs.create.input.parse(req.body);
      const job = await storage.createJob(input);
      res.status(201).json(job);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(api.jobs.update.path, async (req, res) => {
    try {
      const input = api.jobs.update.input.parse(req.body);
      const job = await storage.updateJob(Number(req.params.id), input);
      res.json(job);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.jobs.delete.path, async (req, res) => {
    await storage.deleteJob(Number(req.params.id));
    res.status(204).end();
  });

  // Applications
  app.get(api.applications.list.path, async (req, res) => {
    const apps = await storage.getApplications();
    res.json(apps);
  });

  app.post(api.applications.create.path, async (req, res) => {
    try {
      const input = api.applications.create.input.parse(req.body);
      const appData = await storage.createApplication(input);
      res.status(201).json(appData);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(api.applications.update.path, async (req, res) => {
    try {
      const input = api.applications.update.input.parse(req.body);
      const appData = await storage.updateApplication(Number(req.params.id), input);
      res.json(appData);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Resources
  app.get(api.resources.list.path, async (req, res) => {
    const resources = await storage.getResources();
    res.json(resources);
  });

  app.post(api.resources.create.path, async (req, res) => {
    try {
      const input = api.resources.create.input.parse(req.body);
      const resource = await storage.createResource(input);
      res.status(201).json(resource);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // Blog
  app.get(api.blog.list.path, async (req, res) => {
    const posts = await storage.getBlogPosts();
    res.json(posts);
  });

  app.get(api.blog.get.path, async (req, res) => {
    const post = await storage.getBlogPost(Number(req.params.id));
    if (!post) return res.status(404).json({ message: "Not found" });
    res.json(post);
  });

  app.post(api.blog.create.path, async (req, res) => {
    try {
      const input = api.blog.create.input.parse(req.body);
      const post = await storage.createBlogPost(input);
      res.status(201).json(post);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // Resumes
  app.get(api.resumes.get.path, async (req, res) => {
    const userResumes = await storage.getResumes(Number(req.params.jobSeekerId));
    res.json(userResumes);
  });

  app.post(api.resumes.create.path, async (req, res) => {
    try {
      const input = api.resumes.create.input.parse(req.body);
      const resume = await storage.createResume(input);
      res.status(201).json(resume);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  app.post(api.uploads.csv.path, (req, res) => {
    res.json({ message: "CSV uploaded successfully", count: 10 });
  });

  // Stripe public key (for frontend)
  app.get("/api/payments/config", async (req, res) => {
    try {
      const { getStripePublishableKey } = await import("./stripeClient");
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch {
      res.status(503).json({ message: "Payment system not configured." });
    }
  });

  // Create Stripe checkout session using real price IDs from stripe.prices table
  app.post("/api/payments/create-checkout-session", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { tier } = req.body;
    if (!tier || !["basic", "premium"].includes(tier)) {
      return res.status(400).json({ message: "Invalid tier" });
    }

    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const user = req.user as any;

      // Look up the matching price from stripe.prices (synced by stripe-replit-sync)
      // Products/prices are created by the seed-products script
      const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
      const roleLabel = user.role === "employer" ? "Employer" : "Job Seeker";
      const productName = `TranspoJobs ${tierLabel} - ${roleLabel}`;

      // Search for the product in Stripe
      const products = await stripe.products.search({ query: `name:'${productName}' AND active:'true'` });

      let priceId: string | null = null;

      if (products.data.length > 0) {
        const prices = await stripe.prices.list({ product: products.data[0].id, active: true, limit: 1 });
        if (prices.data.length > 0) priceId = prices.data[0].id;
      }

      // Fallback: use price_data inline if no pre-created products found
      const priceMap: Record<string, Record<string, number>> = {
        job_seeker: { basic: 1900, premium: 4900 },
        employer: { basic: 7900, premium: 19900 },
      };
      const unitAmount = priceMap[user.role]?.[tier] || 1900;

      const lineItems = priceId
        ? [{ price: priceId, quantity: 1 }]
        : [{
            price_data: {
              currency: "usd",
              product_data: { name: productName },
              unit_amount: unitAmount,
              recurring: { interval: "month" as const },
            },
            quantity: 1,
          }];

      // Create or retrieve Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: String(user.id) },
        });
        customerId = customer.id;
        await storage.updateUser(user.id, { stripeCustomerId: customerId } as any);
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: lineItems,
        success_url: `${req.protocol}://${req.get("host")}/dashboard/membership?success=true`,
        cancel_url: `${req.protocol}://${req.get("host")}/pricing`,
        metadata: { userId: String(user.id), tier },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Stripe checkout error:", err);
      res.status(500).json({ message: err.message || "Payment error" });
    }
  });

  // Customer portal (manage subscription)
  app.post("/api/payments/portal", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as any;
    if (!user.stripeCustomerId) return res.status(400).json({ message: "No active subscription" });

    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${req.protocol}://${req.get("host")}/dashboard/membership`,
      });
      res.json({ url: session.url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Site Settings
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Could not load settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const settings = await storage.updateSiteSettings(req.body);
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Could not save settings" });
    }
  });

  // Seed database
  seedDatabase().catch(console.error);

  return httpServer;
}

async function seedDatabase() {
  const users = await storage.getUsers();
  if (users.length === 0) {
    const admin = await storage.createUser({
      email: "admin@transportjobs.com",
      password: "password123",
      role: "admin",
      membershipTier: "premium",
      firstName: "Admin",
      lastName: "User"
    });
    
    const employer = await storage.createUser({
      email: "employer@trucking.com",
      password: "password123",
      role: "employer",
      membershipTier: "premium",
      companyName: "Fast Trucking Co."
    });

    const seeker = await storage.createUser({
      email: "seeker@example.com",
      password: "password123",
      role: "job_seeker",
      membershipTier: "basic",
      firstName: "John",
      lastName: "Driver"
    });

    await storage.createJob({
      employerId: employer.id,
      title: "Long Haul Truck Driver",
      companyName: "Fast Trucking Co.",
      jobType: "Full-time",
      description: "Looking for an experienced long haul driver. Routes across the midwest.",
      requirements: "CDL Class A, 5+ years experience",
      benefits: "Health insurance, 401k, paid time off",
      locationCity: "Chicago",
      locationState: "IL",
      locationCountry: "USA",
      salary: "$80,000 - $100,000"
    });

    await storage.createBlogPost({
      authorId: admin.id,
      title: "The Future of Transportation Jobs",
      content: "As automation increases, the role of the driver is changing..."
    });

    await storage.createResource({
      title: "Resume Tips for Truck Drivers",
      content: "Make sure to highlight your accident-free miles and certifications.",
      targetAudience: "job_seeker",
      requiredTier: "free"
    });
  }
}