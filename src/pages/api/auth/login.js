import { allowedHost, cookieToken, sameOrigin, sessionCookie } from "utils/auth/http";
import store from "utils/auth/store.cjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!allowedHost(req)) return res.status(400).json({ error: "Invalid host" });
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  if (!sameOrigin(req) || !req.headers["content-type"]?.startsWith("application/json")) {
    return res.status(403).json({ error: "Request rejected" });
  }
  try {
    const result = await store.login(req.body?.username, req.body?.password, cookieToken(req));
    if (result.retryAfter) {
      res.setHeader("Retry-After", String(result.retryAfter));
      return res.status(429).json({ error: "Invalid username or password" });
    }
    if (result.invalid) return res.status(401).json({ error: "Invalid username or password" });
    res.setHeader("Set-Cookie", sessionCookie(result.token, result.expiresAt));
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(503).json({ error: "Sign-in unavailable" });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
