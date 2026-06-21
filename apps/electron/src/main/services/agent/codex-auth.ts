import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TOKEN_URL = "https://auth.openai.com/oauth/token";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const JWT_CLAIM_PATH = "https://api.openai.com/auth";
const REFRESH_WINDOW_MS = 60_000;

type CodexAuthFile = {
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    account_id?: string;
  };
  last_refresh?: string;
};

type CodexCredentials = {
  accessToken: string;
  accountId: string;
};

function codexAuthPath(): string {
  return path.join(os.homedir(), ".codex", "auth.json");
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function accountIdFromToken(token: string): string | undefined {
  const payload = decodeJwtPayload(token);
  const auth = payload?.[JWT_CLAIM_PATH];
  if (!auth || typeof auth !== "object") return undefined;
  const accountId = (auth as { chatgpt_account_id?: unknown }).chatgpt_account_id;
  return typeof accountId === "string" && accountId ? accountId : undefined;
}

function isExpiringSoon(token: string): boolean {
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === "number" && exp * 1000 <= Date.now() + REFRESH_WINDOW_MS;
}

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Codex token refresh failed (${response.status}): ${text || response.statusText}`,
    );
  }

  const json = (await response.json()) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
  };
  if (
    typeof json.access_token !== "string" ||
    typeof json.refresh_token !== "string" ||
    typeof json.expires_in !== "number"
  ) {
    throw new Error("Codex token refresh response missing fields");
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
  };
}

function readAuthFile(): { path: string; auth: CodexAuthFile } {
  const filePath = codexAuthPath();
  return {
    path: filePath,
    auth: JSON.parse(fs.readFileSync(filePath, "utf-8")) as CodexAuthFile,
  };
}

function writeAuthFile(filePath: string, auth: CodexAuthFile): void {
  fs.writeFileSync(filePath, `${JSON.stringify(auth, null, 2)}\n`, {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export async function getCodexCredentials(): Promise<CodexCredentials> {
  const envToken = process.env.CODEX_ACCESS_TOKEN;
  if (envToken) {
    const accountId = accountIdFromToken(envToken);
    if (!accountId) throw new Error("CODEX_ACCESS_TOKEN 缺少 Codex account id");
    return { accessToken: envToken, accountId };
  }

  let filePath: string;
  let auth: CodexAuthFile;
  try {
    ({ path: filePath, auth } = readAuthFile());
  } catch {
    throw new Error("未找到 Codex 登录信息。请先在终端运行 codex login。");
  }

  const accessToken = auth.tokens?.access_token;
  const refreshToken = auth.tokens?.refresh_token;
  if (!accessToken || !refreshToken) {
    throw new Error("未找到 Codex ChatGPT 登录信息。请先在终端运行 codex login。");
  }

  if (!isExpiringSoon(accessToken)) {
    const accountId = auth.tokens?.account_id || accountIdFromToken(accessToken);
    if (!accountId) throw new Error("Codex access token 缺少 account id");
    return { accessToken, accountId };
  }

  const refreshed = await refreshAccessToken(refreshToken);
  const accountId = accountIdFromToken(refreshed.accessToken);
  if (!accountId) throw new Error("刷新后的 Codex access token 缺少 account id");

  auth.tokens = {
    ...auth.tokens,
    access_token: refreshed.accessToken,
    refresh_token: refreshed.refreshToken,
    account_id: accountId,
  };
  auth.last_refresh = new Date().toISOString();
  writeAuthFile(filePath, auth);

  return { accessToken: refreshed.accessToken, accountId };
}
