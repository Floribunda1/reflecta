import { defineConfig } from "tsdown";

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
  plugins: [
    {
      name: "suppress-optional-web-worker",
      // elkjs 的 main.js 在 workerUrl 分支里 require('web-worker')；该分支
      // 被 runtime try/catch 守卫（require.resolve 失败即跳过），且本项目从不传
      // workerUrl，产物里该分支已被 tree-shake 掉。这是可选的浏览器 worker shim，
      // 并非缺失依赖，抑制其 UNRESOLVED_IMPORT 告警以免发布烟测误报。
      onLog(level, log) {
        if (
          log.code === "UNRESOLVED_IMPORT" &&
          log.id?.includes("elkjs") &&
          log.message.includes("web-worker")
        ) {
          return false;
        }
      },
    },
  ],
});
