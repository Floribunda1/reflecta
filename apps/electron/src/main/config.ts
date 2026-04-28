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

const getConfigFilePath = () => path.join(app.getPath("userData"), "reflecta-config.json");

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
  fs.writeFileSync(getConfigFilePath(), JSON.stringify(config, null, 2), "utf-8");
}

/** Used by AssetService and db — resolves the effective storage root. */
export function getStorageRoot(): string {
  return readConfig().storagePath || app.getPath("userData");
}
