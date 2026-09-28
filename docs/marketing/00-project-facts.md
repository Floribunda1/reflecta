# Reflecta 仓库事实盘点与项目定位基线

调查范围：T-1；只新增本报告，不修改现有源码、README 或规范，不执行宣传发布、不编写下游宣传方案。调查日期：2026-09-28。代码基线：`864df299e4c6e49e820a78e6eb0e14da632a0489`（`chore(release): v2.0.7`，原始 git 输出见附录）。

证据规则：以下 `路径:L行号` 均相对仓库根目录，固定于上述代码基线；“实现证据”表示源码存在，并不等于完整运行验收通过。“产品主张”是设计目标，不是已证明的学习效果。“受众”是基于文档推导的画像，不是已获客统计。动态 GitHub 数据原始字段保存在本报告附录，便于离线审阅。未读取个人内容库、密钥或日志内容。

## (a) 项目是什么、解决什么问题

- **是什么**：Reflecta 是本地优先的桌面应用，帮助把学习、实践和对话沉淀为可追溯的个人理解。证据：`README.md:L8-L13`；桌面入口 `apps/electron/src/main/index.ts:L1-L5,L45-L79` 创建 Electron 窗口。早期开发阶段、推荐开发者从源码运行是 README 的明确限制，不能删掉这层限定。
- **问题定位**：经历和信息输入不自动转化为积累；单独保存结论，会丢失形成、验证、修正它的上下文。这是产品假设，非实验结论。证据：`README.md:L17-L28`、`docs/references/product/value-proposition.md:L30-L54`。
- **产品承载**：Understanding 记录个人判断，Context 记录具体上下文，Canvas 承载显式组织的理解结构，Domain 支持按领域回看。证据：`README.md:L19-L26`；实现见 (b)。不是把“个人理解”认证为世界真相：`docs/references/product/value-proposition.md:L30`。
- **AI 角色**：帮助追问、比较、读取内容及提出候选改动，理解与关系由用户确认。证据：`README.md:L28,L37-L40`，`apps/electron/src/main/services/agent/agent-system-prompt.md:L5-L34`。认知教练是提示词和产品取向，不构成保证提升认知的证据。

建议后续采用的定位基线（非发布稿）：**面向愿意主动学习和复盘的人，以理解、上下文和画布组织个人思考的本地优先桌面工具；AI 帮助思考并提出候选修改。** 每一部分分别受上述证据和下列功能边界约束。

## (b) 核心卖点清单：仅保留有实现或明确文档证据的条目

