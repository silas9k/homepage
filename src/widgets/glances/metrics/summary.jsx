import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { parseVersionForUrl } from "utils/proxy/api-helpers";
import useWidgetAPI from "utils/proxy/use-widget-api";

export function percent(value) {
  return Number.isFinite(value)
    ? `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value)} %`
    : "—";
}

export default function Summary({ service }) {
  const { widget } = service;
  const version = parseVersionForUrl(widget.version, 4);
  const options = { refreshInterval: 60000 };
  const cpu = useWidgetAPI(widget, `${version}/cpu`, options);
  const memory = useWidgetAPI(widget, `${version}/mem`, options);
  const disk = useWidgetAPI(widget, `${version}/fs`, options);
  const mount = widget.metric.slice("summary:".length) || "/";
  const filesystem = Array.isArray(disk.data) ? disk.data.find((fs) => fs.mnt_point === mount) : undefined;
  return (
    <Container service={service} error={cpu.error || memory.error || disk.error}>
      <Block label="CPU" value={cpu.data ? percent(cpu.data.total) : undefined} />
      <Block label="RAM" value={memory.data ? percent(memory.data.percent) : undefined} />
      <Block label="Disk" value={disk.data ? percent(filesystem?.percent) : undefined} />
    </Container>
  );
}
