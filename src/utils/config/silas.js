// Opt-in metadata keeps the upstream configuration format usable without this theme.
function configured(value) {
  return value !== undefined && value !== null && String(value).trim() !== "" && !String(value).includes("{{");
}

function safeUrl(value, protocols = ["https:", "http:"]) {
  if (!configured(value)) return false;
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function safeSshUrl(value) {
  if (!configured(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "ssh:" && url.hostname && !url.password;
  } catch {
    return false;
  }
}

// Resolve after YAML parsing so quotes/newlines in secrets remain literal values.
export function substituteSilasValues(value, substitute) {
  if (typeof value === "string") return substitute(value);
  if (Array.isArray(value)) return value.map((item) => substituteSilasValues(item, substitute));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, substituteSilasValues(item, substitute)]),
    );
  }
  return value;
}

export function prepareSilasGroups(groups) {
  return groups.map((group) => ({
    ...group,
    groups: prepareSilasGroups(group.groups ?? []),
    services: group.services.flatMap((service) => {
      if (!service.silas) return [service];
      const result = { ...service };
      for (const key of ["href", "siteMonitor"]) {
        if (!safeUrl(result[key])) delete result[key];
      }
      if (!safeSshUrl(result.silas.sshUrl)) delete result.silas.sshUrl;
      if (result.silas.optional && !result.href) return [];
      const widgets = [result.widget, ...(result.widgets ?? [])].filter(Boolean);
      delete result.widget;
      result.widgets = widgets
        .filter((widget) => {
          const required = widget.silasRequired ?? [];
          const protocols = widget.type === "minecraft" ? ["udp:"] : ["https:", "http:"];
          return required.every((key) => configured(widget[key])) && (!widget.url || safeUrl(widget.url, protocols));
        })
        .map(({ silasRequired: _required, ...widget }) => widget);
      return [result];
    }),
  }));
}