| 可使用的事实表述                                                   | 仓库实现证据                                                                                                                                                                                                              | 宣传边界 / 验证等级                                                                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 按领域创建、编辑和回看个人理解                                     | `packages/server/src/domains/understanding/core.ts:L73-L117,L145-L180,L193-L217`；`packages/server/src/domains/domain/core.ts:L44-L67`；`README.md:L34`                                                                   | 源码存在；未在桌面端逐项实测。不能承诺自动生成正确理解。                                                                                                                    |
| 为理解保留材料、经历、对话等上下文                                 | `packages/server/src/domains/context/core.ts:L41-L49,L76-L98` 将 `understandingId / medium / title / content` 存入上下文；`README.md:L38`                                                                                 | 保存上下文的能力不等于自动导入所有书籍、视频或网站。                                                                                                                        |
| 显式画布组织理解卡片及带标签的关系                                 | `packages/shared/src/canvas/schema.ts:L26-L54,L77-L92` 定义元素、源/目标与 label；`packages/server/src/domains/understanding-canvas/core.ts:L135-L152,L382-L385`；`README.md:L35-L36`                                     | 推导、依赖、场景、约束是用户表达的关系语义，不能说系统已证明因果。多画布引用和删除占位为 README 明示；核心引用读取保留 deleted 标记见同文件 L390-L423，未实测所有删除情形。 |
| 正文引用可追溯到其它理解                                           | `packages/server/src/domains/understanding/core.ts:L303-L325` 提取 understanding 引用并维护 mention；`README.md:L26,L39`                                                                                                  | mention 是弱引用，不等于画布中的结构关系。                                                                                                                                  |
| Agent 可读取本地理解、上下文和画布，写入工具经过确认流程           | `apps/electron/src/main/services/agent/pi-readonly-tools.ts:L176-L244,L313-L339`；`apps/electron/src/main/services/agent/pi-write-tools.ts:L423-L436`；`apps/electron/src/main/services/agent/pi-agent-host.ts:L871-L873` | 源码含读取与审批工具；未配置远程模型实测。仅指这些 Reflecta 写入工具，不据此声称所有第三方工具都有相同安全保证。                                                            |
| 全文检索，以及可配置的语义检索                                     | `packages/server/src/domains/search/core.ts:L65-L89,L143-L159`；`packages/server/src/domains/retrieval/embedding-config.ts:L3-L20,L28-L60`                                                                                | 默认 provider 为 disabled / lexical-only；启用语义检索需配置本地或 OpenAI-compatible embedding。不能说语义检索默认可用、全部离线或达到某准确率。                            |
| 通过 CLI 脚本访问本地数据，数据结果支持 JSON / JSONL，修改需 --yes | `apps/cli/src/output.ts:L1-L19`；`apps/cli/src/runner.ts:L36-L55`；`apps/cli/src/cli.ts:L243-L261`；画布命令 `apps/cli/src/actions/canvas/`                                                                               | 本次构建和命令发现实测，见 (d)。帮助与 list-actions 是文本，不是 JSON；没有实测数据 CRUD。                                                                                  |
| 本机存储与开源可审阅                                               | `packages/server/src/runtime/resolve.ts:L204-L224` 定位本地数据库和检索索引；`README.md:L103-L108,L114-L116`；`LICENSE:L1-L21`                                                                                            | 自有代码 MIT，第三方遵循各自许可证；“本地优先”不等于“数据永不出机”。                                                                                                        |

## (c) 目标受众：三类假设画像及场景

以下是依据现行产品文档提出的场景假设，尚无访谈、活跃用户数或转化率证据。

| 画像                                                 | 场景 / 需求                                                                                                  | 能力对应及依据                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 持续阅读、看课程的主动学习者                         | 读完材料后写下自己的局部判断，把材料触发的疑问与判断关联；日后回看判断的来源与边界。                         | Understanding + Context；`docs/references/product/value-proposition.md:L44-L54`，`README.md:L21-L24,L38`。不面向仅需稍后读或自动摘要的人。 |
| 经常做项目和复盘的知识工作者（如产品设计者、开发者） | 项目结束后记录为什么这样判断、哪些经历挑战了原结论，再用画布梳理关系；需要跨时间回看，而非只留一份复盘长文。 | Canvas + Domain；`docs/references/product/value-proposition.md:L267-L276`，`README.md:L34-L39`。这是个人使用画像，不是团队协作能力承诺。   |
| 与 AI 深聊、愿意从源码运行工具的个人探索者           | 与能读取已有理解的 Agent 讨论，再审阅候选修改；需要脚本接入时探索 CLI，而非接受 AI 全自动入库。              | `README.md:L13,L28,L40-L42,L88-L101`；`docs/references/product/value-proposition.md:L278-L301`。AI 服务、模型配置和开发环境是使用门槛。    |

不优先面向团队知识库、多人协作、内容发布系统，以及只想自动生成知识库的人，依据 `docs/references/product/value-proposition.md:L278-L284`。上述画像不能宣传为已验证用户群或市场规模。

## (d) 技术栈与运行方式

### 仓库技术事实

