import { createContext, useContext, useMemo } from "react";

import useWidgetAPI from "utils/proxy/use-widget-api";

const BeszelHostContext = createContext(null);

function findBeszelWidget(services) {
  return (services ?? [])
    .flatMap((group) => group.services ?? [])
    .flatMap((service) => service.widgets ?? [])
    .find((widget) => widget.type === "beszel");
}

function numberOrUndefined(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function normalizeBeszelSystem(system) {
  const info = system?.info ?? {};
  return {
    id: system?.id,
    name: system?.name,
    status: system?.status,
    online: system?.status === "up",
    cpuPercent: numberOrUndefined(info.cpu),
    memoryPercent: numberOrUndefined(info.mp),
    diskPercent: numberOrUndefined(info.dp),
    networkBandwidth: numberOrUndefined(info.bb),
    uptime: numberOrUndefined(info.u),
    temperature: numberOrUndefined(info.dt),
    updatedAt: system?.updated,
  };
}

export function useBeszelSystems(widget) {
  const context = useContext(BeszelHostContext);
  const effectiveWidget = context?.widget ?? widget;
  const { data, error } = useWidgetAPI(effectiveWidget ?? {}, effectiveWidget ? "systems" : "", {
    refreshInterval: 60000,
  });
  const systems = Array.isArray(data?.items) ? data.items.map(normalizeBeszelSystem) : undefined;

  if (context) return context;

  return {
    configured: Boolean(effectiveWidget),
    systems,
    loading: Boolean(effectiveWidget) && systems === undefined && !error,
    error,
  };
}

export function useBeszelSystem(systemId, widget) {
  const result = useBeszelSystems(widget);
  const system = useMemo(
    () => result.systems?.find((item) => item.id === systemId || item.name === systemId),
    [result.systems, systemId],
  );

  return { ...result, system, configured: result.configured && Boolean(systemId) };
}

export function BeszelHostProvider({ services, widget, children }) {
  const beszelWidget = widget ?? findBeszelWidget(services);
  const result = useBeszelSystems(beszelWidget);
  const value = useMemo(() => ({ ...result, widget: beszelWidget }), [beszelWidget, result]);

  return <BeszelHostContext.Provider value={value}>{children}</BeszelHostContext.Provider>;
}
