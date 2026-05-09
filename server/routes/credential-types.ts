import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { credentialTypes, MODAL_NAMESPACES, type ModalNamespace } from "@shared/schema";

const router = Router();

// GET /api/credential-types?namespace=trucking
// Public read. Returns active credential types, optionally filtered by modal namespace.
router.get("/api/credential-types", async (req, res) => {
  try {
    const namespaceParam = typeof req.query.namespace === "string" ? req.query.namespace : null;
    if (namespaceParam && !MODAL_NAMESPACES.includes(namespaceParam as ModalNamespace)) {
      return res.status(400).json({ error: "Invalid namespace" });
    }

    const rows = namespaceParam
      ? await db.select().from(credentialTypes).where(
          and(
            eq(credentialTypes.isActive, true),
            eq(credentialTypes.modalNamespace, namespaceParam as ModalNamespace),
          ),
        )
      : await db.select().from(credentialTypes).where(eq(credentialTypes.isActive, true));

    return res.json(rows);
  } catch (err) {
    console.error("GET /api/credential-types error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
