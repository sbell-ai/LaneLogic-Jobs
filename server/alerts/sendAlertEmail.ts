function mailgunBaseUrl() {
  const region = (process.env.MAILGUN_REGION || "us").toLowerCase();
  return region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
}

export async function sendAlertEmail(args: { subject: string; text: string; html?: string }) {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;

  const from = process.env.ALERT_EMAIL_FROM;
  const to = process.env.ALERT_EMAIL_TO;
  const cc = process.env.ALERT_EMAIL_CC;

  if (!apiKey || !domain || !from || !to) {
    throw new Error("Missing MAILGUN_* or ALERT_EMAIL_* env vars");
  }

  const params = new URLSearchParams();
  params.set("from", from);
  params.set("to", to);
  if (cc) params.set("cc", cc);
  params.set("subject", args.subject);
  params.set("text", args.text);
  if (args.html) params.set("html", args.html);

  const url = `${mailgunBaseUrl()}/v3/${domain}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`api:${apiKey}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Mailgun send failed: ${res.status} ${bodyText}`);
  }
}