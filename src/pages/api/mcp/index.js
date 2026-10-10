import { withAuth } from "utils/auth/http";
import { handleMcpRequest, mcpEnabled } from "utils/mcp/homepage-mcp";

async function handler(req, res) {
  if (!mcpEnabled()) {
    return res.status(404).end("Not Found");
  }

  // Session and CSRF checks run in withAuth before any RPC is dispatched.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const response = handleMcpRequest(req.body);
  if (!response) {
    return res.status(202).end();
  }

  return res.status(200).json(response);
}

export default withAuth(handler);
