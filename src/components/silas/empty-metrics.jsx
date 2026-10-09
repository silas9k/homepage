import SilasStatus from "./status";

export default function EmptyMetrics({ groupName, service }) {
  const labels = service.silas?.metrics ?? [];
  if (service.siteMonitor || labels.length === 0) {
    return <SilasStatus groupName={groupName} service={service} />;
  }

  return (
    <div className="silas-empty" aria-label={`${service.name}: Nicht konfiguriert`}>
      {labels.length > 0 && (
        <div className="service-container">
          {labels.map((label) => (
            <div className="service-block" key={label}>
              <span className="service-block-value" aria-label="Nicht verfügbar">
                —
              </span>
              <span className="service-block-label">{label}</span>
            </div>
          ))}
        </div>
      )}
      <p className="silas-empty-caption">{service.silas?.note ?? "Nicht konfiguriert"}</p>
    </div>
  );
}
