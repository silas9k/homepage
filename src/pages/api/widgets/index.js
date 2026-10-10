import { withAuth } from "utils/auth/http";
import { widgetsResponse } from "utils/config/api-response";

async function handler(req, res) {
  res.send(await widgetsResponse());
}

export default withAuth(handler);
