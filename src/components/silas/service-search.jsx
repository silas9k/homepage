import classNames from "classnames";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ResolvedIcon from "components/resolvedicon";

function flattenServices(groups, parentGroup = "") {
  return (groups ?? []).flatMap((group) => [
    ...(group.services ?? []).map((service) => ({ ...service, groupName: group.name || parentGroup })),
    ...flattenServices(group.groups, group.name || parentGroup),
  ]);
}

function getMatchRank(service, query) {
  const name = service.name?.toLowerCase() ?? "";
  const description = service.description?.toLowerCase() ?? "";
  const group = service.groupName?.toLowerCase() ?? "";

  if (name.startsWith(query)) return 0;
  if (name.includes(query)) return 1;
  if (description.includes(query)) return 2;
  if (group.includes(query)) return 3;
  return -1;
}

function activateService(service) {
  const cards = [...document.querySelectorAll(".service[data-name]")];
  const serviceElement = cards.find((element) => element.dataset.name === service.name);
  const card = serviceElement?.querySelector(".service-card");
  if (card && !card.getAttribute("aria-disabled")) {
    card.click();
  }
}

export default function ServiceSearch({ services, isOpen, setSearching, searchString, setSearchString }) {
  const inputRef = useRef(null);
  const openerRef = useRef(null);
  const skipFocusRestore = useRef(false);
  const selectedResultRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const allServices = useMemo(() => flattenServices(services), [services]);
  const results = useMemo(() => {
    const query = searchString.trim().toLowerCase();
    if (!query) return allServices;

    return allServices
      .map((service, index) => ({ service, index, rank: getMatchRank(service, query) }))
      .filter((result) => result.rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map((result) => result.service);
  }, [allServices, searchString]);

  const close = useCallback(() => {
    setSearching(false);
    setSearchString("");
    setActiveIndex(0);
  }, [setSearching, setSearchString]);

  useEffect(() => {
    if (!isOpen) return undefined;

    skipFocusRestore.current = false;
    openerRef.current = document.activeElement;
    inputRef.current?.focus();
    return () => {
      if (openerRef.current && !skipFocusRestore.current) openerRef.current.focus();
    };
  }, [isOpen]);

  const selectedIndex = Math.min(activeIndex, Math.max(0, results.length - 1));

  const selectResult = (service) => {
    if (
      ["planned", "stopped"].includes(service.silas?.state) ||
      (!service.silas?.details && (!service.href || service.href === "#"))
    )
      return;
    skipFocusRestore.current = true;
    close();
    activateService(service);
  };

  useEffect(() => {
    selectedResultRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(0, results.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      selectResult(results[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={classNames(
        "fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh] sm:p-8 sm:pt-[15vh]",
        !isOpen && "pointer-events-none invisible opacity-0",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Dienste suchen"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="flex max-h-[min(70vh,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-md border border-theme-300/60 bg-theme-50 shadow-xl dark:border-theme-700 dark:bg-theme-800">
        <input
          ref={inputRef}
          value={searchString}
          onChange={(event) => {
            setSearchString(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Dienste suchen …"
          aria-label="Dienste suchen"
          aria-controls="silas-service-search-results"
          aria-activedescendant={results[selectedIndex] ? `silas-service-result-${selectedIndex}` : undefined}
          className="w-full shrink-0 border-0 border-b border-theme-300/60 bg-transparent p-4 text-base text-theme-700 outline-none focus:border-theme-500 focus:ring-1 focus:ring-theme-500/30 dark:border-theme-700 dark:text-theme-200 dark:focus:border-theme-400 dark:focus:ring-theme-400/30"
        />
        <ul
          id="silas-service-search-results"
          role="listbox"
          className="silas-service-search-results min-h-0 flex-1 overflow-y-auto p-2"
        >
          {results.length === 0 ? (
            <li className="p-4 text-sm text-theme-500" role="status">
              Keine Dienste gefunden
            </li>
          ) : (
            results.map((service, index) => {
              const inactiveState = ["planned", "stopped"].includes(service.silas?.state);
              const actionable = !inactiveState && (service.silas?.details || (service.href && service.href !== "#"));
              return (
                <li
                  key={`${service.name}-${service.groupName}-${index}`}
                  id={`silas-service-result-${index}`}
                  ref={index === selectedIndex ? selectedResultRef : undefined}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <button
                    type="button"
                    className={classNames(
                      "flex w-full items-center gap-3 rounded-md p-3 text-left text-sm text-theme-700 dark:text-theme-200",
                      index === selectedIndex && "bg-theme-300/40 dark:bg-theme-700/50",
                      !actionable && "cursor-default opacity-50",
                    )}
                    disabled={!actionable}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectResult(service)}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                      {service.icon ? <ResolvedIcon icon={service.icon} /> : service.name?.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{service.name}</span>
                      <span className="block truncate text-xs text-theme-500">
                        {service.description || service.groupName}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
