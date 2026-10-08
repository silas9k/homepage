export default function EmptyMetrics({ service }) {
  const labels = service.silas?.metrics ?? [];
  return (
    <div className="silas-empty" aria-label={`${service.name}: Metriken nicht konfiguriert`}>
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
      <p className="silas-empty-caption">
        {service.silas?.note ?? (service.href ? "Metriken nicht konfiguriert" : "Nicht konfiguriert")}
      </p>
    </div>
  );
}