| 项目                                                           | 证据                                                                                                                                                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bun workspace：apps 与 packages                                | `package.json:L5-L8`；`bun.lock` 为现有锁文件。                                                                                                                                                                                            |
| Electron + React + TypeScript + Vite 桌面应用                  | `apps/electron/package.json` 原始字段：`"main": "./out/main/index.js"`、`"electron": "44.0.0"`、`"react": "^19.2.8"`、`"vite": "^8.2.2"`；根 `package.json`：`"typescript": "^7.0.2"`。这些是声明依赖，范围版本不是安装实测版本。          |
| Effect 业务程序、typed RPC、React Query 数据层                 | `docs/references/technical/frontend-guide.md:L3-L15`；`apps/electron/package.json`：`"effect": "4.0.0-rc.112"`、`"electron-effect-rpc": "0.10.0"`、`"effect-query": "1.0.0"`。Effect 为 RC 依赖，不宣传全栈均稳定版。                      |
| SQLite / Drizzle 数据、LanceDB 检索、本地或远端 embedding 配置 | `packages/server/package.json`：`"drizzle-orm": "^0.45.2"`、`"better-sqlite3": "^13.0.3"`、`"@lancedb/lancedb": "0.37.1"`、`"node-llama-cpp": "^3.20.0"`；检索配置见 (b)。                                                                 |
| 共享 UI、编辑器、画布、组件示例                                | `packages/ui/package.json` 原始字段：`"@base-ui/react": "^1.7.0"`、`"@milkdown/core": "7.22.1"`、`"@antv/x6": "^3.1.8"`、`"storybook": "storybook dev -p 6006 --no-open"`；技术规范 `docs/references/technical/frontend-guide.md:L3-L15`。 |
| 单测与桌面 E2E 工具链                                          | `apps/electron/package.json:L18-L31` 含 Vitest / Playwright 脚本；`apps/electron/playwright.config.ts`；`apps/electron/e2e/README.md`。存在测试不等于本次所有测试通过。                                                                    |

### 可复制命令与实际验证状态

仓库要求 Node.js 22（`.node-version:L1` 精确为 `22.22.3`；`README.md:L48-L52`）及 Bun。本次环境命令实测是 Node `v26.5.0`、Bun `1.4.2`，原始输出见附录。因此本次结果不等于推荐 Node 版本的兼容性验收。

```bash
git clone https://github.com/Floribunda1/reflecta.git
cd reflecta
bun install
bun run dev:gui
```

依据 `README.md:L54-L61` 和 `package.json:L11`。**本次未重新安装依赖、未启动 GUI**；复用工作区已有依赖。桌面首次启动按 README 选择内容存储目录，并按需配置 AI Provider 和检索模型。不得写“从零安装已验证”。

CLI 最小可复制入口：

```bash
bun run --filter '@reflecta/cli' build
node apps/cli/dist/index.mjs list-actions
node apps/cli/dist/index.mjs canvas --help
```

依据 `apps/cli/package.json:L14-L17`、`README.md:L93-L94`。**上述命令本次实际执行，退出码均为 0**。构建输出含 TypeScript API experimental 提示；没有改配置来消除提示。帮助和命令发现不访问个人数据库，未使用 --yes、未做数据写入，也未运行 AI 或语义检索。新构建的顶层 `--help` 未列出 canvas，但 `canvas --help` 和 `list-actions` 能列出，属于帮助文案覆盖不完整，不能误判为没有画布命令；`apps/cli/src/cli.ts` 的帮助分支与命令注册是独立路径。

开发检查（本次未执行，不能引用为通过结果）：

```bash
bun run typecheck
bun run test
bun run lint
bun run test:e2e
bun run storybook
```

依据 `package.json:L18-L32`。打包命令必须区分平台：

```bash
# 根脚本实际限定 macOS arm64
bun run package:electron
# 其它平台有独立脚本；本次均未验证
bun run --cwd apps/electron build:win
bun run --cwd apps/electron build:linux
```

依据 `package.json:L12` 和 `apps/electron/package.json:L41-L43`。README L82 的“当前平台”措辞过宽；`build:mac` 明确 `electron-builder --mac --arm64`。现有发布工作流 `.github/workflows/release-electron.yml:L12-L14` 使用 macOS runner，不能仅凭 Windows / Linux 配置声称已发布或已验证这些安装包。

## (e) 不可宣称事项与已知限制

