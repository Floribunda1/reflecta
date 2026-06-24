import type { BuildKind } from "@reflecta/server/runtime";

declare const __REFLECTA_CLI_BUILD_KIND__: BuildKind | undefined;

export const CLI_BUILD_KIND: BuildKind =
  typeof __REFLECTA_CLI_BUILD_KIND__ === "string" &&
  (__REFLECTA_CLI_BUILD_KIND__ === "release" || __REFLECTA_CLI_BUILD_KIND__ === "source")
    ? __REFLECTA_CLI_BUILD_KIND__
    : "source";
