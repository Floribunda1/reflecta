import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockHome = vi.hoisted(() => ({ value: "" }));

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return {
    ...actual,
    default: { ...actual.default, homedir: () => mockHome.value },
    homedir: () => mockHome.value,
  };
});

let tempDir: string;
const originalDbPath = process.env.REFLECTA_DB_PATH;
const originalAppConfigDir = process.env.REFLECTA_APP_CONFIG_DIR;
const originalContentStorageRoot = process.env.REFLECTA_CONTENT_STORAGE_ROOT;
const originalProfile = process.env.REFLECTA_PROFILE;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-cli-profile-"));
  mockHome.value = path.join(tempDir, "home");
  delete process.env.REFLECTA_DB_PATH;
  delete process.env.REFLECTA_APP_CONFIG_DIR;
  delete process.env.REFLECTA_CONTENT_STORAGE_ROOT;
  delete process.env.REFLECTA_PROFILE;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDbPath === undefined) delete process.env.REFLECTA_DB_PATH;
  else process.env.REFLECTA_DB_PATH = originalDbPath;
  if (originalAppConfigDir === undefined) delete process.env.REFLECTA_APP_CONFIG_DIR;
  else process.env.REFLECTA_APP_CONFIG_DIR = originalAppConfigDir;
  if (originalContentStorageRoot === undefined) delete process.env.REFLECTA_CONTENT_STORAGE_ROOT;
  else process.env.REFLECTA_CONTENT_STORAGE_ROOT = originalContentStorageRoot;
  if (originalProfile === undefined) delete process.env.REFLECTA_PROFILE;
  else process.env.REFLECTA_PROFILE = originalProfile;
});

describe("resolveProfileDbPath", () => {
  it("ignores REFLECTA_DB_PATH", async () => {
    const profile = await import("../src/profile");
    const dbPath = path.join(tempDir, "explicit.db");
    process.env.REFLECTA_DB_PATH = dbPath;

    expect(profile.resolveProfileDbPath("prod")).toBe(
      path.join(profile.getDefaultContentStorageRoot("prod"), "reflecta.db"),
    );
  });

  it("uses contentStorageRoot from desktop config", async () => {
    const profile = await import("../src/profile");
    const contentStorageRoot = path.join(tempDir, "content-root");
    fs.mkdirSync(profile.getAppConfigDir("prod"), { recursive: true });
    fs.writeFileSync(
      path.join(profile.getAppConfigDir("prod"), "reflecta-config.json"),
      JSON.stringify({ contentStorageRoot }),
    );

    expect(profile.resolveProfileDbPath("prod")).toBe(path.join(contentStorageRoot, "reflecta.db"));
  });

  it("ignores REFLECTA_APP_CONFIG_DIR", async () => {
    const profile = await import("../src/profile");
    const appConfigDir = path.join(tempDir, "explicit-config");
    const contentStorageRoot = path.join(tempDir, "content-root");
    process.env.REFLECTA_APP_CONFIG_DIR = appConfigDir;
    fs.mkdirSync(appConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(appConfigDir, "reflecta-config.json"),
      JSON.stringify({ contentStorageRoot }),
    );

    expect(profile.resolveProfileDbPath("prod")).toBe(
      path.join(profile.getDefaultContentStorageRoot("prod"), "reflecta.db"),
    );
  });

  it("does not read REFLECTA_CONTENT_STORAGE_ROOT", async () => {
    const profile = await import("../src/profile");
    process.env.REFLECTA_CONTENT_STORAGE_ROOT = path.join(tempDir, "ignored-content-root");

    expect(profile.resolveProfileDbPath("prod")).toBe(
      path.join(profile.getDefaultContentStorageRoot("prod"), "reflecta.db"),
    );
  });

  it("does not let REFLECTA_PROFILE turn dev into prod", async () => {
    const profile = await import("../src/profile");
    process.env.REFLECTA_PROFILE = "prod";

    expect(profile.getReflectaProfile("dev")).toBe("dev");
    expect(profile.resolveProfileDbPath("dev")).toBe(
      path.join(profile.getDefaultContentStorageRoot("dev"), "reflecta.db"),
    );
  });
});
