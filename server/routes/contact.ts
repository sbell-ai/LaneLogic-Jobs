import { Router } from "express";

const router = Router();

// Contact form rate limiting (5 requests per IP per 15 minutes)
const contactRateMap = new Map<string, number[]>();
function checkContactRate(ip: string): boolean {
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const attempts = (contactRateMap.get(ip) || []).filter(t => now - t < window);
  if (attempts.length >= 5) return false;
  attempts.push(now);
  contactRateMap.set(ip, attempts);
  return true;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Contact form — send email via Mailgun
router.post("/api/contact", async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  if (!checkContactRate(clientIp)) {
    return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
  }

  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: "Invalid email format" });
  }

  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) {
    console.error("Mailgun credentials not configured");
    return res.status(500).json({ success: false, message: "Email service not configured" });
  }

  try {
    const FormData = (await import("form-data")).default;
    const Mailgun = (await import("mailgun.js")).default;
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({ username: "api", key: apiKey });

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    await mg.messages.create(domain, {
      from: `${safeName} <noreply@${domain}>`,
      to: [`contact@${domain}`],
      "h:Reply-To": email,
      subject: `[Contact Form] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
      html: `<h3>New Contact Form Submission</h3>
<p><strong>Name:</strong> ${safeName}</p>
<p><strong>Email:</strong> ${safeEmail}</p>
<p><strong>Subject:</strong> ${safeSubject}</p>
<hr/>
<p>${safeMessage.replace(/\n/g, "<br/>")}</p>`,
    });

    res.json({ success: true, message: "Message sent successfully!" });
  } catch (error: any) {
    console.error("Mailgun error:", error?.message || error);
    res.status(500).json({ success: false, message: "Failed to send message. Please try again later." });
  }
});

export default router;
