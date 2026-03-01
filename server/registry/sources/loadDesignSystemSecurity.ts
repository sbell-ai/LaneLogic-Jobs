import fs from "node:fs/promises";
import path from "node:path";

export async function loadDesignSystemSecurityFromLocalFile() {
  const filePath = path.join(process.cwd(), "server/registry/sources/designSystemSecurity.local.json");
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as { registry: string; rules: any[] };
}