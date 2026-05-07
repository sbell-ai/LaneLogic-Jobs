import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";

const router = Router();

// Users
router.get(api.users.list.path, async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const users = await storage.getUsers();
  res.json(users);
});

// Admin: create a user directly (invite)
router.post("/api/admin/users", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
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

router.put(api.users.update.path, async (req, res) => {
  if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Unauthorized" });
  const caller = req.user as any;
  const targetId = Number(req.params.id);
  if (caller.role !== "admin" && caller.id !== targetId) {
    return res.status(403).json({ message: "Forbidden" });
  }
  try {
    const input = api.users.update.input.parse(req.body);
    const user = await storage.updateUser(targetId, input);
    res.json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

// User delete
router.delete("/api/users/:id", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  await storage.deleteUser(Number(req.params.id));
  res.json({ message: "Deleted" });
});

export default router;
