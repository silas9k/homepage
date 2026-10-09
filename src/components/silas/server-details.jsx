import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { parseVersionForUrl } from "utils/proxy/api-helpers";
import useWidgetAPI from "utils/proxy/use-widget-api";

function percent(value) {
  return Number.isFinite(value)
    ? `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value)} %`
    : "—";
}

export default function ServerDetails({ service, onClose }) {
  const [copied, setCopied] = useState("");
  const titleId = useId();
  const configuredWidget = service.widgets?.find((item) => item.type === "glances");
  const widget = configuredWidget ?? { type: "glances", url: "" };
  const version = parseVersionForUrl(widget.version, 4);
  const cpu = useWidgetAPI(widget, configuredWidget ? `${version}/cpu` : "");
  const memory = useWidgetAPI(widget, configuredWidget ? `${version}/mem` : "");
  const disk = useWidgetAPI(widget, configuredWidget ? `${version}/fs` : "");
  const filesystem = Array.isArray(disk.data) ? disk.data.find((item) => item.mnt_point === "/") : undefined;
  const details = service.silas.details;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const copy = async (label, value) => {
    if (!value || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="w-full max-w-md rounded-lg bg-theme-50 p-4 text-theme-800 shadow-xl dark:bg-theme-800 dark:text-theme-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              {service.name}
            </h2>
            <p className="text-xs font-light text-theme-500 dark:text-theme-300">
              {details.host ?? service.silas.host}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Details schließen" className="text-lg" autoFocus>
            ×
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["CPU", percent(cpu.data?.total)],
            ["RAM", percent(memory.data?.percent)],
            ["Disk", percent(filesystem?.percent)],
          ].map(([label, value]) => (
            <div className="rounded-md bg-theme-200/40 p-2 text-center dark:bg-white/10" key={label}>
              <div className="text-sm font-semibold">{value}</div>
              <div className="text-xs text-theme-500 dark:text-theme-300">{label}</div>
            </div>
          ))}
        </div>

        {(details.lanIp || details.tailscaleIp) && (
          <dl className="mt-4 space-y-1 text-sm">
            {details.lanIp && (
              <div className="flex justify-between gap-4">
                <dt>LAN IP</dt>
                <dd>{details.lanIp}</dd>
              </div>
            )}
            {details.tailscaleIp && (
              <div className="flex justify-between gap-4">
                <dt>Tailscale IP</dt>
                <dd>{details.tailscaleIp}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {details.sshCommand && (
            <button
              type="button"
              onClick={() => copy("SSH-Befehl kopiert", details.sshCommand)}
              className="rounded border px-2 py-1 text-xs"
            >
              SSH-Befehl kopieren
            </button>
          )}
          {(details.lanIp || details.tailscaleIp) && (
            <button
              type="button"
              onClick={() => copy("IP kopiert", details.lanIp ?? details.tailscaleIp)}
              className="rounded border px-2 py-1 text-xs"
            >
              IP kopieren
            </button>
          )}
        </div>
        {copied && <p className="mt-2 text-xs text-theme-500">{copied}</p>}

        {details.links?.length > 0 && (
          <nav className="mt-4 flex flex-wrap gap-3 text-sm" aria-label="Schnellzugriff">
            {details.links.map((link) => (
              <a className="underline" href={link.href} target="_blank" rel="noreferrer" key={link.label}>
                {link.label}
              </a>
            ))}
          </nav>
        )}
      </section>
    </div>,
    document.body,
  );
}