| 禁止表述                                                     | 理由 / 证据 / 后续需要的证据                                                                                                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “成熟稳定、生产级、零缺陷”                                   | `README.md:L13` 明说早期开发；本次只验证 CLI 构建及帮助入口。**无证据，禁止宣传**。需要独立质量与真实用户运行证据。                                                                                  |
| “完全离线，任何数据都不会离开设备”                           | `README.md:L44,L107` 说明远程 Provider 接收请求内容；`embedding-config.ts` 支持远程 embedding。只能说核心内容本机存储。                                                                              |
| “自动替用户生成正确知识库 / 自动证明因果 / 保证提升学习效率” | `value-proposition.md:L30,L299-L301` 明确个人理解非真相、AI 不能拍板；无效果对照研究。**无证据，禁止宣传**。                                                                                         |
| “默认就有语义搜索、搜索准确率达到某百分比、比其它产品更快”   | `packages/server/src/domains/retrieval/embedding-config.ts:L16-L20` 默认 disabled；无本次可复现跨产品基准。历史 benchmark 文件不能当当前实测。**无证据，禁止宣传**。                                 |
| “三平台已发布并完整验证、已获 Apple 公证”                    | 当前 Release 资产见附录，未见 Windows/Linux；`apps/electron/electron-builder.yml:L56-L75` 含 `identity: "-"`、`hardenedRuntime: false`、`notarize: false`。配置支持不等于成品验收。                  |
| “多人协作、云同步、移动客户端、托管 Web 产品已经可用”        | 产品入口盘点为 Electron/CLI；`value-proposition.md:L278-L284` 不优先团队场景。未在本次入口、配置与当前 README 找到对应实现证据。**无证据，禁止宣传**；不能从未找到反推永远不会实现。                 |
| “大量用户、活跃社区、已有商业客户、行业领先”                 | 本次公开 star/fork 快照见附录；用户量、收入、留存、安装数均未知，不能写成 0，也不能编造。**无证据，禁止宣传**。                                                                                      |
| “支持任意网站、视频自动解析导入 / 所有模型兼容”              | 上下文内容存储及 Provider 配置并不能证明无限格式或兼容性。**无证据，禁止宣传**；需逐项端到端演示。                                                                                                   |
| “全部数据都在同一个内容目录，复制一个目录就能完整迁移”       | `README.md:L105` 说法需收窄：`packages/server/src/runtime/resolve.ts:L224` 将检索索引放在 appConfigDir；CLI 构建配置 `apps/cli/tsdown.config.ts:L3-L4` 说明 CLI 不执行迁移。未验证完整备份恢复流程。 |
| “CLI 所有输出都是 JSON、CLI 删除都可恢复”                    | `apps/cli/src/cli.ts:L243-L261` 的 list-actions 是文本；本次 canvas 帮助明确 hard-delete，理解帮助为 soft-delete（附录）。不能把统一交互形式夸大成统一行为。                                         |

实验性/成熟度：仓库明确的是“早期开发”与 RC 依赖；没有证据把特定核心功能擅自标成已发布的实验版，也没有证据把它们称为稳定保证。README、CLI README 与实现存在局部漂移，以本报告限定范围为准，不在本调查里修复。

## 仓库事实盘点索引

