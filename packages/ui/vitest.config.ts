import { defineConfig } from "vitest/config";

// X6 提供 lib(CJS) + es(ESM)。vitest(SSR) 默认以 CJS(main) 解析并在 type:module 下报
// "exports is not defined"；其 es 构建含有目录导入（./shape），脱离 vite 解析器无法在 Node ESM 跑。
// 方案：把 X6 及相关包 inline 交给 vite 解析器处理，并优先 module(mainFields) 字段 → 命中 es 构建，
// 目录导入由 vite 解析 → 与应用构建行为一致。仅涉及画布测试；其余用例不引入 X6。
// 各测试文件通过顶部 `// @vitest-environment happy-dom` pragma 自选环境，此处不强制。
export default defineConfig({
  resolve: {
    mainFields: ["module", "main"],
  },
  test: {
    server: {
      deps: {
        inline: ["@antv/x6", "@antv/x6-react-shape"],
      },
    },
  },
});
