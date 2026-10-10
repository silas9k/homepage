/** @param {string} url @param {RequestInit} init */
export async function authenticatedFetch(url, init = {}) {
  const sessionResponse = await fetch("/api/auth/session");
  if (!sessionResponse.ok) {
    window.location.replace(new URL("/auth/signin", window.location.origin).href);
    throw new Error("Session expired");
  }
  const { csrf } = await sessionResponse.json();
  return fetch(url, { ...init, headers: { ...init.headers, "x-silas-csrf": csrf } });
}
