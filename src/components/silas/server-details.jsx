import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { FiActivity, FiCopy, FiExternalLink, FiServer, FiTerminal, FiX } from "react-icons/fi";

import ResolvedIcon from "components/resolvedicon";
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-theme-200/80 bg-theme-50 text-theme-800 shadow-2xl shadow-theme-900/10 dark:border-white/10 dark:bg-theme-800 dark:text-theme-100"
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-theme-500 transition-colors hover:bg-theme-200/60 hover:text-theme-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-500 dark:text-theme-300 dark:hover:bg-white/10 dark:hover:text-theme-100"
            autoFocus
          >
            <FiX aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 px-5 pt-5">
          {[
            ["CPU", percent(cpu.data?.total), FiActivity],
            ["RAM", percent(memory.data?.percent), FiActivity],
            ["Disk", percent(filesystem?.percent), FiActivity],
          ].map(([label, value, Icon]) => (
            <div
              className="rounded-xl border border-theme-200/80 bg-white/70 p-3 text-center shadow-sm dark:border-white/10 dark:bg-white/5"
              key={label}
            >
              <div className="mb-2 flex justify-center text-theme-500 dark:text-theme-300">
                <Icon aria-hidden="true" size={15} />
              </div>
              <div className="text-lg font-semibold tracking-tight">{value}</div>
              <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-theme-500 dark:text-theme-300">
                {label}
              </div>
            </div>
          ))}
        </div>

        {(details.lanIp || details.tailscaleIp) && (
          <dl className="mx-5 mt-5 overflow-hidden rounded-xl border border-theme-200/80 bg-white/50 text-sm dark:border-white/10 dark:bg-white/5">
            {details.lanIp && (
              <div className="flex items-center justify-between gap-4 border-b border-theme-200/60 px-3 py-2.5 dark:border-white/10">
                <dt className="text-theme-500 dark:text-theme-300">LAN IP</dt>
                <dd className="flex items-center gap-2 font-mono text-xs">
                  {details.lanIp}
                  <button
                    type="button"
                    aria-label="LAN IP kopieren"
                    onClick={() => copy("IP kopiert", details.lanIp)}
                    className="rounded p-1 text-theme-400 transition-colors hover:bg-theme-200/70 hover:text-theme-700 focus-visible:outline-2 focus-visible:outline-theme-500 dark:hover:bg-white/10 dark:hover:text-theme-100"
                  >
                    <FiCopy aria-hidden="true" size={13} />
                  </button>
                </dd>
              </div>
            )}
            {details.tailscaleIp && (
              <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                <dt className="text-theme-500 dark:text-theme-300">Tailscale IP</dt>
                <dd className="flex items-center gap-2 font-mono text-xs">
                  {details.tailscaleIp}
                  <button
                    type="button"
                    aria-label="Tailscale IP kopieren"
                    onClick={() => copy("IP kopiert", details.tailscaleIp)}
                    className="rounded p-1 text-theme-400 transition-colors hover:bg-theme-200/70 hover:text-theme-700 focus-visible:outline-2 focus-visible:outline-theme-500 dark:hover:bg-white/10 dark:hover:text-theme-100"
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
              className="inline-flex items-center gap-2 rounded-lg border border-theme-300 bg-white px-3 py-2 text-xs font-medium text-theme-700 shadow-sm transition-colors hover:border-theme-400 hover:bg-theme-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-500 dark:border-white/15 dark:bg-white/10 dark:text-theme-100 dark:hover:bg-white/15"
            >
              <FiTerminal aria-hidden="true" size={14} />
              SSH-Befehl kopieren
            </button>
          )}
          {(details.lanIp || details.tailscaleIp) && (
            <button
              type="button"
              onClick={() => copy("IP kopiert", details.lanIp ?? details.tailscaleIp)}
              className="inline-flex items-center gap-2 rounded-lg border border-theme-300 bg-white px-3 py-2 text-xs font-medium text-theme-700 shadow-sm transition-colors hover:border-theme-400 hover:bg-theme-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-500 dark:border-white/15 dark:bg-white/10 dark:text-theme-100 dark:hover:bg-white/15"
            >
              <FiCopy aria-hidden="true" size={14} />
              IP kopieren
            </button>
          )}
        </div>
        {copied && <p className="px-5 pt-2 text-xs font-medium text-theme-500 dark:text-theme-300">{copied}</p>}

        {details.links?.length > 0 && (
          <nav className="px-5 pb-5 pt-5" aria-label="Schnellzugriff">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-theme-500 dark:text-theme-300">
              Schnellzugriff
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {details.links.map((link) => (
                <a
                  className="inline-flex items-center justify-between rounded-lg border border-theme-200/80 bg-white/70 px-3 py-2.5 text-sm font-medium text-theme-700 transition-colors hover:border-theme-300 hover:bg-theme-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-500 dark:border-white/10 dark:bg-white/5 dark:text-theme-100 dark:hover:bg-white/10"
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  key={link.label}
                >
                  {link.label}
                  <FiExternalLink aria-hidden="true" size={14} />
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
