import { requirePageSession } from "utils/auth/http";
import { getSettings } from "utils/config/config";

export async function getServerSideProps(context) {
  const denied = requirePageSession(context);
  if (denied) return denied;
  const { res } = context;
  const settings = getSettings();
  const content = ["User-agent: *", !!settings.disableIndexing ? "Disallow: /" : "Allow: /"].join("\n");

  res.setHeader("Content-Type", "text/plain");
  res.write(content);
  res.end();

  return {
    props: {},
  };
}

export default function RobotsTxt() {
  // placeholder component
  return null;
}
