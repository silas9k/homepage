import { useCallback, useEffect, useState } from "react";

import { useBeszelSystem } from "components/silas/beszel-host-data";
import useWidgetAPI from "utils/proxy/use-widget-api";

const HOSTS = ["Proxmox", "debian-docker", "raspi"];

function serviceWidget(service, type) {
  return service?.widgets?.find((widget) => widget.type === type);
}

function useBeszelHost(service, onFreshData) {
  const result = useBeszelSystem(service?.silas?.beszelSystemId ?? service?.name);
  useEffect(() => {
    if (result.systems !== undefined && !result.error) onFreshData();
  }, [onFreshData, result.error, result.systems]);

  return {
    configured: result.configured,
    loading: result.loading,
    online: result.system?.online === true,
  };
}

function useHostStatus(service, onFreshData) {
  const beszel = useBeszelHost(service, onFreshData);
  return beszel;
}

function HostOverview({ services, href, onFreshData }) {
  const proxmox = useHostStatus(
    services.find((service) => service.name === HOSTS[0]),
    onFreshData,
  );
  const debian = useHostStatus(
    services.find((service) => service.name === HOSTS[1]),
    onFreshData,
  );
  const raspi = useHostStatus(
    services.find((service) => service.name === HOSTS[2]),
    onFreshData,
  );
  const hosts = [proxmox, debian, raspi];

  if (hosts.some((host) => !host.configured)) {
    return <OverviewItem href={href} label="Hosts" value="Hosts nicht konfiguriert" state="unknown" />;
  }
  if (hosts.some((host) => host.loading))
    return <OverviewItem href={href} label="Hosts" value="Hosts werden geprüft" state="unknown" />;

  const online = hosts.filter((host) => host.online).length;
  return (
    <OverviewItem
      href={href}
      label="Hosts"
      value={`${online} / ${HOSTS.length} Hosts`}
      state={online === HOSTS.length ? "healthy" : "warning"}
    />
  );
}

function ContainersOverview({ service, href, onFreshData }) {
  const widget = serviceWidget(service, "portainer");
  const { data, error } = useWidgetAPI(widget ?? {}, widget ? "docker/containers" : "", { all: 1 });
  useEffect(() => {
    if (data !== undefined && !error) onFreshData();
  }, [data, error, onFreshData]);

  if (!widget || error || data?.error || data?.message || !Array.isArray(data)) {
    return <OverviewItem href={href} label="Container" value="Container nicht verfügbar" state="unknown" />;
  }

  const running = data.filter((container) => container.State === "running").length;
  return <OverviewItem href={href} label="Container" value={`${running} Container aktiv`} state="healthy" />;
}

function TunnelOverview({ service, href, onFreshData }) {
  const widget = serviceWidget(service, "cloudflared");
  const { data, error } = useWidgetAPI(widget ?? {}, widget ? "cfd_tunnel" : "");
  useEffect(() => {
    if (data !== undefined && !error) onFreshData();
  }, [data, error, onFreshData]);
  const status = data?.result?.status;

  if (!widget || error || data?.error || typeof status !== "string") {
    return <OverviewItem href={href} label="Cloudflare Tunnel" value="Tunnel nicht verfügbar" state="unknown" />;
  }

  const healthy = status.toLowerCase() === "healthy";
  return (
    <OverviewItem
      href={href}
      label="Cloudflare Tunnel"
      value={`Tunnel ${status.charAt(0).toUpperCase()}${status.slice(1)}`}
      state={healthy ? "healthy" : "warning"}
    />
  );
}

export function OverviewItem({ href, label, value, state }) {
  const content = (
    <>
      <span className={`silas-overview-dot silas-overview-dot-${state}`} aria-hidden="true" />
      <span>{value}</span>
    </>
  );

  if (!href) {
    return (
      <div className="silas-overview-item" aria-label={`${label}: ${value}`}>
        {content}
      </div>
    );
  }

  return (
    <a
      className="silas-overview-item silas-overview-link"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label}: ${value}`}
    >
      {content}
    </a>
  );
}

export default function SystemOverview({ services }) {
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const recordFreshData = useCallback(() => setLastUpdated(Date.now()), []);
  const serverGroup = services?.find((group) => group.name === "Server");
  const serverServices = serverGroup?.services ?? [];
  const allServices = services?.flatMap((group) => group.services ?? []) ?? [];
  const portainer = allServices.find((service) => service.name === "Portainer");
  const cloudflare = allServices.find((service) => service.name === "Cloudflare Tunnel");

  useEffect(() => {
    if (lastUpdated === null) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, [lastUpdated]);

  const freshness =
    lastUpdated === null ? null : `Aktualisiert vor ${Math.max(0, Math.floor((now - lastUpdated) / 1000))}s`;

  return (
    <section className="silas-system-overview" aria-label="Systemübersicht" aria-live="polite">
      <HostOverview
        services={serverServices}
        href={allServices.find((service) => service.name === "Beszel")?.href}
        onFreshData={recordFreshData}
      />
      <ContainersOverview service={portainer} href={portainer?.href} onFreshData={recordFreshData} />
      <TunnelOverview service={cloudflare} href={cloudflare?.href} onFreshData={recordFreshData} />
      {freshness && <span className="silas-overview-freshness">{freshness}</span>}
    </section>
  );
}
