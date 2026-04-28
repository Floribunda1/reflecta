import fs from "node:fs";
import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: {
    sourcemap: true,
  },
  entry: {
    index: "src/index.ts",
    "db/schema": "src/db/schema.ts",
  },
  format: "esm",
  inputOptions: {
    plugins: [
      {
        load(id) {
          if (!id.endsWith(".sql")) return null;
          return `export default ${JSON.stringify(fs.readFileSync(id, "utf8"))};`;
        },
        name: "sql-as-text",
      },
    ],
  },
  outDir: "dist",
  platform: "node",
  sourcemap: true,
  target: "node22",
});
