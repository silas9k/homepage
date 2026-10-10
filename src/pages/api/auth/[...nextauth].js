import { withAuth } from "utils/auth/http";

// Legacy authentication routes are retired; no OIDC, JWT, bearer or registration path.
export default withAuth((req, res) => res.status(404).end());
