import { defineConfig } from "tsdown";
import path from "node:path";

const cliRoot = import.meta.dirname;

// 注：CLI 不执行数据迁移（Electron 是唯一迁移执行者，CLI 只做数据版本校验），
// 因此不需要把 migration 文件复制进产物。
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
  plugins: [],
});
