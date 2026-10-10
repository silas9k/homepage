import Head from "next/head";
import { useState } from "react";

import { requirePageSession } from "utils/auth/http";

export default function SignIn() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Head>
        <title>Sign in · silasnet.</title>
        <link rel="icon" href="/silas/favicon.svg" />
      </Head>
      <main className="silas-login">
        <section className="silas-login-card" aria-labelledby="login-title">
          <div className="silas-login-brand">silasnet.</div>
          <h1 id="login-title">Sign in</h1>
          <p>Your private dashboard.</p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              const fields = new FormData(event.currentTarget);
              try {
                const response = await fetch("/api/auth/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ username: fields.get("username"), password: fields.get("password") }),
                });
                if (response.ok) {
                  window.location.replace(new URL("/", window.location.origin).href);
                  return;
                }
                setError(
                  response.status === 429
                    ? "Invalid username or password. Please wait before trying again."
                    : response.status === 503
                      ? "Sign-in unavailable. Contact the dashboard owner."
                      : "Invalid username or password",
                );
              } catch {
                setError("Sign-in unavailable. Please try again.");
              }
              setBusy(false);
            }}
          >
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              maxLength={64}
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={1024}
              required
            />
            {error && (
              <p className="silas-login-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}

export function getServerSideProps(context) {
  // No settings, inventory or account records reach the public login page.
  const denied = requirePageSession(context);
  return denied ? { props: { publicLogin: true } } : { redirect: { destination: "/", permanent: false } };
}
