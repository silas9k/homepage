import { withAuth } from "utils/auth/http";
import { bookmarksResponse } from "utils/config/api-response";

async function handler(req, res) {
  res.send(await bookmarksResponse());
}

export default withAuth(handler);
