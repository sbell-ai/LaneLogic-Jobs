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

  // Payments / Stripe
  app.post("/api/payments/create-checkout-session", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { tier } = req.body;
    if (!tier || !["basic", "premium"].includes(tier)) {
      return res.status(400).json({ message: "Invalid tier" });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return res.status(503).json({ message: "Payment system not configured. Please connect Stripe." });
    }

    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-01-27.acacia" });

      const user = req.user as any;
      const priceMap: Record<string, Record<string, number>> = {
        job_seeker: { basic: 1900, premium: 4900 },
        employer: { basic: 7900, premium: 19900 },
      };
      const unitAmount = priceMap[user.role]?.[tier] || 1900;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        customer_email: user.email,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `TranspoJobs ${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan` },
              unit_amount: unitAmount,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        success_url: `${req.protocol}://${req.get("host")}/dashboard/membership?success=true`,
        cancel_url: `${req.protocol}://${req.get("host")}/pricing`,
        metadata: { userId: String(user.id), tier },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Stripe error:", err);
      res.status(500).json({ message: err.message || "Payment error" });
    }
  });

  app.post("/api/payments/webhook", async (req, res) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeSecretKey) return res.status(503).json({ message: "Not configured" });

    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-01-27.acacia" });

      let event: any;
      if (webhookSecret) {
        const sig = req.headers["stripe-signature"] as string;
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        event = req.body;
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const { userId, tier } = session.metadata || {};
        if (userId && tier) {
          await storage.updateUser(Number(userId), {
            membershipTier: tier,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          } as any);
        }
      }

      res.json({ received: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
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
      description: "Looking for an experienced long haul driver. Routes across the midwest.",
      requirements: "CDL Class A, 5+ years experience",
      location: "Chicago, IL",
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