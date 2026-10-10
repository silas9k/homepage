import { withAuth } from "utils/auth/http";
import { servicesResponse } from "utils/config/api-response";

async function handler(req, res) {
  res.send(await servicesResponse());
}

export default withAuth(handler);