| 必查项                 | 发现与路径                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| README                 | 根 `README.md` 是定位/功能/运行/隐私/许可证入口；`apps/cli/README.md` 为 CLI 用法；`apps/electron/README.md:L1` 仅为模板标题，不能单独作为产品说明；`packages/server/README.md` 描述 Core / BFF / Facade；`apps/electron/e2e/README.md`、`apps/cli/behaviors/README.md` 是测试文档。历史版本 README 位于 docs/iterations，非现行规范。                                                                                                                                      |
| package / 构建配置     | 根、apps/cli、apps/electron、packages/server、packages/shared、packages/ui、packages/retrieval-eval 的 package.json；`bun.lock`、`.node-version`、根/工作区 tsconfig、`drizzle.config.ts`、`apps/cli/tsdown.config.ts`、`apps/electron/vite.config.ts`、`apps/electron/electron-builder.yml`、`.github/workflows/release-electron.yml`。已跟踪文件未发现 pyproject.toml、Cargo.toml、go.mod，依据附录清单查询。                                                             |
| 目录结构               | `apps/electron` 桌面；`apps/cli` 命令行；`packages/server` 数据/领域/检索；`packages/shared` 共享 schema/协议；`packages/ui` UI/编辑器/画布；`packages/retrieval-eval` 检索评估工作区；`docs/references` 现行规范；`docs/iterations` 历史；`assets/brand` 品牌；`scripts` 工作区脚本；`.github/workflows` 发布。实际路径清单见附录。                                                                                                                                        |
| 核心源码入口           | `apps/electron/src/main/index.ts:L1-L29` 主进程注册；`apps/electron/src/preload/index.ts` IPC 桥；`apps/electron/src/renderer/src/main.tsx` 渲染；`apps/electron/src/renderer/src/router/index.tsx:L18-L30` 注册 capture / understanding-canvas / agent；`apps/cli/src/index.ts:L1-L6` → cli.ts → runner.ts → server BFF；`packages/server/src/index.ts` 导出，`packages/server/src/db/schema.ts` 数据模型，`packages/shared/src/index.ts` 共享入口。                       |
| 现有文档               | 现行产品与技术规范完整路径见附录；历史迭代文档仅作存在性盘点，不把设计计划当已实现卖点。                                                                                                                                                                                                                                                                                                                                                                                    |
| 演示/GIF/截图/示例     | Git 跟踪图片查询仅得到 `assets/brand/reflecta-icon.png` 和 `apps/electron/build/icon.png`，均为图标；未发现跟踪的产品截图、GIF、MP4/WebM 成品演示。开发示例有 `packages/ui/src/canvas/canvas-composition.stories.tsx`、`packages/ui/src/chat/compositions/agent-compositions.stories.tsx`、`packages/ui/src/editor/markdown-editor.stories.tsx`，以及 `apps/electron/src/renderer/src/modules/shared/components/demo.md`。Story 源码不等于公开在线 Demo；未运行 Storybook。 |
| License                | `LICENSE:L1-L21` 为 MIT，copyright 2026 Reflecta contributors；`README.md:L116` 限定自有代码与第三方许可证。不能声称所有依赖均为 MIT。                                                                                                                                                                                                                                                                                                                                      |
| tag / 发布             | 本地标签完整输出见附录；最高本地版本 v2.0.7，不能用本地 tag 单独证明发布。另查 GitHub 最新 Release，原始字段和资产见附录。未逐个核验所有历史标签对应的远端 Release。                                                                                                                                                                                                                                                                                                        |
| CHANGELOG / 包版本     | `CHANGELOG.md:L3-L5`：2.0.7 - 2026-09-12，修复远端模型 reasoning level；`CHANGELOG.md:L7-L14` 记录会话引用等更新。apps/cli、apps/electron、packages/server、packages/ui 的 package.json 为 2.0.7；shared 为 0.1.0，retrieval-eval 为 0.0.0（均见各文件 `version` 字段）。不能宣称所有包版本一致。                                                                                                                                                                           |
| star / fork 等可见指标 | Git 本地对象不保存 GitHub star/fork；本次读取官方 API，原始摘录见附录。曝光、点击、阅读、安装及用户反馈数量无仓库基线，不在本任务设目标或编造。                                                                                                                                                                                                                                                                                                                             |

## 调查结论及推荐下一步

仓库具备可核验的实现和发布记录，卖点无需凭空创造；宣传口径应收敛在“个人理解 + 上下文 + 显式画布 + 有确认流程的 AI 辅助 + 本地优先”上，保留早期阶段与配置前提。下一步应由下游任务基于本基线选择场景、补拍无个人数据的桌面演示，并独立验证安装与关键交互后再写成发布稿。本任务没有执行这些下游工作，也没有宣布总体宣传目标完成。

## 附录：原始证据快照

以下为本任务采集的命令输出与来源原文；外部动态字段仅代表采集时刻，不是代码固有属性。

### GitHub 动态数据

采集 UTC：`2026-09-28T08:38:23.256647+00:00`。

