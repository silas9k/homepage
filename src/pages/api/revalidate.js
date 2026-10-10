import { withAuth } from "utils/auth/http";

// Dashboard data is rendered on each request; no public static snapshot remains.
export default withAuth((req, res) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  return res.json({ revalidated: true });
});
