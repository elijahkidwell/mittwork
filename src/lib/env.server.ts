import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;
function loadDotEnv() {
  if (loaded) return;
  loaded = true;
  const files = [resolve(process.cwd(), ".env"), "/workspace/.env"];
  for (const file of files) {
    try {
      const text = readFileSync(file, "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] == null || process.env[key] === "") process.env[key] = val;
      }
    } catch {
      /* try next path */
    }
  }
}

export function env(key: string): string | undefined {
  loadDotEnv();
  const v = process.env[key]?.trim();
  return v || undefined;
}

/**
 * Workspace preview vs deployed app. The deployer writes GROK_PROJECT_ID on
 * every publish; the sandbox preview never has it. Single source of truth for
 * the split — gate audience, gate endpoints and connector-token semantics all
 * key off this predicate.
 */
export function isWorkspacePreview(): boolean {
  return !env("GROK_PROJECT_ID");
}
