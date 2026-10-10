import { timingSafeEqual } from "node:crypto";

import store from "./store.cjs";

export const cookieName = () => (process.env.NODE_ENV === "production" ? "__Host-silas-session" : "silas-session");
export function cookieToken(req) {
  const raw = req.headers?.get ? req.headers.get("cookie") : req.headers?.cookie;
  return (raw || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName()}=`))
    ?.slice(cookieName().length + 1);
}
export function header(req, key) {
  return req.headers?.get ? req.headers.get(key) : req.headers?.[key];
}
export function allowedHost(req) {
  const host = header(req, "host");
  const port = process.env.PORT || "3000";
  const configured = (process.env.HOMEPAGE_ALLOWED_HOSTS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.some((value) => value.includes("*"))) return false;
  return (
    typeof host === "string" &&
    [...configured, `localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`].includes(host)
  );
}
export function sameOrigin(req) {
  if (!allowedHost(req) || header(req, "sec-fetch-site") === "cross-site") return false;
  const host = header(req, "host");
  const origin = header(req, "origin");
  const configured = (process.env.HOMEPAGE_AUTH_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const origins = process.env.NODE_ENV === "production" ? configured : [...configured, `http://${host}`];
  try {
    const parsed = new URL(origin);
    return (
      parsed.origin === origin &&
      parsed.host === host &&
      origins.includes(origin) &&
      (process.env.NODE_ENV !== "production" || parsed.protocol === "https:")
    );
  } catch {
    return false;
  }
}
export function sessionCookie(token, expiresAt) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${token ? Math.floor(store.SESSION_MS / 1000) : 0}; Expires=${new Date(expiresAt).toUTCString()}`;
}
export function authenticated(req) {
  return store.session(cookieToken(req));
}
export function validCsrf(req, session) {
  const token = header(req, "x-silas-csrf");
  return (
    sameOrigin(req) &&
    typeof token === "string" &&
    /^[a-f0-9]{64}$/.test(token) &&
    timingSafeEqual(Buffer.from(token), Buffer.from(session.csrf))
  );
}
export const isMutation = (method) => !["GET", "HEAD", "OPTIONS"].includes(method);

export function withAuth(handler) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!allowedHost(req)) return res.status(400).json({ error: "Invalid host" });
    try {
      const accountSession = authenticated(req);
      if (!accountSession) return res.status(401).json({ error: "Authentication required" });
      if (isMutation(req.method) && !validCsrf(req, accountSession))
        return res.status(403).json({ error: "Request rejected" });
      return await handler(req, res);
    } catch {
      // Do not expose DB paths, internal configuration or upstream exceptions.
      if (!res.headersSent) return res.status(503).json({ error: "Service unavailable" });
      return res.end();
    }
  };
}

export function requirePageSession(context) {
  context.res.setHeader("Cache-Control", "private, no-store");
  if (!allowedHost(context.req) || !authenticated(context.req)) {
    return { redirect: { destination: "/auth/signin", permanent: false } };
  }
  return null;
}
