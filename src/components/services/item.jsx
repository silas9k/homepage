import classNames from "classnames";
import { useCallback, useContext, useState } from "react";

import KubernetesStatus from "./kubernetes-status";
import Ping from "./ping";
import ProxmoxStatus from "./proxmox-status";
import SiteMonitor from "./site-monitor";
import Status from "./status";
import Widget from "./widget";

import ResolvedIcon from "components/resolvedicon";
import EmptyMetrics from "components/silas/empty-metrics";
import ServerDetails from "components/silas/server-details";
import SilasState from "components/silas/state";
import { SettingsContext } from "utils/contexts/settings";
import Docker from "widgets/docker/component";
import Kubernetes from "widgets/kubernetes/component";
import ProxmoxVM from "widgets/proxmoxvm/component";

export default function Item({ service, groupName, useEqualHeights }) {
  const hasLink = service.href && service.href !== "#";
  const { settings } = useContext(SettingsContext);
  const isDetailsLauncher = settings.silasTheme && service.silas?.details;
  const primaryHref = service.href;
  const isSilasLauncher = settings.silasTheme && ((service.href && service.href !== "#") || isDetailsLauncher);
  const showStats = service.showStats === false ? false : settings.showStats;
  const statusStyle = service.statusStyle !== undefined ? service.statusStyle : settings.statusStyle;
  const cardStyle =
    settings.cardStyle === "hairline"
      ? "shadow-xs inset-ring inset-ring-black/5 dark:inset-ring-white/5 hover:inset-ring-black/10 dark:hover:inset-ring-white/10"
      : "shadow-md shadow-theme-900/10 dark:shadow-theme-900/20";
  const [statsOpen, setStatsOpen] = useState(service.showStats);
  const [statsClosing, setStatsClosing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // set stats to closed after 300ms
  const closeStats = () => {
    if (statsOpen) {
      setStatsClosing(true);
      setTimeout(() => {
        setStatsOpen(false);
        setStatsClosing(false);
      }, 300);
    }
  };

  const closeDetails = useCallback(() => setDetailsOpen(false), []);

  const openService = () => {
    if (isDetailsLauncher) {
      setDetailsOpen(true);
      return;
    }
    const target = service.target ?? settings.target ?? "_blank";
    if (target === "_self") {
      window.location.assign(primaryHref);
      return;
    }
    window.open(primaryHref, target, "noopener,noreferrer");
  };

  const handleCardClick = (event) => {
    if (!isSilasLauncher) return;
    const interactive = event.target.closest("a, button, input, select, textarea, [data-service-card-control]");
    if (interactive && interactive !== event.currentTarget) return;
    openService();
  };

  const handleCardKeyDown = (event) => {
    if (!isSilasLauncher || event.target !== event.currentTarget || !["Enter", " ", "Spacebar"].includes(event.key))
      return;
    event.preventDefault();
    openService();
  };

  return (
    <li key={service.name} id={service.id} className="service" data-name={service.name || ""}>
      <div
        role={isSilasLauncher ? (isDetailsLauncher ? "button" : "link") : undefined}
        tabIndex={isSilasLauncher ? 0 : undefined}
        aria-label={isSilasLauncher ? `${service.name} öffnen` : undefined}
        aria-haspopup={isDetailsLauncher ? "dialog" : undefined}
        data-href={isDetailsLauncher ? undefined : isSilasLauncher ? service.href : undefined}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        className={classNames(
          settings.cardBlur !== undefined && `backdrop-blur${settings.cardBlur.length ? "-" : ""}${settings.cardBlur}`,
          useEqualHeights && "h-[calc(100%-0.5rem)]",
          cardStyle,
          "transition-all mb-2 p-1 rounded-md font-medium text-theme-700 dark:text-theme-200 dark:hover:text-theme-300 bg-theme-100/20 hover:bg-theme-300/20 dark:bg-white/5 dark:hover:bg-white/10 relative overflow-clip service-card",
          isSilasLauncher &&
            "silas-launcher cursor-pointer duration-200 hover:-translate-y-px hover:inset-ring-black/15 dark:hover:inset-ring-white/15 hover:bg-theme-300/30 dark:hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-500",
        )}
      >
        <div className="flex select-none z-0 service-title">
          {service.icon &&
            (hasLink && !settings.silasTheme ? (
              <a
                href={service.href}
                target={service.target ?? settings.target ?? "_blank"}
                rel="noreferrer"
                className="shrink-0 flex items-center justify-center w-12 service-icon z-10"
                aria-label={service.icon}
              >
                <ResolvedIcon icon={service.icon} />
              </a>
            ) : (
              <div className="shrink-0 flex items-center justify-center w-12 service-icon z-10">
                <ResolvedIcon icon={service.icon} />
              </div>
            ))}

          {hasLink && !settings.silasTheme ? (
            <a
              href={service.href}
              target={service.target ?? settings.target ?? "_blank"}
              rel="noreferrer"
              className="flex-1 flex items-center justify-between rounded-r-md service-title-text"
            >
              <div className="flex-1 px-2 py-2 text-sm text-left z-10 service-name">
                {service.name}
                <p className="text-theme-500 dark:text-theme-300 text-xs font-light service-description">
                  {service.description}
                </p>
              </div>
            </a>
          ) : (
            <div className="flex-1 flex items-center justify-between rounded-r-md service-title-text">
              <div className="flex-1 px-2 py-2 text-sm text-left z-10 service-name">
                {service.name}
                <p className="text-theme-500 dark:text-theme-300 text-xs font-light service-description">
                  {service.description}
                </p>
              </div>
            </div>
          )}

          <div
            className={`absolute top-0 right-0 flex flex-row justify-end ${
              statusStyle === "dot" ? "gap-0" : "gap-2 mr-2"
            } z-10 service-tags`}
          >
            {settings.silasTheme && (service.silas?.site || service.silas?.siteLabel) && (
              <span className="silas-site" title={service.silas.host}>
                {service.silas.siteLabel ?? settings.silasSites?.[service.silas.site] ?? service.silas.site}
              </span>
            )}
            {settings.silasTheme &&
              !service.silas?.state &&
              !service.siteMonitor &&
              !service.ping &&
              !service.container &&
              !service.app &&
              !service.proxmoxVMID && (
                <span
                  className="silas-status-unknown"
                  role="img"
                  aria-label="Status nicht konfiguriert"
                  title="Status nicht konfiguriert"
                />
              )}
            {service.ping && (
              <div className="shrink-0 flex items-center justify-center service-tag service-ping">
                <Ping groupName={groupName} serviceName={service.name} style={statusStyle} />
                <span className="sr-only">Ping status</span>
              </div>
            )}

            {service.siteMonitor && !service.silas?.state && (
              <div className="shrink-0 flex items-center justify-center service-tag service-site-monitor">
                <SiteMonitor groupName={groupName} serviceName={service.name} style={statusStyle} />
                <span className="sr-only">Site monitor status</span>
              </div>
            )}

            {service.container && (
              <button
                type="button"
                onClick={() => (statsOpen ? closeStats() : setStatsOpen(true))}
                className="shrink-0 flex items-center justify-center cursor-pointer service-tag service-container-stats"
              >
                <Status service={service} style={statusStyle} />
                <span className="sr-only">View container stats</span>
              </button>
            )}
            {service.app && !service.external && (
              <button
                type="button"
                onClick={() => (statsOpen ? closeStats() : setStatsOpen(true))}
                className="shrink-0 flex items-center justify-center cursor-pointer service-tag service-app"
              >
                <KubernetesStatus service={service} style={statusStyle} />
                <span className="sr-only">View container stats</span>
              </button>
            )}
            {service.proxmoxNode && service.proxmoxVMID && (
              <button
                type="button"
                onClick={() => (statsOpen ? closeStats() : setStatsOpen(true))}
                className="shrink-0 flex items-center justify-center cursor-pointer service-tag service-proxmoxstatus"
              >
                <ProxmoxStatus service={service} style={statusStyle} />
                <span className="sr-only">View Proxmox stats</span>
              </button>
            )}
          </div>
        </div>

        {service.container && service.server && (
          <div
            className={classNames(
              showStats || (statsOpen && !statsClosing) ? "max-h-[110px] opacity-100" : " max-h-0 opacity-0",
              "w-full overflow-hidden transition-all duration-300 ease-in-out service-stats",
            )}
          >
            {(showStats || statsOpen) && (
              <Docker service={{ widget: { container: service.container, server: service.server } }} />
            )}
          </div>
        )}
        {service.app && (
          <div
            className={classNames(
              showStats || (statsOpen && !statsClosing) ? "max-h-[55px] opacity-100" : " max-h-0 opacity-0",
              "w-full overflow-hidden transition-all duration-300 ease-in-out service-stats",
            )}
          >
            {(showStats || statsOpen) && (
              <Kubernetes
                service={{
                  widget: { namespace: service.namespace, app: service.app, podSelector: service.podSelector },
                }}
              />
            )}
          </div>
        )}
        {service.proxmoxNode && service.proxmoxVMID && (
          <div
            className={classNames(
              showStats || (statsOpen && !statsClosing) ? "max-h-[110px] opacity-100" : " max-h-0 opacity-0",
              "w-full overflow-hidden transition-all duration-300 ease-in-out service-stats",
            )}
          >
            {(showStats || statsOpen) && (
              <ProxmoxVM
                service={{
                  widget: {
                    node: service.proxmoxNode,
                    vmid: service.proxmoxVMID,
                    type: service.proxmoxType,
                  },
                }}
              />
            )}
          </div>
        )}

        {settings.silasTheme && service.silas?.state ? (
          <SilasState service={service} />
        ) : (
          <>
            {settings.silasTheme && service.widgets.length === 0 && (
              <EmptyMetrics groupName={groupName} service={service} />
            )}
            {service.widgets.map((widget) => (
              <Widget widget={widget} service={service} key={widget.index} />
            ))}
          </>
        )}
      </div>
      {detailsOpen && <ServerDetails service={service} onClose={closeDetails} />}
    </li>
  );
}
