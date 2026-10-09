import { parseVersionForUrl } from "utils/proxy/api-helpers";
import useWidgetAPI from "utils/proxy/use-widget-api";

const HOSTS = ["debian-docker", "raspi"];

function serviceWidget(service, type) {
  return service?.widgets?.find((widget) => widget.type === type);
}

function useGlancesHost(service) {
  const widget = serviceWidget(service, "glances");
  const version = parseVersionForUrl(widget?.version, 4);
  const result = useWidgetAPI(widget ?? {}, widget ? `${version}/cpu` : "", { refreshInterval: 60000 });
  const configured = Boolean(widget);
  const loading = configured && result.data === undefined && !result.error;
  const online = configured && !result.error && Number.isFinite(result.data?.total);

  return { configured, loading, online };
}

function HostOverview({ services }) {
  const debian = useGlancesHost(services.find((service) => service.name === HOSTS[0]));
  const raspi = useGlancesHost(services.find((service) => service.name === HOSTS[1]));
  const hosts = [debian, raspi];

  if (hosts.some((host) => !host.configured)) {
    return <OverviewItem label="Hosts" value="Hosts nicht konfiguriert" state="unknown" />;
  }
  if (hosts.some((host) => host.loading))
    return <OverviewItem label="Hosts" value="Hosts werden geprüft" state="unknown" />;

  const online = hosts.filter((host) => host.online).length;
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
  const serverServices = serverGroup?.services ?? [];
  const allServices = services?.flatMap((group) => group.services ?? []) ?? [];
  const portainer = allServices.find((service) => service.name === "Portainer");
  const cloudflare = allServices.find((service) => service.name === "Cloudflare Tunnel");

  return (
    <section className="silas-system-overview" aria-label="Systemübersicht" aria-live="polite">
      <HostOverview services={serverServices} />
      <ContainersOverview service={portainer} />
      <TunnelOverview service={cloudflare} />
    </section>
  );
}
