import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCopy, FiExternalLink, FiServer, FiTerminal, FiX } from "react-icons/fi";

import ResolvedIcon from "components/resolvedicon";
import { parseVersionForUrl } from "utils/proxy/api-helpers";
import useWidgetAPI from "utils/proxy/use-widget-api";

function percent(value) {
  return Number.isFinite(value)
    ? `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value)} %`
    : "—";
}

function proxmoxPercent(used, total) {
  return Number.isFinite(used) && Number.isFinite(total) && total > 0 ? percent((used / total) * 100) : "—";
}

const defaultCpuSensorLabels = ["cpu_thermal", "Core", "Tctl", "Temperature"];

export function getTemperature(sensors, preferredLabel) {
  if (!Array.isArray(sensors)) return undefined;

  const labels = [preferredLabel, ...defaultCpuSensorLabels].filter(Boolean);
  for (const label of labels) {
    const values = sensors
      .filter((sensor) => sensor.type === "temperature_core" && sensor.label?.startsWith(label))
      .map((sensor) => sensor.value)
      .filter(Number.isFinite);
    if (values.length > 0) return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  return undefined;
}

export function formatTemperature(value) {
  return Number.isFinite(value)
    ? `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value)} °C`
    : undefined;
}

export function formatUptime(value) {
  let minutes;
  if (Number.isFinite(value)) {
    minutes = Math.floor(value / 60);
  } else if (typeof value === "string") {
    const match = value.match(/^(?:(\d+)\s+days?,\s*)?(\d{1,2}):(\d{2})(?::\d{2})?$/i);
    if (!match) return undefined;
    minutes = Number(match[1] ?? 0) * 24 * 60 + Number(match[2]) * 60 + Number(match[3]);
  } else {
    return undefined;
  }

  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const remainingMinutes = minutes % 60;
  if (days > 0) return `${days} ${days === 1 ? "Tag" : "Tage"}${hours > 0 ? ` ${hours} Std.` : ""}`;
  if (hours > 0) return `${hours} Std.${remainingMinutes > 0 ? ` ${remainingMinutes} Min.` : ""}`;
  return `${remainingMinutes} Min.`;
}

export default function ServerDetails({ service, onClose }) {
  const [copied, setCopied] = useState("");
  const titleId = useId();
  const dialogRef = useRef(null);
  const copyTimer = useRef(null);
  const configuredWidget = service.widgets?.find((item) => item.type === "glances");
  const proxmoxWidget = service.widgets?.find((item) => item.type === "proxmox");
  const isProxmox = Boolean(proxmoxWidget);
  const widget = configuredWidget ?? { type: "glances", url: "" };
  const version = parseVersionForUrl(widget.version, 4);
  // Match the summary card's query/cache key so both display the same CPU sample.
  const cpu = useWidgetAPI(widget, configuredWidget ? `${version}/cpu` : "", { refreshInterval: 60000 });
  const memory = useWidgetAPI(widget, configuredWidget ? `${version}/mem` : "");
  const disk = useWidgetAPI(widget, configuredWidget ? `${version}/fs` : "");
  const sensors = useWidgetAPI(widget, configuredWidget ? `${version}/sensors` : "", { refreshInterval: 60000 });
  const uptime = useWidgetAPI(widget, configuredWidget ? `${version}/uptime` : "", { refreshInterval: 60000 });
  const proxmoxCluster = useWidgetAPI(proxmoxWidget ?? {}, isProxmox ? "cluster/resources" : "");
  const proxmoxNode = useWidgetAPI(proxmoxWidget ?? {}, isProxmox ? "node/status" : "");
  const proxmoxStorage = useWidgetAPI(proxmoxWidget ?? {}, isProxmox ? "node/storage" : "");
  const filesystem = Array.isArray(disk.data) ? disk.data.find((item) => item.mnt_point === "/") : undefined;
  const details = service.silas.details;
  const temperature = formatTemperature(getTemperature(sensors.data, details.cpuSensorLabel));
  const formattedUptime = formatUptime(uptime.data);
  const proxmoxItems = Array.isArray(proxmoxCluster.data?.data) ? proxmoxCluster.data.data : [];
  const proxmoxNodes = proxmoxItems.filter(
    (item) => item.type === "node" && (proxmoxWidget.node === undefined || item.node === proxmoxWidget.node),
  );
  const proxmoxNodeData = proxmoxNode.data?.data;
  const proxmoxStorages = Array.isArray(proxmoxStorage.data?.data) ? proxmoxStorage.data.data : [];
  const proxmoxVms = proxmoxItems.filter(
    (item) =>
      item.type === "qemu" &&
      item.template === 0 &&
      (proxmoxWidget.node === undefined || item.node === proxmoxWidget.node),
  );
  const proxmoxLxc = proxmoxItems.filter(
    (item) =>
      item.type === "lxc" &&
      item.template === 0 &&
      (proxmoxWidget.node === undefined || item.node === proxmoxWidget.node),
  );
  const proxmoxStorageTotal = proxmoxStorages.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const proxmoxStorageUsed = proxmoxStorages.reduce((sum, item) => sum + (Number(item.used) || 0), 0);
  const proxmoxCpu = proxmoxNodes[0]?.cpu ?? proxmoxNodeData?.cpu;
  const proxmoxMemoryUsed = proxmoxNodes[0]?.mem ?? proxmoxNodeData?.mem;
  const proxmoxMemoryTotal = proxmoxNodes[0]?.maxmem ?? proxmoxNodeData?.maxmem;
  const proxmoxUptime = formatUptime(proxmoxNodeData?.uptime);

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current.querySelector("button").focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const controls = dialogRef.current.querySelectorAll("button, a[href]");
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(copyTimer.current);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  const copy = async (label, value) => {
    if (!value || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setCopied("Kopieren nicht möglich");
    }
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(""), 1500);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-theme-200/80 bg-theme-50 text-theme-800 shadow-xl shadow-theme-900/10 dark:border-white/10 dark:bg-theme-800 dark:text-theme-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between gap-4 border-b border-theme-200/70 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-theme-200/80 bg-white text-theme-600 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-theme-200">
              {service.icon ? <ResolvedIcon icon={service.icon} /> : <FiServer aria-hidden="true" size={20} />}
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-lg font-semibold tracking-tight">
                {service.name}
              </h2>
              <p className="truncate text-sm font-light text-theme-500 dark:text-theme-300">
                {details.host ?? service.silas.host}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Details schließen"
            className="silas-details-close flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-theme-500 transition-colors hover:bg-theme-200/60 hover:text-theme-800 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-500 dark:text-theme-300 dark:hover:bg-white/10 dark:hover:text-theme-100"
          >
            <FiX aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 px-5 pt-5">
          {(isProxmox
            ? [
                ["CPU", percent(Number.isFinite(proxmoxCpu) ? proxmoxCpu * 100 : undefined)],
                ["RAM", proxmoxPercent(proxmoxMemoryUsed, proxmoxMemoryTotal)],
                ["Storage", proxmoxPercent(proxmoxStorageUsed, proxmoxStorageTotal)],
              ]
            : [
                ["CPU", percent(cpu.data?.total)],
                ["RAM", percent(memory.data?.percent)],
                ["Disk", percent(filesystem?.percent)],
              ]
          ).map(([label, value]) => (
            <div
              className="min-w-0 rounded-xl border border-theme-200/80 bg-white/70 px-2 py-4 text-center dark:border-white/10 dark:bg-white/5"
              key={label}
            >
              <div className="text-lg font-semibold tracking-tight tabular-nums">{value}</div>
              <div className="mt-1 text-xs font-medium text-theme-500 dark:text-theme-300">{label}</div>
            </div>
          ))}
        </div>

        {(isProxmox ? proxmoxUptime : temperature || formattedUptime) && (
          <dl className="mx-5 mt-3 grid grid-cols-2 overflow-hidden rounded-xl border border-theme-200/80 bg-white/50 text-sm dark:border-white/10 dark:bg-white/5">
            {!isProxmox && temperature && (
              <div className="min-w-0 px-3 py-2.5">
                <dt className="text-xs text-theme-500 dark:text-theme-300">Temperatur</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{temperature}</dd>
              </div>
            )}
            {(isProxmox ? proxmoxUptime : formattedUptime) && (
              <div
                className={`min-w-0 px-3 py-2.5 ${!isProxmox && temperature ? "border-l border-theme-200/60 dark:border-white/10" : ""}`}
              >
                <dt className="text-xs text-theme-500 dark:text-theme-300">Uptime</dt>
                <dd className="mt-0.5 truncate font-medium tabular-nums" title={formattedUptime}>
                  {isProxmox ? proxmoxUptime : formattedUptime}
                </dd>
              </div>
            )}
          </dl>
        )}

        {isProxmox && (
          <dl className="mx-5 mt-3 grid grid-cols-2 overflow-hidden rounded-xl border border-theme-200/80 bg-white/50 text-sm dark:border-white/10 dark:bg-white/5">
            <div className="min-w-0 px-3 py-2.5">
              <dt className="text-xs text-theme-500 dark:text-theme-300">VMs</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{proxmoxVms.length}</dd>
            </div>
            <div className="min-w-0 border-l border-theme-200/60 px-3 py-2.5 dark:border-white/10">
              <dt className="text-xs text-theme-500 dark:text-theme-300">LXC</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{proxmoxLxc.length}</dd>
            </div>
          </dl>
        )}

        {(details.lanIp || details.tailscaleIp) && (
          <dl className="mx-5 mt-3 overflow-hidden rounded-xl border border-theme-200/80 bg-white/50 text-sm dark:border-white/10 dark:bg-white/5">
            {details.lanIp && (
              <div className="flex items-center justify-between gap-4 border-b border-theme-200/60 px-3 py-2.5 dark:border-white/10">
                <dt className="shrink-0 text-theme-500 dark:text-theme-300">LAN IP</dt>
                <dd className="flex min-w-0 items-center justify-end gap-2 text-right text-xs">
                  <span className="min-w-0 break-all font-mono">{details.lanIp}</span>
                  <button
                    type="button"
                    aria-label="LAN IP kopieren"
                    onClick={() => copy("IP kopiert", details.lanIp)}
                    className="shrink-0 rounded p-1.5 text-theme-400 transition-colors duration-150 active:bg-theme-200 hover:bg-theme-200/70 hover:text-theme-700 focus-visible:outline-2 focus-visible:outline-theme-500 dark:hover:bg-white/10 dark:hover:text-theme-100"
                  >
                    <FiCopy aria-hidden="true" size={13} />
                  </button>
                </dd>
              </div>
            )}
            {details.tailscaleIp && (
              <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                <dt className="shrink-0 text-theme-500 dark:text-theme-300">Tailscale IP</dt>
                <dd className="flex min-w-0 items-center justify-end gap-2 text-right text-xs">
                  <span className="min-w-0 break-all font-mono">{details.tailscaleIp}</span>
                  <button
                    type="button"
                    aria-label="Tailscale IP kopieren"
                    onClick={() => copy("IP kopiert", details.tailscaleIp)}
                    className="shrink-0 rounded p-1.5 text-theme-400 transition-colors duration-150 active:bg-theme-200 hover:bg-theme-200/70 hover:text-theme-700 focus-visible:outline-2 focus-visible:outline-theme-500 dark:hover:bg-white/10 dark:hover:text-theme-100"
                  >
                    <FiCopy aria-hidden="true" size={13} />
                  </button>
                </dd>
              </div>
            )}
          </dl>
        )}

        <div className="flex flex-wrap gap-2 px-5 pt-5">
          {details.sshCommand && (
            <button
              type="button"
              onClick={() => copy("SSH-Befehl kopiert", details.sshCommand)}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-theme-300 bg-white px-3 py-2 text-xs font-medium text-theme-700 transition-colors duration-150 active:bg-theme-200 hover:border-theme-400 hover:bg-theme-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-500 dark:border-white/15 dark:bg-white/10 dark:text-theme-100 dark:hover:bg-white/15"
            >
              <FiTerminal aria-hidden="true" size={14} />
              SSH-Befehl kopieren
            </button>
          )}
          {(details.lanIp || details.tailscaleIp) && (
            <button
              type="button"
              onClick={() => copy("IP kopiert", details.lanIp ?? details.tailscaleIp)}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-theme-300 bg-white px-3 py-2 text-xs font-medium text-theme-700 transition-colors duration-150 active:bg-theme-200 hover:border-theme-400 hover:bg-theme-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-500 dark:border-white/15 dark:bg-white/10 dark:text-theme-100 dark:hover:bg-white/15"
            >
              <FiCopy aria-hidden="true" size={14} />
              IP kopieren
            </button>
          )}
        </div>
        <p
          role="status"
          aria-live="polite"
          className="min-h-7 px-5 pt-2 text-xs font-medium text-theme-500 dark:text-theme-300"
        >
          {copied}
        </p>

        {details.links?.length > 0 && (
          <nav className="px-5 pb-5 pt-2" aria-label="Schnellzugriff">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-theme-500 dark:text-theme-300">
              Schnellzugriff
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {details.links.map((link) => (
                <a
                  className="inline-flex min-w-0 items-center justify-between gap-3 rounded-lg border border-theme-200/80 bg-white/70 px-3 py-2.5 text-sm font-medium text-theme-700 transition-[border-color,background-color,transform] duration-150 motion-safe:hover:-translate-y-px active:translate-y-0 hover:border-theme-400 hover:bg-theme-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-500 dark:border-white/10 dark:bg-white/5 dark:text-theme-100 dark:hover:bg-white/10"
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  key={link.label}
                >
                  {link.label}
                  <FiExternalLink className="shrink-0 text-theme-400" aria-hidden="true" size={14} />
                </a>
              ))}
            </div>
          </nav>
        )}
      </section>
    </div>,
    document.body,
  );
}
