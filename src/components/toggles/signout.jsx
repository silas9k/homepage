import { useState } from "react";

import { authenticatedFetch } from "utils/auth/client";

export default function SignOut() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <button
      type="button"
      className="silas-logout"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        setError(false);
        try {
          const response = await authenticatedFetch("/api/auth/logout", { method: "POST" });
          if (!response.ok) throw new Error("Logout failed");
          window.location.replace(new URL("/auth/signin", window.location.origin).href);
        } catch {
          setError(true);
          setBusy(false);
        }
      }}
    >
      {error ? "Retry sign out" : "Sign out"}
    </button>
  );
}
