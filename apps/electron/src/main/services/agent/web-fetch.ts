import { isIP } from "node:net";

export type WebFetchOutput = {
  url: string;
  finalUrl?: string;
  title?: string;
  markdown: string;
  provider: "curl.md";
  truncated: boolean;
  blocked?: boolean;
  error?: string;
};

const CURL_MD_BASE_URL = "https://curl.md/";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_MARKDOWN_CHARS = 30_000;

export async function fetchWebPage(url: string): Promise<WebFetchOutput> {
  const target = parsePublicHttpUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildCurlMdUrl(target), {
      headers: { Accept: "text/markdown,text/plain;q=0.9,*/*;q=0.1" },
      signal: controller.signal,
    });
    const markdown = await response.text();
    const truncated = truncate(markdown);
    const blocked = isBlocked(response.status, markdown);

    return {
      url: target.toString(),
      finalUrl: extractFrontMatterValue(markdown, "url") ?? response.url,
      title: extractFrontMatterValue(markdown, "title"),
      markdown: truncated.value,
      provider: "curl.md",
      truncated: truncated.truncated,
      blocked: blocked || undefined,
      error: response.ok
        ? blocked
          ? "Page appears blocked or login-gated."
          : undefined
        : `curl.md returned HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      url: target.toString(),
      markdown: "",
      provider: "curl.md",
      truncated: false,
      blocked: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function parsePublicHttpUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("web_fetch only accepts absolute http/https URLs.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("web_fetch only accepts http/https URLs.");
  }

  if (isPrivateHost(parsed.hostname)) {
    throw new Error("web_fetch does not allow localhost or private network URLs.");
  }

  parsed.hash = "";
  return parsed;
}

export function buildCurlMdUrl(url: URL): string {
  return `${CURL_MD_BASE_URL}${url.toString()}`;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;

  const ipVersion = isIP(host);
  if (ipVersion === 4) return isPrivateIpv4(host);
  if (ipVersion === 6) return isPrivateIpv6(host);
  return false;
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIpv6(host: string): boolean {
  if (host.startsWith("::ffff:")) return isPrivateIpv4(host.slice("::ffff:".length));
  return (
    host === "::" ||
    host === "::1" ||
    host.startsWith("fe80:") ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  );
}

function truncate(markdown: string) {
  if (markdown.length <= MAX_MARKDOWN_CHARS) return { value: markdown, truncated: false };
  return {
    value: `${markdown.slice(0, MAX_MARKDOWN_CHARS)}\n\n[Content truncated by Reflecta.]`,
    truncated: true,
  };
}

function isBlocked(status: number, markdown: string): boolean {
  if ([401, 403, 429, 451].includes(status)) return true;
  return [
    "安全验证 - 知乎",
    "系统监测到您的网络环境存在异常",
    "您当前请求存在异常",
    '"code":40362',
    "captcha",
    "access denied",
  ].some((marker) => markdown.toLowerCase().includes(marker.toLowerCase()));
}

function extractFrontMatterValue(markdown: string, key: string): string | undefined {
  const match = markdown.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  const value = match?.[1]?.trim();
  return value && !["|", "|-", ">", ">-"].includes(value) ? value : undefined;
}
