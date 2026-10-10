import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { allowedHost, authenticated, header } from "utils/auth/http";
import { publicLoginAsset } from "utils/auth/public-assets";

function finish(response, nonce) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://cdn.jsdelivr.net; font-src 'self'; connect-src 'self'${process.env.NODE_ENV !== "production" ? " ws:" : ""}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export function proxy(req) {
  const nonce = randomBytes(16).toString("base64");
  const done = (res) => finish(res, nonce);
  const requestHeaders = new Headers(req.headers);
  // Overwrite any client supplied value before the document applies the nonce.
  requestHeaders.set("x-silas-nonce", nonce);
  const next = () => done(NextResponse.next({ request: { headers: requestHeaders } }));
  if (!allowedHost(req)) return done(NextResponse.json({ error: "Invalid host" }, { status: 400 }));
  const path = req.nextUrl.pathname;
  // Exact public exceptions only. Custom CSS/JS, images, config and all API data remain private.
  if (
    path === "/auth/signin" ||
    path === "/api/auth/login" ||
    path === "/api/healthcheck" ||
    path === "/silas/favicon.svg"
  )
    return next();
  try {
    if (publicLoginAsset(path)) return next();
    if (authenticated(req)) return next();
  } catch {
    return done(NextResponse.json({ error: "Service unavailable" }, { status: 503 }));
  }
  if (path.startsWith("/api/")) return done(NextResponse.json({ error: "Authentication required" }, { status: 401 }));
  // Next requires an absolute redirect. Host has been allowlisted; scheme is a
  // fixed production policy, never supplied by X-Forwarded-* headers.
  const origin = `${process.env.NODE_ENV === "production" ? "https" : "http"}://${header(req, "host")}`;
  return done(NextResponse.redirect(new URL("/auth/signin", origin)));
}

// Next's automatic i18n matcher excludes /_next/static. Match raw paths too,
// so dashboard bundles, images and every framework data path are protected.
export const config = { matcher: [{ source: "/:path*", locale: false }] };
