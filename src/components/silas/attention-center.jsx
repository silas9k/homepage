import classNames from "classnames";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { useBeszelSystem } from "components/silas/beszel-host-data";
import useWidgetAPI from "utils/proxy/use-widget-api";

const INTENTIONAL_STATES = new Set(["planned", "stopped", "later", "not configured", "not-configured"]);
const HOST_NAMES = new Set(["debian-docker", "raspi", "Raspberry Pi 5"]);

function normalizeHost(host) {
  const value = String(host ?? "")
    .trim()
    .toLowerCase();
  if (value === "raspberry pi 5" || value === "raspi") return "raspi";
  if (value === "debian-docker") return "debian-docker";
  return value;
}

export function getDiskSeverity(percent) {
  if (!Number.isFinite(percent) || percent < 85) return null;
  return percent >= 95 ? "critical" : "warning";
}

export function isExpectedRunning(service) {
  const state = service?.silas?.state?.toLowerCase();
  return (
    Boolean(service?.siteMonitor) &&
    !service?.optional &&
    service?.silas?.attention !== false &&
    !INTENTIONAL_STATES.has(state) &&
    !String(service.siteMonitor).includes("{{")
  );
}

export function buildAttentionItems(statuses) {
  const items = Object.values(statuses).filter(Boolean);
  const unavailableHosts = new Set(
    items.filter((item) => item.kind === "host").map((item) => normalizeHost(item.host)),
  );

  return items.filter((item) => item.kind !== "service" || !unavailableHosts.has(normalizeHost(item.host)));
}

function useReportedIssue(onStatus, id, issue) {
  const issueKey = JSON.stringify(issue);
  useEffect(() => {
    onStatus(id, issue);
    return () => onStatus(id, null);
    // issueKey is the stable semantic dependency; source objects are recreated during render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, issueKey, onStatus]);
}

function BeszelSource({ service, onStatus }) {
  const result = useBeszelSystem(service?.silas?.beszelSystemId ?? service?.name);
  const settled = Boolean(result.error || result.systems);
  const host = service?.silas?.host ?? service?.name;
  const hostIssue =
    result.configured && settled && !result.system?.online
      ? { kind: "host", host, title: service.name, message: "Host nicht erreichbar" }
      : null;
  const diskPercent = result.system?.diskPercent;
  const diskSeverity = getDiskSeverity(diskPercent);
  const diskIssue = diskSeverity
    ? {
        kind: "disk",
        host,
        severity: diskSeverity,
        title: service.name,
        message: `Speicher zu ${Math.round(diskPercent)} % belegt`,
      }
    : null;

  useReportedIssue(onStatus, `${service.name}:host`, hostIssue);
  useReportedIssue(onStatus, `${service.name}:disk`, diskIssue);
  return null;
}

function ProxmoxSource({ service, onStatus }) {
  const widget = service?.widgets?.find((item) => item.type === "proxmox");
  const storage = useWidgetAPI(widget ?? {}, widget ? "node/storage" : "");
  const host = service?.silas?.host ?? service?.name;
  const beszel = useBeszelSystem(service?.silas?.beszelSystemId ?? service?.name);
  const hostIssue =
    beszel.configured && (beszel.error || beszel.systems) && !beszel.system?.online
      ? { kind: "host", host, title: service.name, message: "Host nicht erreichbar" }
      : null;
  const storages = Array.isArray(storage.data?.data) ? storage.data.data : [];
  const total = storages.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const used = storages.reduce((sum, item) => sum + (Number(item.used) || 0), 0);
  const diskPercent = total > 0 ? (used / total) * 100 : undefined;
  const diskSeverity = getDiskSeverity(diskPercent);
  const diskIssue = diskSeverity
    ? {
        kind: "disk",
        host,
        severity: diskSeverity,
        title: service.name,
        message: `Speicher zu ${Math.round(diskPercent)} % belegt`,
      }
    : null;

  useReportedIssue(onStatus, `${service.name}:host`, hostIssue);
  useReportedIssue(onStatus, `${service.name}:disk`, diskIssue);
  return null;
}

function CloudflareSource({ service, onStatus }) {
  const widget = service?.widgets?.find((item) => item.type === "cloudflared");
  const { data, error } = useWidgetAPI(widget ?? {}, widget ? "cfd_tunnel" : "");
  const settled = Boolean(error || data);
  const status = data?.result?.status;
  const issue =
    widget && settled && typeof status === "string" && status.toLowerCase() !== "healthy"
      ? { kind: "cloudflare", severity: "critical", title: service.name, message: `Status ${status}` }
      : widget && settled && !status
        ? { kind: "cloudflare", severity: "critical", title: service.name, message: "Tunnel nicht verfügbar" }
        : null;

  useReportedIssue(onStatus, `${service.name}:cloudflare`, issue);
  return null;
}

function SiteMonitorSource({ service, onStatus }) {
  const { data, error } = useSWR(
    `/api/siteMonitor?${new URLSearchParams({ groupName: service.groupName ?? "", serviceName: service.name }).toString()}`,
    { refreshInterval: 30000 },
  );
  const settled = Boolean(error || data);
  const failed = error || data?.error || (data && Number(data.status) > 403);
  const issue =
    settled && failed
      ? {
          kind: "service",
          host: service.silas?.host,
          severity: "warning",
          title: service.name,
          message: "Dienst nicht erreichbar",
        }
      : null;

  useReportedIssue(onStatus, `${service.name}:service`, issue);
  return null;
}

function flattenServices(groups) {
  return (groups ?? []).flatMap((group) => [
    ...(group.services ?? []).map((service) => ({ ...service, groupName: group.name })),
    ...flattenServices(group.groups),
  ]);
}

export default function AttentionCenter({ services }) {
  const [statuses, setStatuses] = useState({});
  const updateStatus = useCallback((id, issue) => {
    setStatuses((current) => {
      const next = { ...current };
      if (issue) next[id] = issue;
      else delete next[id];
      return next;
    });
  }, []);
  const allServices = useMemo(() => flattenServices(services), [services]);
  const hostServices = useMemo(
    () => allServices.filter((service) => ["debian-docker", "raspi"].includes(service.name)),
    [allServices],
  );
  const proxmox = allServices.find((service) => service.name === "Proxmox");
  const cloudflare = allServices.find((service) => service.name === "Cloudflare Tunnel");
  const monitoredServices = allServices.filter(
    (service) => isExpectedRunning(service) && !HOST_NAMES.has(service.name) && service.name !== "Cloudflare Tunnel",
  );
  const issues = buildAttentionItems(statuses);

  return (
    <>
      {hostServices.map((service) => (
        <BeszelSource key={service.name} service={service} onStatus={updateStatus} />
      ))}
      {proxmox && <ProxmoxSource service={proxmox} onStatus={updateStatus} />}
      {cloudflare && <CloudflareSource service={cloudflare} onStatus={updateStatus} />}
      {monitoredServices.map((service) => (
        <SiteMonitorSource key={service.name} service={service} onStatus={updateStatus} />
      ))}
      {issues.length > 0 && (
        <section className="silas-attention-center" aria-label="Aufmerksamkeit nötig" aria-live="polite">
          <h2>⚠ Aufmerksamkeit nötig</h2>
          <div className="silas-attention-list">
            {issues.map((issue) => (
              <div
                key={`${issue.title}:${issue.message}`}
                className={classNames("silas-attention-item", issue.severity)}
              >
                <span className="silas-attention-marker" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>{issue.title}</strong>
                  <span>{issue.message}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
