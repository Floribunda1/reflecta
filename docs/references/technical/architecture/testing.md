# 测试架构说明

Reflecta 的测试由 Vitest 和 Playwright 共同组成。Feature 驱动的产品验收与技术回归采用不同的测试意图，但都选择能提供可信证据的最小自动化层级。

## 测试入口

根目录命令：

```bash
bun run test
bun run typecheck
bun run fmt:check
bun run test:e2e
bun run test:e2e:acceptance
bun run test:e2e:regression
```

单包命令：

```bash
bun run --filter '@reflecta/cli' test
bun run --filter '@reflecta/electron' test
bun run --filter '@reflecta/electron' test:main
bun run --filter '@reflecta/electron' test:renderer
```

`bun run test` 会跑所有 workspace 的 `test` script。`@reflecta/server` 当前没有测试文件，Vitest 会以成功状态退出。

## 测试分层

| 层级              | 位置                                    | 说明                             |
| ----------------- | --------------------------------------- | -------------------------------- |
| CLI tests         | `apps/cli/test`                         | 测 CLI 命令、profile、DB 路径    |
| Electron main     | `apps/electron/src/main/**/*.test`      | 测 main process 服务和配置       |
| Electron renderer | `apps/electron/src/renderer/**/*.test`  | 测前端 store、组件和编辑器逻辑   |
| Feature contract  | `apps/electron/e2e/acceptance/feature`  | 集中维护按产品模块组织的 Feature |
| E2E acceptance    | `apps/electron/e2e/acceptance/<module>` | 通过真实入口验收产品 Feature     |
| E2E regression    | `apps/electron/e2e/regression`          | 保护必须经过真实应用的技术风险   |

Electron 的 `test` script 会先跑 main tests，再跑 renderer tests：

```bash
bun run test:main && bun run test:renderer
```

这样可以避免只从 renderer root 启动 Vitest 时漏掉 main process 测试。

## CLI 测试数据库

CLI 测试不依赖 `.env.test`，也不读取 `REFLECTA_TEST_DB_PATH`。

`apps/cli/test/setup.ts` 会为每个 Vitest worker/process 自动创建隔离 Content Storage Root：

```text
/tmp/reflecta-cli-test/<worker-id>/<pid>/
  reflecta.db
  config/reflecta-config.json
  config/retrieval-index/
```

setup 流程：

1. 创建临时目录。
2. 设置测试 harness env。
3. 运行 `apps/cli/scripts/seed-test-data.ts` 写入测试数据。
4. `test/helpers.ts` 把临时目录转成显式 `--content-root` / `--app-config-dir` 参数。
5. 测试结束后删除临时目录。

这个设计让并发 worker 不共享 SQLite 文件，避免测试互相污染。

## 路径环境变量规则

测试里也遵守产品路径模型：

| 使用方       | 入口                                     | 含义                    |
| ------------ | ---------------------------------------- | ----------------------- |
| CLI 测试     | helper 注入 `--content-root`             | 临时 Content Storage    |
| CLI 直查 DB  | `REFLECTA_DB_PATH`                       | 测试 helper 查询 SQLite |
| Drizzle dev  | `dev-db.ts` 传入 `REFLECTA_DB_PATH`      | 显式 dev SQLite 文件    |
| Electron E2E | `--reflecta-content-root` 等 launch 参数 | 临时 Content Storage    |

Reflecta 运行时代码不读取 `REFLECTA_PROFILE` 来决定 prod/dev，也不把 ambient env 当作 `--content-root` / `--db` 的替代来源。

## 测试数据

CLI 测试数据由 `apps/cli/scripts/seed-test-data.ts` 统一生成。

新增 CLI 测试时，优先复用这份 seed 数据。只有当测试确实需要特殊状态时，才在测试内部创建额外数据。不要依赖本机 dev/prod 数据库。

Electron main tests 如果需要文件系统状态，应使用临时目录并在 `afterEach` 清理。配置相关测试应 mock Electron `app.getPath()`，不要读取真实用户目录。

## E2E 测试数据库

Playwright 配置在 `apps/electron/playwright.config.ts`。完整运行和分 suite 运行的命令是：

```bash
bun run test:e2e
bun run test:e2e:acceptance
bun run test:e2e:regression
```

`acceptance/feature/<module>/` 集中维护产品契约，`acceptance/<module>/` 保存对应测试实现。每条 acceptance test 必须以稳定 Feature ID 开头。`regression/` 不维护 Feature 文件，也禁止使用 Feature ID。完整 E2E 在构建前运行 `bun run feature:check`，校验目录边界和映射。

人工 review Feature 变化时运行：

```bash
bun run feature:diff -- origin/master
```

输出按稳定 ID 汇总 Added、Removed、Changed 和 Moved，避免 reviewer 从目录级 diff 中手工重建产品契约变化。

E2E 复用 CLI 的 seed 数据，但不复用 CLI 的 DB 文件。

`apps/electron/e2e/global-setup.ts` 会创建临时 Content Storage Root，并运行 `apps/cli/scripts/seed-test-data.ts`：

```text
/tmp/reflecta-e2e-test/<pid>/reflecta.db
```

E2E 启动 Electron 时应使用 `apps/electron/e2e/test-env.ts`：

```ts
import { getE2eElectronArgs, getE2eElectronEnv } from "./test-env";
```

并把返回值分别传给 Electron launch 的 `args` 和 `env`：

- `args`：`--reflecta-user-data-dir` / `--reflecta-app-config-dir` / `--reflecta-content-root`
- `env`：AI key 等外部服务配置，不用于决定数据目标

测试结束后，`global-teardown.ts` 会删除临时目录。

当前 E2E 仍然没有 fake AI server。需要真实 AI key 的 acceptance 会按环境条件跳过；其余路径必须保持可独立回归。

## 新增测试的判断

优先加最小测试：

- 改 CLI 命令行为：加 `apps/cli/test/*.test.ts`。
- 改 DB path/profile：加 `apps/cli/test/profile.test.ts` 或 Electron config test。
- 改 Electron main 服务：加 `apps/electron/src/main/**/*.test.ts`。
- 改纯前端逻辑：加 renderer test。
- Feature 需要从真实用户入口证明跨进程或窗口行为时，放入 acceptance E2E。
- 技术风险只有在真实 Electron 边界无法替代时，才放入 regression E2E。
- 不需要真实应用边界的状态组合、事件边界和历史缺陷，优先使用 integration 或 unit。

不要为了产品里没有的功能写测试。测试应覆盖当前真实行为和已决定要交付的行为。
