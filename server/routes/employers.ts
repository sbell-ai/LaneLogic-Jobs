import { Router } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/api/employers", async (_req, res) => {
  try {
    const allUsers = await storage.getUsers();
    const allJobs = await storage.getJobs();

    const employerMap = new Map<string, {
      id: number | null;
      companyName: string;
      companyLogo: string | null;
      claimed: boolean;
      verificationStatus: string | null;
      jobCount: number;
      industries: Set<string>;
      locations: Set<string>;
      createdAt: Date | null;
    }>();

    const registeredEmployers = allUsers.filter((u) => u.role === "employer");
    for (const u of registeredEmployers) {
      const name = (u.companyName || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      employerMap.set(key, {
        id: u.id,
        companyName: name,
        companyLogo: u.companyLogo,
        claimed: true,
        verificationStatus: u.verificationStatus || null,
        jobCount: 0,
        industries: new Set(),
        locations: new Set(),
        createdAt: u.createdAt,
      });
    }

    for (const job of allJobs) {
      const name = (job.companyName || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();

      if (!employerMap.has(key)) {
        employerMap.set(key, {
          id: null,
          companyName: name,
          companyLogo: null,
          claimed: false,
          verificationStatus: null,
          jobCount: 0,
          industries: new Set(),
          locations: new Set(),
          createdAt: job.createdAt,
        });
      }

      const entry = employerMap.get(key)!;
      entry.jobCount++;
      if (job.industry) entry.industries.add(job.industry);
      const loc = [job.locationCity, job.locationState].filter(Boolean).join(", ");
      if (loc) entry.locations.add(loc);
    }

    const employers = [...employerMap.values()]
      .map((e) => ({
        id: e.id,
        companyName: e.companyName,
        companyLogo: e.companyLogo,
        claimed: e.claimed,
        verificationStatus: e.verificationStatus,
        jobCount: e.jobCount,
        industries: [...e.industries],
        locations: [...e.locations],
        createdAt: e.createdAt,
      }))
      .sort((a, b) => b.jobCount - a.jobCount);

    res.json(employers);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/api/employers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid employer id" });
    const employer = await storage.getUser(id);
    if (!employer || employer.role !== "employer") return res.status(404).json({ message: "Employer not found" });
    const allJobs = await storage.getJobs();
    const jobs = allJobs.filter(j => j.employerId === id && j.isPublished);
    const industries = [...new Set(jobs.map(j => j.industry).filter(Boolean))];
    const locations = [...new Set(jobs.map(j => [j.locationCity, j.locationState].filter(Boolean).join(", ")).filter(Boolean))];
    res.json({
      id: employer.id,
      companyName: employer.companyName,
      companyLogo: employer.companyLogo,
      companyAddress: employer.showProfile ? employer.companyAddress : null,
      contactName: employer.showProfile ? employer.contactName : null,
      contactEmail: employer.showProfile ? employer.contactEmail : null,
      contactPhone: employer.showProfile ? employer.contactPhone : null,
      aboutCompany: employer.aboutCompany,
      claimed: !!employer.companyName,
      verificationStatus: employer.verificationStatus || null,
      industries,
      locations,
      jobs: jobs.map(j => ({
        id: j.id,
        title: j.title,
        jobType: j.jobType,
        locationCity: j.locationCity,
        locationState: j.locationState,
        workLocationType: j.workLocationType,
        salary: j.salary,
        category: j.category,
        expiresAt: j.expiresAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
