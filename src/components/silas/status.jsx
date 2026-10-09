import useSWR from "swr";

export default function SilasStatus({ groupName, service }) {
  const configured = Boolean(service.siteMonitor);
  const { data, error } = useSWR(
    configured ? `/api/siteMonitor?${new URLSearchParams({ groupName, serviceName: service.name }).toString()}` : null,
    { refreshInterval: 30000 },
  );

  let status = "Nicht konfiguriert";
  if (configured && (error || data?.error)) {
    status = "Nicht erreichbar";
  } else if (configured && data) {
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
    </div>
  );
}
