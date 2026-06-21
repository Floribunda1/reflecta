import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type ReflectaProfile = "dev" | "prod";

export function getReflectaProfile(defaultProfile: ReflectaProfile = "prod"): ReflectaProfile {
  return process.env.REFLECTA_PROFILE === "dev" || process.env.REFLECTA_PROFILE === "prod"
    ? process.env.REFLECTA_PROFILE
    : defaultProfile;
}

function appDirName(profile: ReflectaProfile): string {
  return profile === "dev" ? "reflecta-dev" : "reflecta";
}

export function getDefaultContentStorageRoot(profile = getReflectaProfile()): string {
  const home = os.homedir();
  const dirName = appDirName(profile);

  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", dirName);
  }

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), dirName);
  }

  return path.join(process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share"), dirName);
}

export function getAppConfigDir(profile = getReflectaProfile()): string {
  const home = os.homedir();
  const dirName = appDirName(profile);

  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", dirName);
  }

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), dirName);
  }

  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"), dirName);
}

export function readContentStorageRootFromConfig(
  profile = getReflectaProfile(),
): string | undefined {
  const configPath = path.join(getAppConfigDir(profile), "reflecta-config.json");
  if (!fs.existsSync(configPath)) return undefined;

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as { contentStorageRoot?: unknown };
    return typeof parsed.contentStorageRoot === "string" && parsed.contentStorageRoot.length > 0
      ? parsed.contentStorageRoot
      : undefined;
  } catch {
    return undefined;
  }
}

export function resolveProfileDbPath(profile = getReflectaProfile()): string {
  if (process.env.REFLECTA_DB_PATH) {
    return path.resolve(process.env.REFLECTA_DB_PATH);
  }

  const contentStorageRoot = readContentStorageRootFromConfig(profile);
  if (contentStorageRoot) {
    return path.join(contentStorageRoot, "reflecta.db");
  }

  return path.join(getDefaultContentStorageRoot(profile), "reflecta.db");
}
