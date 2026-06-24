import { defineConfig } from "tsdown";
import fs from "node:fs";
import path from "node:path";

/**
 * Rollup plugin to handle `?raw` imports for SQL files.
 * Reads the file and exports its contents as a default string.
 */
function rawSqlPlugin() {
  const resolvedPaths = new Map<string, string>();

  return {
    name: "raw-sql",
    resolveId(source: string, importer: string | undefined) {
      if (source.endsWith(".sql?raw")) {
        const realPath = path.resolve(path.dirname(importer ?? ""), source.replace("?raw", ""));
        resolvedPaths.set(source, realPath);
        return source;
      }
      return null;
    },
    load(id: string) {
      const realPath = resolvedPaths.get(id);
      if (realPath) {
        const content = fs.readFileSync(realPath, "utf-8");
        return `export default ${JSON.stringify(content)};`;
      }
      return null;
    },
  };
}

export default defineConfig({
  clean: true,
  define: {
    __REFLECTA_CLI_BUILD_KIND__: JSON.stringify(process.env.REFLECTA_CLI_BUILD_KIND ?? "release"),
  },
  dts: true,
  entry: ["src/index.ts"],
  format: "esm",
  outDir: "dist",
  platform: "node",
  sourcemap: true,
  target: "node22",
  deps: {
    alwaysBundle: [/^@reflecta\//],
  },
  plugins: [rawSqlPlugin()],
});
