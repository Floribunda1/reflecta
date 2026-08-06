import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type ProcessKind = "electron" | "cli" | "test" | "script";
export type BuildKind = "release" | "source";
export type DataTarget = "prod" | "dev" | "test";
export type StoreMode = "full-store" | "explicit-db";
export type MigrationPolicy = "auto" | "verify" | "disabled" | "dev-only";

export interface RuntimeAppConfig {
  contentStorageRoot?: string;
}

export interface ResolveRuntimePathsInput {
  processKind: ProcessKind;
  buildKind?: BuildKind;
  dataTarget?: DataTarget;
  platform?: NodeJS.Platform;
  homeDir?: string;
  platformAppDataDir?: string;
  xdgConfigHome?: string;
  xdgDataHome?: string;
  electronAppDataDir?: string;
  electronUserDataDir?: string;
  explicitAppConfigDir?: string;
  explicitContentStorageRoot?: string;
  explicitDbPath?: string;
  appConfig?: RuntimeAppConfig;
}

export interface ResolvedRuntimePaths {
  processKind: ProcessKind;
  buildKind?: BuildKind;
  dataTarget: DataTarget;
  storeMode: StoreMode;
  migrationPolicy: MigrationPolicy;
  appConfigDir: string;
  contentStorageRoot: string;
  dbPath: string;
  retrievalIndexPath: string;
}

function appDirName(dataTarget: DataTarget): string {
  return dataTarget === "prod" ? "reflecta" : `reflecta-${dataTarget}`;
}

function requireProductBuildKind(input: ResolveRuntimePathsInput): BuildKind {
  if (input.buildKind === "release" || input.buildKind === "source") {
    return input.buildKind;
  }

  throw new Error(`${input.processKind} runtime requires buildKind.`);
}

function defaultDataTarget(input: ResolveRuntimePathsInput): DataTarget {
  if (input.processKind === "electron" || input.processKind === "cli") {
    return requireProductBuildKind(input) === "release" ? "prod" : "dev";
  }

  if (input.processKind === "test") {
    return "test";
  }

  if (input.processKind === "script") {
    if (input.dataTarget === "dev" || input.dataTarget === "test") {
      return input.dataTarget;
    }
    throw new Error("script runtime requires explicit dev or test dataTarget.");
  }

  throw new Error(`Unsupported process kind: ${input.processKind}`);
}

function resolveAbsolute(value: string): string {
  return path.resolve(value);
}

function defaultCliAppConfigDir(input: ResolveRuntimePathsInput, dataTarget: DataTarget): string {
  const platform = input.platform ?? process.platform;
  const homeDir = input.homeDir ?? os.homedir();
  const dirName = appDirName(dataTarget);

  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", dirName);
  }

  if (platform === "win32") {
    return path.join(input.platformAppDataDir ?? path.join(homeDir, "AppData", "Roaming"), dirName);
  }

  return path.join(input.xdgConfigHome ?? path.join(homeDir, ".config"), dirName);
}

function defaultCliContentStorageRoot(
  input: ResolveRuntimePathsInput,
  dataTarget: DataTarget,
): string {
  const platform = input.platform ?? process.platform;
  const homeDir = input.homeDir ?? os.homedir();
  const dirName = appDirName(dataTarget);

  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", dirName);
  }

  if (platform === "win32") {
    return path.join(input.platformAppDataDir ?? path.join(homeDir, "AppData", "Roaming"), dirName);
  }

  return path.join(input.xdgDataHome ?? path.join(homeDir, ".local", "share"), dirName);
}

function defaultElectronAppConfigDir(
  input: ResolveRuntimePathsInput,
  dataTarget: DataTarget,
): string {
  if (dataTarget === "prod") {
    if (!input.electronUserDataDir) {
      throw new Error("electron release runtime requires electronUserDataDir.");
    }
    return input.electronUserDataDir;
  }

  if (!input.electronAppDataDir) {
    throw new Error("electron source runtime requires electronAppDataDir.");
  }
  return path.join(input.electronAppDataDir, appDirName(dataTarget));
}

function defaultElectronContentStorageRoot(
  input: ResolveRuntimePathsInput,
  dataTarget: DataTarget,
): string {
  return defaultElectronAppConfigDir(input, dataTarget);
}

function defaultAppConfigDir(input: ResolveRuntimePathsInput, dataTarget: DataTarget): string {
  if (input.explicitAppConfigDir) return resolveAbsolute(input.explicitAppConfigDir);
  if (input.processKind === "electron") return defaultElectronAppConfigDir(input, dataTarget);
  return defaultCliAppConfigDir(input, dataTarget);
}

function defaultContentStorageRoot(
  input: ResolveRuntimePathsInput,
  dataTarget: DataTarget,
): string {
  if (input.processKind === "electron") {
    return defaultElectronContentStorageRoot(input, dataTarget);
  }
  return defaultCliContentStorageRoot(input, dataTarget);
}

function migrationPolicy(
  input: ResolveRuntimePathsInput,
  buildKind: BuildKind | undefined,
  storeMode: StoreMode,
): MigrationPolicy {
  if (storeMode === "explicit-db") {
    return "disabled";
  }

  if (input.processKind === "electron") {
    return buildKind === "release" ? "auto" : "disabled";
  }

  if (input.processKind === "cli") {
    // A7：CLI 不执行迁移，只做数据版本校验（Electron 是唯一迁移执行者）
    return buildKind === "release" ? "verify" : "disabled";
  }

  if (input.processKind === "script") {
    return "dev-only";
  }

  return "disabled";
}

export function readRuntimeAppConfig(appConfigDir: string): RuntimeAppConfig {
  const configPath = path.join(appConfigDir, "reflecta-config.json");
  if (!fs.existsSync(configPath)) return {};

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
      contentStorageRoot?: unknown;
    };
    return typeof parsed.contentStorageRoot === "string" && parsed.contentStorageRoot.length > 0
      ? { contentStorageRoot: parsed.contentStorageRoot }
      : {};
  } catch {
    return {};
  }
}

export function resolveRuntimePaths(input: ResolveRuntimePathsInput): ResolvedRuntimePaths {
  const buildKind =
    input.processKind === "electron" || input.processKind === "cli"
      ? requireProductBuildKind(input)
      : input.buildKind;
  const dataTarget = defaultDataTarget(input);
  const appConfigDir = defaultAppConfigDir(input, dataTarget);
  const storeMode =
    input.explicitDbPath && !input.explicitContentStorageRoot ? "explicit-db" : "full-store";
  const contentStorageRoot = resolveAbsolute(
    input.explicitContentStorageRoot ??
      input.appConfig?.contentStorageRoot ??
      (input.explicitDbPath
        ? path.dirname(input.explicitDbPath)
        : defaultContentStorageRoot(input, dataTarget)),
  );
  const dbPath = resolveAbsolute(
    input.explicitDbPath ?? path.join(contentStorageRoot, "reflecta.db"),
  );

  return {
    processKind: input.processKind,
    buildKind,
    dataTarget,
    storeMode,
    migrationPolicy: migrationPolicy(input, buildKind, storeMode),
    appConfigDir,
    contentStorageRoot,
    dbPath,
    retrievalIndexPath: path.join(appConfigDir, "retrieval-index"),
  };
}