来源：https://api.github.com/repos/Floribunda1/reflecta；命令：`curl -sS --max-time 20 https://api.github.com/repos/Floribunda1/reflecta`。以下只摘录原始字段（asset_names 为 assets[].name 的投影）：

```json
{
  "full_name": "Floribunda1/reflecta",
  "html_url": "https://github.com/Floribunda1/reflecta",
  "stargazers_count": 0,
  "forks_count": 0
}
```

来源：https://api.github.com/repos/Floribunda1/reflecta/releases/latest；命令：`curl -sS --max-time 20 https://api.github.com/repos/Floribunda1/reflecta/releases/latest`。以下只摘录原始字段（asset_names 为 assets[].name 的投影）：

```json
{
  "tag_name": "v2.0.7",
  "html_url": "https://github.com/Floribunda1/reflecta/releases/tag/v2.0.7",
  "published_at": "2026-09-12T07:25:44Z",
  "draft": false,
  "prerelease": false,
  "asset_names": [
    "appcast.xml",
    "Reflecta-2.0.7-arm64-mac.zip",
    "Reflecta-2.0.7.dmg",
    "Reflecta2.0.7-2.0.6.delta"
  ]
}
```

star / fork 均为 0，仅是本次快照，不代表活跃用户或安装数。数据仓库内留存位置即本报告本节；无其他用户指标来源。

```text
$ git status --short
?? .claude/

exit_code=0
```

```text
$ git log -1 --format=%H %s
864df299e4c6e49e820a78e6eb0e14da632a0489 chore(release): v2.0.7

exit_code=0
```

```text
$ git tag --sort=-version:refname
v2.0.7
v2.0.6
v2.0.5
v2.0.4
v2.0.3
v2.0.2
v2.0.1
v2.0.0
v1.5.1
v1.5.0
v1.4.7
v1.4.6
v1.4.5
v1.4.4
v1.4.3
v1.4.2
v1.4.1
v1.4.0
v1.3.22
v1.3.21
v1.3.20
v1.3.19
v1.3.18
v1.3.17
v1.3.16
v1.3.15
v1.3.14
v1.3.13
v1.3.12
v1.3.11
v1.3.10
v1.3.9
v1.3.8
v1.3.7
v1.3.6
v1.3.5
v1.3.4
v1.3.3
v1.3.2
v1.3.1
v1.3.0
v1.2.4
v1.2.3
v1.2.2
v1.2.1
v1.2.0
v1.1.22
v1.1.21
v1.1.20
v1.1.19
v1.1.18
v1.1.17
v1.1.15
v1.1.14
v1.1.13
v1.1.12
v1.1.11
v1.1.10
v1.1.9
v1.1.8
v1.1.7
v1.1.6
v1.1.5
v1.1.4
v1.1.3
v1.1.2
v1.1.1
v1.1.0
v1.0.3
v1.0.2
v1.0.1
v1.0.0

exit_code=0
```

```text
$ node --version
v26.5.0

exit_code=0
```

```text
$ bun --version
1.4.2

exit_code=0
```

```text
$ node apps/cli/dist/index.mjs canvas --help
Usage: reflecta canvas <action> [args] [options]

Actions:
  list                   List canvases
  get                    Get canvas detail (structure skeleton by default; bodies opt-in)
  search                 Search canvases by free-text query (OR across title / elements / labels / referenced understanding titles) or by understanding ID
  create                 Create a canvas  [mutates]
  update                 Update a canvas: rename via --title, or write the whole document via --document (JSON CanvasDocument, reconciled by id)  [mutates]
  delete                 Hard-delete a canvas (cascades elements and edges)  [mutates]

Global Options:
  --format <fmt>         Output format: json | jsonl (default: jsonl)
  --content-root <dir>   Use a Reflecta content storage root
  --db <path>            Use a single SQLite database file
  --app-config-dir <dir> Use a specific app config directory
  --yes                  Auto-confirm mutating actions
  --quiet                Suppress non-error stdout
  --verbose              Debug logs to stderr

exit_code=0
```

