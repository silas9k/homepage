import { authenticated, withAuth } from "utils/auth/http";

export default withAuth((req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  const session = authenticated(req);
  return res.json({ username: session.username, csrf: session.csrf, expiresAt: session.expires_at });
});
