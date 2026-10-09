import useSWR from "swr";

import useWidgetAPI from "utils/proxy/use-widget-api";

const HOSTS = ["debian-docker", "raspi"];

function serviceWidget(service, type) {
  return service?.widgets?.find((widget) => widget.type === type);
}

function hostRequest(groupName, serviceName) {
  if (!groupName) return null;
  return `/api/siteMonitor?${new URLSearchParams({ groupName, serviceName }).toString()}`;
}

function isAvailable(result) {
  return result?.data && !result.error && !result.data.error && result.data.status <= 403;
}

function HostOverview({ groupName }) {
  const debian = useSWR(hostRequest(groupName, HOSTS[0]), { refreshInterval: 30000 });
  const raspi = useSWR(hostRequest(groupName, HOSTS[1]), { refreshInterval: 30000 });
  const results = [debian, raspi];
  const settled = results.every((result) => result.data || result.error);
  const online = results.filter(isAvailable).length;

  if (!groupName) return null;
  if (!settled) return <OverviewItem label="Hosts" value="Hosts werden geprüft" state="unknown" />;

  return (
    <OverviewItem
      label="Hosts"
      value={`${online} / ${HOSTS.length} Hosts`}
      state={online === HOSTS.length ? "healthy" : "warning"}
    />
  );
}

function ContainersOverview({ service }) {
  const widget = serviceWidget(service, "portainer");
  const { data, error } = useWidgetAPI(widget ?? {}, widget ? "docker/containers" : "", { all: 1 });

  if (!widget || error || data?.error || data?.message || !Array.isArray(data)) {
    return <OverviewItem label="Container" value="Container nicht verfügbar" state="unknown" />;
  }

  const running = data.filter((container) => container.State === "running").length;
  return <OverviewItem label="Container" value={`${running} Container aktiv`} state="healthy" />;
}

function TunnelOverview({ service }) {
  const widget = serviceWidget(service, "cloudflared");
  const { data, error } = useWidgetAPI(widget ?? {}, widget ? "cfd_tunnel" : "");
  const status = data?.result?.status;

  if (!widget || error || data?.error || typeof status !== "string") {
    return <OverviewItem label="Cloudflare Tunnel" value="Tunnel nicht verfügbar" state="unknown" />;
  }

  const healthy = status.toLowerCase() === "healthy";
  return (
    <OverviewItem
      label="Cloudflare Tunnel"
      value={`Tunnel ${status.charAt(0).toUpperCase()}${status.slice(1)}`}
      state={healthy ? "healthy" : "warning"}
    />
  );
}

export function OverviewItem({ label, value, state }) {
  return (
    <div className="silas-overview-item" aria-label={`${label}: ${value}`}>
      <span className={`silas-overview-dot silas-overview-dot-${state}`} aria-hidden="true" />
      <span>{value}</span>
    </div>
  );
}

export default function SystemOverview({ services }) {
  const serverGroup = services?.find((group) => group.name === "Server");
  const allServices = services?.flatMap((group) => group.services ?? []) ?? [];
  const portainer = allServices.find((service) => service.name === "Portainer");
  const cloudflare = allServices.find((service) => service.name === "Cloudflare Tunnel");

  return (
    <section className="silas-system-overview" aria-label="Systemübersicht" aria-live="polite">
      <HostOverview groupName={serverGroup?.name} />
      <ContainersOverview service={portainer} />
      <TunnelOverview service={cloudflare} />
    </section>
  );
}
