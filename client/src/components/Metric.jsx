export default function Metric({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  note,
  ratio,
}) {
  const percent = Math.max(0, Math.min(100, Number(ratio) || 0));
  return (
    <div className={"metric metric-" + tone}>
      <div className="metric-heading">
        <span>{label}</span>
        {Icon && <Icon size={19} aria-hidden="true" />}
      </div>
      <strong className="metric-value">{value}</strong>
      {note && <small className="metric-note">{note}</small>}
      {ratio !== undefined && (
        <div className="metric-track" aria-hidden="true">
          <span style={{ width: percent + "%" }} />
        </div>
      )}
    </div>
  );
}