```text
$ node apps/cli/dist/index.mjs list-actions
Actions:

understanding — Manage understandings
  list                   List understandings
  get                    Get a understanding by ID
  create                 Create a understanding  [mutates]
  update                 Update a understanding  [mutates]
  delete                 Soft-delete a understanding  [mutates]

canvas — canvas
  list                   List canvases
  get                    Get canvas detail (structure skeleton by default; bodies opt-in)
  search                 Search canvases by free-text query (OR across title / elements / labels / referenced understanding titles) or by understanding ID
  create                 Create a canvas  [mutates]
  update                 Update a canvas: rename via --title, or write the whole document via --document (JSON CanvasDocument, reconciled by id)  [mutates]
  delete                 Hard-delete a canvas (cascades elements and edges)  [mutates]

context — Manage contexts
  list                   List contexts for an understanding
  get                    Get a context by ID
  create                 Create a context  [mutates]
  update                 Update a context  [mutates]
  delete                 Soft-delete a context  [mutates]

domain — Manage domains
  list                   List all domains
  inspect                Inspect a domain and its understandings
  create                 Create a domain  [mutates]
  update                 Update a domain  [mutates]
  delete                 Delete a domain  [mutates]

search — Search understandings and contexts
  search                 Search understandings and contexts

exit_code=0
```

CLI 构建关键原始输出（命令 `bun run --filter @reflecta/cli build`）：

```text
@reflecta/cli build: WARN TypeScript 7.0 does not yet have a stable API and is experimental. Some options will be unavailable.
@reflecta/cli build: ✔ Build complete in 508ms
@reflecta/cli build: Exited with code 0
```

### 跟踪文件盘点输出

根目录跟踪文件（从 `git ls-files` 按路径筛选）：

```text
.editorconfig
.gitignore
.node-version
.npmrc
.oxfmtrc.json
.oxlintrc.json
AGENTS.md
CHANGELOG.md
CONTEXT.md
LICENSE
README.md
bun.lock
doctor.config.json
drizzle.config.ts
lefthook.yml
package.json
paseo.json
skills-lock.json
tsconfig.json
```

现行规范（从 `git ls-files` 按路径筛选）：

```text
docs/references/product/feature-set-guide.md
docs/references/product/value-proposition.md
docs/references/technical/architecture/data-migration.md
docs/references/technical/architecture/testing.md
docs/references/technical/biz/agent/citation.md
docs/references/technical/biz/agent/rag.md
docs/references/technical/biz/agent/retrieval-index-sync.md
docs/references/technical/biz/agent/session-projection.md
docs/references/technical/design-tokens/base16-semantic-mapping.md
docs/references/technical/frontend-guide.md
docs/references/technical/observability.md
docs/references/technical/release-process.md
docs/references/technical/storybook-principles.md
docs/references/technical/test-case-principles.md
```

工作区 package 配置（从 `git ls-files` 按路径筛选）：

```text
apps/cli/package.json
apps/electron/package.json
package.json
packages/retrieval-eval/package.json
packages/server/package.json
packages/shared/package.json
packages/ui/package.json
```

图片与视频（从 `git ls-files` 按路径筛选）：

```text
apps/electron/build/icon.png
assets/brand/reflecta-icon.png
```

其它语言构建入口（从 `git ls-files` 按路径筛选）：

```text
(无匹配)
```

### 源码断言对照抽样

以下直接按行读取源码，可独立核对上下文存储、引用、搜索、默认配置、写入确认和本地路径等断言。

`packages/server/src/domains/context/core.ts:L83-L97`

```text
83:       yield* assertUnderstandingExists(input.understandingId);
84:
85:       const row: typeof contexts.$inferInsert = {
86:         id,
87:         understandingId: input.understandingId,
88:         medium: input.medium,
89:         title: input.title ?? null,
90:         content: input.content,
91:         createdAt,
92:         deletedAt: null,
93:       };
94:
95:       yield* Effect.sync(() => db.insert(contexts).values(row).run());
96:       retrievalIndex?.enqueue([input.understandingId]);
97:       return { ...row, createdAt, deletedAt: null } as ContextDTO;
```

`packages/server/src/domains/understanding/core.ts:L303-L311`

