import { useTranslation } from "next-i18next/pages";

import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useBeszelSystems } from "components/silas/beszel-host-data";
import withWidgetFields from "utils/widget-fields";

const SUMMARY_FIELDS = ["systems", "up"];
const SYSTEM_FIELDS = ["name", "status", "cpu", "memory"];

export default function Component({ service: configuredService }) {
  const { t } = useTranslation();

  const defaultFields = configuredService.widget.systemId ? SYSTEM_FIELDS : SUMMARY_FIELDS;
  const service = withWidgetFields(configuredService, defaultFields);
  const { widget } = service;
  const { systemId } = widget;

  const { systems, error: systemsError } = useBeszelSystems(widget);

  let system = null;
  let finalError = systemsError;

  if (systems && systemId) {
    system = systems.find((item) => item.id === systemId || item.name === systemId);
    if (!system) {
      finalError = { message: `System with id ${systemId} not found` };
    }
  }

  if (finalError) {
    return <Container service={service} error={finalError} />;
  }

  if (!systems) {
    return (
      <Container service={service}>
        <Block label="beszel.systems" />
        <Block label="beszel.up" />
      </Container>
    );
  }

  if (system) {
    return (
      <Container service={service}>
        <Block label="beszel.name" value={system.name} />
        <Block label="beszel.status" value={t(`beszel.${system.status}`)} />
        <Block label="beszel.updated" value={t("common.relativeDate", { value: system.updatedAt })} />
        <Block
          label="beszel.cpu"
          value={t("common.percent", { value: system.cpuPercent, maximumFractionDigits: 2 })}
          highlightValue={system.cpuPercent}
        />
        <Block
          label="beszel.memory"
          value={t("common.percent", { value: system.memoryPercent, maximumFractionDigits: 2 })}
          highlightValue={system.memoryPercent}
        />
        <Block
          label="beszel.disk"
          value={t("common.percent", { value: system.diskPercent, maximumFractionDigits: 2 })}
          highlightValue={system.diskPercent}
        />
        <Block
          label="beszel.network"
          value={t("common.byterate", { value: system.networkBandwidth, maximumFractionDigits: 2 })}
          highlightValue={system.networkBandwidth}
        />
      </Container>
    );
  }

  const upTotal = systems.filter((item) => item.online).length;

  return (
    <Container service={service}>
      <Block label="beszel.systems" value={systems.length} />
      <Block label="beszel.up" value={`${upTotal} / ${systems.length}`} />
    </Container>
  );
}
