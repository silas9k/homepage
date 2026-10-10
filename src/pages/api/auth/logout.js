import { cookieToken, sessionCookie, withAuth } from "utils/auth/http";
import store from "utils/auth/store.cjs";

export default withAuth((req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  store.revoke(cookieToken(req));
  res.setHeader("Set-Cookie", sessionCookie("", 0));
  return res.json({ ok: true });
});
