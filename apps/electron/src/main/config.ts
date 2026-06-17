import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

export interface AiProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AppConfig {
  storagePath?: string;
  aiProvider?: AiProviderConfig;
}

export type ReflectaProfile = "dev" | "prod";

export function getReflectaProfile(): ReflectaProfile {
  if (process.env.REFLECTA_PROFILE === "dev" || process.env.REFLECTA_PROFILE === "prod") {
    return process.env.REFLECTA_PROFILE;
  }

  return app.isPackaged ? "prod" : "dev";
}

function getDefaultStorageRoot(): string {
  return getReflectaProfile() === "dev"
    ? path.join(app.getPath("appData"), "reflecta-dev")
    : app.getPath("userData");
}

const getConfigFilePath = () => path.join(getDefaultStorageRoot(), "reflecta-config.json");

let _cache: AppConfig | null = null;

export function readConfig(): AppConfig {
  if (_cache) return _cache;
  try {
    const raw = fs.readFileSync(getConfigFilePath(), "utf-8");
    _cache = JSON.parse(raw) as AppConfig;
  } catch {
    _cache = {};
  }
  return _cache;
}

export function writeConfig(partial: Partial<AppConfig>): void {
  const config = readConfig();
  Object.assign(config, partial);
  _cache = config;
  const configFilePath = getConfigFilePath();
  fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), "utf-8");
}

/** Used by AssetService and db — resolves the effective storage root. */
export function getStorageRoot(): string {
  return readConfig().storagePath || getDefaultStorageRoot();
}
