import { readFileSync } from "node:fs";

export function createSecretRedactor(env = process.env, read = readFileSync) {
  const secrets = Object.entries(env)
    .flatMap(([key, value]) => {
      if (!value || !/(PASSWORD|TOKEN|SECRET|API_KEY)/i.test(key)) return [];
      if (key.startsWith("HOMEPAGE_FILE_")) {
        try {
          return [read(value, "utf8").trim()];
        } catch {
          return [];
        }
      }
      return [value];
    })
    .filter(Boolean)
    .flatMap((secret) => [secret, encodeURIComponent(secret)])
    .sort((a, b) => b.length - a.length);
  return (message) => secrets.reduce((text, secret) => text.replaceAll(secret, "[REDACTED]"), String(message));
}
