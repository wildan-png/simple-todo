import fs from 'fs';
import path from 'path';

/**
 * Reads the full system environment from .claude-env.json.
 * This file is generated at setup time with the complete env needed
 * for the Claude Agent SDK to access macOS Keychain OAuth credentials.
 * Next.js filters process.env in API routes, so we need this workaround.
 */
export function claudeCodeProcessEnv(): Record<string, string | undefined> {
  try {
    const envPath = path.join(process.cwd(), '.claude-env.json');
    const data = fs.readFileSync(envPath, 'utf-8');
    const env = JSON.parse(data) as Record<string, string>;
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    return env;
  } catch {
    // Fallback to process.env if file doesn't exist
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    return env;
  }
}
