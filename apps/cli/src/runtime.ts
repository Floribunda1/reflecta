import {
  readRuntimeAppConfig,
  resolveRuntimePaths,
  type BuildKind,
  type ResolvedRuntimePaths,
} from "@reflecta/server/runtime";
import os from "node:os";
import { CLI_BUILD_KIND } from "./build-kind";

export interface CliRuntimeOptions {
  appConfigDir?: string;
  contentRoot?: string;
  db?: string;
  buildKind?: BuildKind;
}

function resolveOnce(options: CliRuntimeOptions, appConfig?: { contentStorageRoot?: string }) {
  return resolveRuntimePaths({
    processKind: "cli",
    buildKind: options.buildKind ?? CLI_BUILD_KIND,
    platform: process.platform,
    homeDir: os.homedir(),
    platformAppDataDir: process.env.APPDATA,
    xdgConfigHome: process.env.XDG_CONFIG_HOME,
    xdgDataHome: process.env.XDG_DATA_HOME,
    explicitAppConfigDir: options.appConfigDir,
    explicitContentStorageRoot: options.contentRoot,
    explicitDbPath: options.db,
    appConfig,
  });
}

export function resolveCliRuntimePaths(options: CliRuntimeOptions = {}): ResolvedRuntimePaths {
  const preliminary = resolveOnce(options);
  const appConfig = readRuntimeAppConfig(preliminary.appConfigDir);
  return resolveOnce(options, appConfig);
}
