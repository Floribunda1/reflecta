# @reflecta/server

Reflecta 的后端核心，采用分层架构：

```
┌─────────────────────────────────────────┐
│  GUI / CLI (Renderer / Terminal)        │
├─────────────────────────────────────────┤
│  Facade (IPC adapter / CLI framework)   │
├─────────────────────────────────────────┤
│  BFF                                    │
│  ├── electron (桌面端业务编排)           │
│  └── cli      (命令行业务编排)           │
├─────────────────────────────────────────┤
│  Core                                   │
│  ├── db       (schema + migration)       │
│  ├── types    (共享类型定义)             │
│  └── wiki-links (wiki 链接解析)          │
└─────────────────────────────────────────┘
```

## 分层说明

| 层级          | 职责                                             | 示例                                               |
| ------------- | ------------------------------------------------ | -------------------------------------------------- |
| **Core**      | 数据库定义、迁移脚本、纯工具函数，不依赖任何上层 | `db/schema.ts`, `db/migration.ts`, `wiki-links.ts` |
| **BFF**       | 面向消费端的业务编排层，按终端类型拆分           | `bff/electron/*`, `bff/cli/*`                      |
| **Facade**    | 协议适配层，负责把 BFF 能力桥接到具体终端        | Electron IPC handler / CLI argument parser         |
| **GUI / CLI** | 最终用户界面                                     | React 组件 / 终端命令                              |

### 为什么这样分层？

- **Core 独立**：schema、迁移、工具函数可以被任何上层复用，不绑定到具体产品形态。
- **BFF 按终端隔离**：electron BFF 返回完整 DTO 供 UI 绑定；CLI BFF 返回聚合结构（`ThoughtSummary`、`GraphNeighborhoodResult` 等），减少 agent 的 N+1 查询。
- **Facade 轻量**：只做协议转换（IPC / argv → BFF method call），不写业务逻辑。
- **上层无感知 Core**：GUI 和 CLI 只依赖 Facade，不直接触碰数据库。

## 目录结构

```
src/
├── db/                  # Core
│   ├── schema.ts
│   ├── migration.ts
│   └── index.ts
├── bff/
│   ├── electron/        # 桌面端 BFF
│   │   ├── thought-service.ts
│   │   ├── context-service.ts
│   │   ├── category-service.ts
│   │   ├── search-service.ts
│   │   ├── trash-service.ts
│   │   ├── shared.ts
│   │   ├── types.ts
│   │   └── index.ts
│   └── cli/             # 命令行 BFF
│       ├── thought-service.ts
│       ├── context-service.ts
│       ├── category-service.ts
│       ├── search-service.ts
│       ├── graph-service.ts
│       ├── snapshot-service.ts
│       ├── shared.ts
│       ├── types.ts
│       └── index.ts
├── types.ts             # Core 共享类型
├── wiki-links.ts        # Core 工具
└── index.ts
```

## 消费方式

```ts
// 桌面端
import { ThoughtService } from "@reflecta/server/bff/electron";

// 命令行
import { ThoughtService } from "@reflecta/server/bff/cli";

// 底层能力（不推荐上层直接使用）
import * as schema from "@reflecta/server/db/schema";
```