```text
303:   syncWikiLinkMentions(sourceId: string, body: string): Effect.Effect<void> {
304:     const db = this.db;
305:     return Effect.sync(() => {
306:       const linkTargets = collectEntityReferences(body)
307:         .filter((reference) => reference.type === "understanding")
308:         .map((reference) => reference.id);
309:
310:       db.transaction((tx) => {
311:         tx.delete(understandingMentions).where(eq(understandingMentions.sourceId, sourceId)).run();
```

`packages/server/src/domains/search/core.ts:L73-L83`

```text
73:     return Effect.gen(function* () {
74:       const hits = yield* Effect.tryPromise({
75:         try: () =>
76:           mode === "lexical"
77:             ? index.searchLexical(query, resultLimit)
78:             : index.search(query, resultLimit),
79:         catch: (error) =>
80:           new SearchDomainError({
81:             message: error instanceof Error ? error.message : String(error),
82:           }),
83:       });
```

`packages/server/src/domains/retrieval/embedding-config.ts:L14-L20`

```text
14: export const LEXICAL_ONLY_EMBEDDING_MODEL = "lexical-only";
15:
16: const DEFAULT_CONFIG: RetrievalEmbeddingConfig = {
17:   provider: "disabled",
18:   modelId: LEXICAL_ONLY_EMBEDDING_MODEL,
19:   dimensions: 1,
20: };
```

`apps/electron/src/main/services/agent/pi-write-tools.ts:L423-L436`

```text
423: export function createPiWriteTools(options: { onApproval?: PiApprovalToolHandler } = {}) {
424:   return toolSpecs.map((spec) =>
425:     defineTool({
426:       ...spec,
427:       execute: async (toolCallId, params) => {
428:         if (!options.onApproval) return pendingToolResult(spec.name, params);
429:         const output = await options.onApproval({
430:           toolName: spec.name,
431:           toolCallId,
432:           payload: params,
433:         });
434:         return toolResult(
435:           isRejectedToolOutput(output) ? output : approvedToolResult(spec.name, output),
436:         );
```

`packages/server/src/runtime/resolve.ts:L204-L224`

```text
204:   const contentStorageRoot = resolveAbsolute(
205:     input.explicitContentStorageRoot ??
206:       input.appConfig?.contentStorageRoot ??
207:       (input.explicitDbPath
208:         ? path.dirname(input.explicitDbPath)
209:         : defaultContentStorageRoot(input, dataTarget)),
210:   );
211:   const dbPath = resolveAbsolute(
212:     input.explicitDbPath ?? path.join(contentStorageRoot, "reflecta.db"),
213:   );
214:
215:   return {
216:     processKind: input.processKind,
217:     buildKind,
218:     dataTarget,
219:     storeMode,
220:     migrationPolicy: migrationPolicy(input, buildKind, storeMode),
221:     appConfigDir,
222:     contentStorageRoot,
223:     dbPath,
224:     retrievalIndexPath: path.join(appConfigDir, "retrieval-index"),
```

`apps/cli/src/runner.ts:L36-L47`

```text
36: export async function runCommand<T>(
37:   handler: () => Promise<T>,
38:   opts: GlobalOptions & { mutates?: boolean; requiresFullStore?: boolean },
39: ): Promise<void> {
40:   if (opts.mutates && !opts.yes) {
41:     writeError(
42:       ErrorCodes.CONFIRMATION_REQUIRED,
43:       "This command mutates data. Pass --yes to execute.",
44:     );
45:     process.exitCode = 3;
46:     return;
47:   }
```

### 交付范围核对（提交前）

`.claude/` 在本任务开始时即为未跟踪目录，未作为交付纳入。验收 skill 安装产生的临时文件已移出仓库。CLI 构建只产生忽略的 dist 产物；下列检查证明既有跟踪文件未被修改。路径与行号检查仅验证引用位置有效，不替代独立验收。

```text
Citation ranges checked: 75
Missing paths or invalid ranges: []
$ git diff --name-only
(no output)
$ git status --short
?? .claude/
?? docs/marketing/
```
