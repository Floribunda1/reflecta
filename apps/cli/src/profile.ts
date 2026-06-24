import { readRuntimeAppConfig, resolveRuntimePaths } from "@reflecta/server/runtime";
import os from "node:os";

export type ReflectaProfile = "dev" | "prod";

function buildKindForProfile(profile: ReflectaProfile) {
  return profile === "prod" ? "release" : "source";
}

function resolveProfileRuntime(profile: ReflectaProfile) {
  const preliminary = resolveRuntimePaths({
    processKind: "cli",
    buildKind: buildKindForProfile(profile),
    platform: process.platform,
    homeDir: os.homedir(),
    platformAppDataDir: process.env.APPDATA,
    xdgConfigHome: process.env.XDG_CONFIG_HOME,
    xdgDataHome: process.env.XDG_DATA_HOME,
  });
  return resolveRuntimePaths({
    processKind: "cli",
    buildKind: buildKindForProfile(profile),
    platform: process.platform,
    homeDir: os.homedir(),
    platformAppDataDir: process.env.APPDATA,
    xdgConfigHome: process.env.XDG_CONFIG_HOME,
    xdgDataHome: process.env.XDG_DATA_HOME,
    appConfig: readRuntimeAppConfig(preliminary.appConfigDir),
  });
}

export function getReflectaProfile(defaultProfile: ReflectaProfile = "prod"): ReflectaProfile {
  return defaultProfile;
}

export function getDefaultContentStorageRoot(profile: ReflectaProfile = "prod"): string {
  return resolveProfileRuntime(profile).contentStorageRoot;
}

export function getAppConfigDir(profile: ReflectaProfile = "prod"): string {
  return resolveProfileRuntime(profile).appConfigDir;
}

export function readContentStorageRootFromConfig(
  profile: ReflectaProfile = "prod",
): string | undefined {
  const config = readRuntimeAppConfig(resolveProfileRuntime(profile).appConfigDir);
  return config.contentStorageRoot;
}

export function resolveProfileDbPath(profile: ReflectaProfile = "prod"): string {
  return resolveProfileRuntime(profile).dbPath;
}
