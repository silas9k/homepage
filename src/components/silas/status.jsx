import useSWR from "swr";

export default function SilasStatus({ groupName, service }) {
  const explicitState = service.silas?.state;
  const configured = Boolean(service.siteMonitor);
  const { data, error } = useSWR(
    explicitState || !configured
      ? null
      : `/api/siteMonitor?${new URLSearchParams({ groupName, serviceName: service.name }).toString()}`,
    { refreshInterval: 30000 },
  );

  let status = service.silas?.stateLabel ?? "Nicht konfiguriert";
  if (!explicitState && configured && (error || data?.error)) {
    status = "Nicht erreichbar";
  } else if (!explicitState && configured && data) {
    status = data.status > 403 ? "Offline" : "Online";
  }

  return (
    <div className="silas-status" aria-label={`${service.name}: ${status}`}>
      <div className="service-container">
        <div className="service-block">
          <span className="service-block-value">{status}</span>
          <span className="service-block-label">Status</span>
        </div>
      </div>
      {service.silas?.stateNote && <p className="silas-empty-caption">{service.silas.stateNote}</p>}
    </div>
  );
}
