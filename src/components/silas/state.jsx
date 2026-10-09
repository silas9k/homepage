export default function SilasState({ service }) {
  const label = service.silas.stateLabel ?? "Nicht konfiguriert";
  const secondary = service.silas.stateNote;

  return (
    <div className="silas-empty" aria-label={`${service.name}: ${label}`}>
      <div className="service-container">
        <div className="service-block">
          <span className="service-block-value">{label}</span>
          <span className="service-block-label">Status</span>
        </div>
      </div>
      {secondary && <p className="silas-empty-caption">{secondary}</p>}
    </div>
  );
}
