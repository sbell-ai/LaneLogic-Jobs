// server/email/templateEngine.ts
// Replaces {{variable}} tokens in a string with provided values.
// Unknown tokens are left as-is so admins can spot missing vars in test sends.

export interface TemplateVars {
  [key: string]: string | number | undefined;
}

/**
 * Renders a template string by replacing all {{key}} tokens with values.
 * - Unknown tokens are preserved (not removed) so they appear visibly in test emails.
 * - Trims whitespace around token keys: {{ first_name }} === {{first_name}}
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = vars[key];
    if (value === undefined || value === null) {
      // Leave unresolved tokens visible — helps admins catch missing vars
      return `{{${key}}}`;
    }
    return String(value);
  });
}

/**
 * Renders both the subject and body of a template.
 * Returns the rendered subject and body as plain strings.
 */
export function renderEmailTemplate(
  subject: string,
  body: string,
  vars: TemplateVars
): { subject: string; body: string } {
  return {
    subject: renderTemplate(subject, vars),
    body: renderTemplate(body, vars),
  };
}
