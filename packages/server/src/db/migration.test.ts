import { describe, expect, test } from "vitest";
import { compareVersions, parseAppVersion, parseMigrationVersion } from "./migration";

describe("versioned migrations", () => {
  test("sorts migration versions numerically", () => {
    const names = ["v1.10.0.sql", "v1.0.0.sql", "v1.2.0.sql"];

    expect(
      names.sort((a, b) => compareVersions(parseMigrationVersion(a), parseMigrationVersion(b))),
    ).toEqual(["v1.0.0.sql", "v1.2.0.sql", "v1.10.0.sql"]);
  });

  test("parses app versions without a leading v", () => {
    expect(parseAppVersion("1.2.3")).toEqual([1, 2, 3]);
  });
});
