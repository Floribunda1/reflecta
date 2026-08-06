import { describe, expect, test } from "vitest";
import path from "node:path";
import { resolveRuntimePaths } from "./resolve";

describe("runtime path resolution", () => {
  test("release Electron and release CLI resolve to the same macOS production app config", () => {
    const homeDir = "/Users/alice";
    const electron = resolveRuntimePaths({
      processKind: "electron",
      buildKind: "release",
      electronAppDataDir: path.join(homeDir, "Library", "Application Support"),
      electronUserDataDir: path.join(homeDir, "Library", "Application Support", "reflecta"),
    });
    const cli = resolveRuntimePaths({
      processKind: "cli",
      buildKind: "release",
      platform: "darwin",
      homeDir,
    });

    expect(electron.dataTarget).toBe("prod");
    expect(cli.dataTarget).toBe("prod");
    expect(cli.appConfigDir).toBe(electron.appConfigDir);
    expect(cli.migrationPolicy).toBe("verify");
  });

  test("source product entrypoints default to dev data and do not run migrations", () => {
    const cli = resolveRuntimePaths({
      processKind: "cli",
      buildKind: "source",
      platform: "darwin",
      homeDir: "/Users/alice",
    });

    expect(cli.dataTarget).toBe("dev");
    expect(cli.appConfigDir).toBe("/Users/alice/Library/Application Support/reflecta-dev");
    expect(cli.contentStorageRoot).toBe("/Users/alice/Library/Application Support/reflecta-dev");
    expect(cli.migrationPolicy).toBe("disabled");
  });

  test("content storage root from app config defines db path while retrieval stays in app config", () => {
    const runtime = resolveRuntimePaths({
      processKind: "cli",
      buildKind: "release",
      platform: "darwin",
      homeDir: "/Users/alice",
      appConfig: {
        contentStorageRoot: "/Users/alice/Knowledge/reflecta-prod",
      },
    });

    expect(runtime.storeMode).toBe("full-store");
    expect(runtime.appConfigDir).toBe("/Users/alice/Library/Application Support/reflecta");
    expect(runtime.contentStorageRoot).toBe("/Users/alice/Knowledge/reflecta-prod");
    expect(runtime.dbPath).toBe("/Users/alice/Knowledge/reflecta-prod/reflecta.db");
    expect(runtime.retrievalIndexPath).toBe(
      "/Users/alice/Library/Application Support/reflecta/retrieval-index",
    );
  });

  test("explicit db path is isolated from full-store semantic search paths", () => {
    const runtime = resolveRuntimePaths({
      processKind: "cli",
      buildKind: "release",
      platform: "darwin",
      homeDir: "/Users/alice",
      explicitDbPath: "/tmp/reflecta-one-off/reflecta.db",
    });

    expect(runtime.storeMode).toBe("explicit-db");
    expect(runtime.contentStorageRoot).toBe("/tmp/reflecta-one-off");
    expect(runtime.dbPath).toBe("/tmp/reflecta-one-off/reflecta.db");
    expect(runtime.migrationPolicy).toBe("disabled");
  });

  test("scripts must choose dev or test data explicitly", () => {
    expect(() =>
      resolveRuntimePaths({
        processKind: "script",
        platform: "darwin",
        homeDir: "/Users/alice",
      }),
    ).toThrow(/requires explicit dev or test dataTarget/);
  });
});
