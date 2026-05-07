import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// ── Messaging ───────────────────────────────────────────────────────────────

// GET /api/conversations – list my conversations
router.get("/api/conversations", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const userId = (req.user as any).id;
  const convs = await storage.getConversations(userId);
  res.json(convs);
});

// GET /api/conversations/unread-count – unread badge count
router.get("/api/conversations/unread-count", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const count = await storage.getUnreadMessageCount((req.user as any).id);
  res.json({ count });
});

// POST /api/conversations – get or create a conversation
router.post("/api/conversations", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { seekerId, employerId, jobId } = req.body;
  if (!seekerId || !employerId) return res.status(400).json({ error: "seekerId and employerId required" });
  const conv = await storage.getOrCreateConversation(Number(seekerId), Number(employerId), jobId ? Number(jobId) : null);
  res.json(conv);
});

// GET /api/conversations/:id/messages
router.get("/api/conversations/:id/messages", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const userId = (req.user as any).id;
  const convId = Number(req.params.id);
  const conv = await storage.getConversation(convId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (conv.seekerId !== userId && conv.employerId !== userId) return res.status(403).json({ error: "Forbidden" });
  const msgs = await storage.getMessages(convId);
  res.json(msgs);
});

// POST /api/conversations/:id/messages – send a message
router.post("/api/conversations/:id/messages", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const userId = (req.user as any).id;
  const convId = Number(req.params.id);
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Content required" });
  const conv = await storage.getConversation(convId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (conv.seekerId !== userId && conv.employerId !== userId) return res.status(403).json({ error: "Forbidden" });
  // Check unread count BEFORE inserting so we know if the recipient was already
  // waiting on unread messages. If they were, they already got a notification
  // email for this thread — skip sending another to avoid inbox spam.
  const recipientId = conv.seekerId === userId ? conv.employerId : conv.seekerId;
  const existingUnread = await storage.getConversationUnreadCount(convId, recipientId);

  const msg = await storage.createMessage(convId, userId, content.trim());

  // Email notification to recipient via template (fire-and-forget)
  // Only fires when the recipient had no prior unread messages in this thread.
  if (existingUnread === 0) {
    const [sender, recipient] = await Promise.all([
      storage.getUser(userId),
      storage.getUser(recipientId),
    ]);
    if (sender && recipient) {
      (async () => {
        try {
          const { sendTemplatedEmailByEvent } = await import("../email/sendTemplatedEmail.ts");
          const senderName = [(sender as any).firstName, (sender as any).lastName].filter(Boolean).join(" ") || (sender as any).companyName || (sender as any).email;
          const preview = content.trim().slice(0, 200);
          const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
          await sendTemplatedEmailByEvent("message_sent", (recipient as any).email, {
            first_name: (recipient as any).firstName || (recipient as any).email,
            sender_name: senderName,
            message_preview: preview,
            inbox_url: `${siteUrl}/dashboard/messages`,
            site_url: siteUrl,
          });
        } catch (e: any) {
          console.error("Messaging email notification failed:", e?.message);
        }
      })();
    }
  }

  res.json(msg);
});

// POST /api/conversations/:id/read – mark as read
router.post("/api/conversations/:id/read", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const userId = (req.user as any).id;
  const convId = Number(req.params.id);
  const conv = await storage.getConversation(convId);
  if (!conv) return res.status(404).json({ error: "Not found" });
  if (conv.seekerId !== userId && conv.employerId !== userId) return res.status(403).json({ error: "Forbidden" });
  await storage.markConversationRead(convId, userId);
  res.json({ ok: true });
});

export default router;
