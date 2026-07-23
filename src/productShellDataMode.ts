export type ProductShellDataMode = "fixture" | "real-read-only";

export type ResolveProductShellDataModeInput = Readonly<{
  isDevelopment: boolean;
  search: string;
}>;

function decodeQueryComponent(value: string) {
  return decodeURIComponent(value.replace(/\+/g, " "));
}

function readMode(search: string) {
  const query = search.startsWith("?") ? search.slice(1) : search;

  if (!query) {
    return undefined;
  }

  for (const pair of query.split("&")) {
    if (!pair) {
      continue;
    }

    const separatorIndex = pair.indexOf("=");
    const rawKey = separatorIndex === -1 ? pair : pair.slice(0, separatorIndex);

    if (decodeQueryComponent(rawKey) !== "mode") {
      continue;
    }

    const rawValue = separatorIndex === -1 ? "" : pair.slice(separatorIndex + 1);
    return decodeQueryComponent(rawValue);
  }

  return undefined;
}

export function resolveProductShellDataMode({
  isDevelopment,
  search
}: ResolveProductShellDataModeInput): ProductShellDataMode {
  if (!isDevelopment) {
    return "fixture";
  }

  try {
    return readMode(search) === "real-read-only" ? "real-read-only" : "fixture";
  } catch {
    return "fixture";
  }
}
