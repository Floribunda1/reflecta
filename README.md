<p align="center">
  <img src="assets/brand/reflecta-icon.png" width="96" alt="Reflecta logo" />
</p>

<h1 align="center">Reflecta</h1>

<p align="center">
  把学习、实践和对话，沉淀成可追溯的个人理解。
</p>

Reflecta 是一款本地优先的桌面应用，面向持续学习、实践、复盘，以及与 AI 进行深度对话的人。它关心的不是你收藏了多少信息，而是这些经历最终有没有变成你自己的理解。

> Reflecta 仍处于早期开发阶段。目前推荐开发者从源码运行，数据格式和交互可能继续演进。

## 为什么是 Reflecta

看完一本书、做完一个项目、经历一次失败或与 AI 深聊，并不会自动形成积累。真正值得留下的是你在这些经历之后形成的判断，以及这些判断产生、被验证和被修正的上下文。Reflecta 要沉淀的不是"我见过这句话"，而是"这个理解在我的哪些具体上下文里形成、被验证、被使用、被挑战或被修正"。

四个核心概念承载这件事：

- **理解**：你当前形成并愿意继续发展的个人判断。它可以是局部的、初步的、边界尚未完全形成的，但必须是真实属于你的判断。
- **上下文**：这条理解形成、被支撑、应用、挑战或修正的具体上下文——经历、材料、对话与观察。没有上下文的理解会退化成一句悬空的口号。
- **画布**：把一组理解组织成一个主题下的心智结构：节点是结论，连线是你确认过的认知关系（谁推导出谁、依赖什么、受什么原则约束）。结构由你显式搭建，AI 只提案、不拍板。
- **领域**：长期回看和发展一组理解的领域。

此外还有一层轻量的**引用（mention）**：在正文中提及另一条理解，形成"我提到过 X"的弱引用，用于回溯来源。它表达"有关系"，不表达"什么关系"——关系的结构与语义由画布连线承担。

AI 可以帮助搜索、追问、比较和提出候选修改，但最终的理解和关系由用户确认。用户是大脑，AI 是辅助。

更完整的产品理念与边界见 [Reflecta Value Proposition](docs/references/product/value-proposition.md)。

## 目前包含什么

- 在领域中创建、编辑和回看理解。
- 在画布上摆放理解卡片，亲手标记推导、依赖、场景与约束等关系，回看一个领域的心智结构。
- 同一张理解卡可被多张画布引用复用；被引用的理解删除后，画布上以占位标记而非静默丢卡。
- 画布与 Agent 协作：Agent 基于画布内容提出候选修改与结构调整，由用户逐条确认后落库。
- 为理解保留来自实践、书籍、视频、文章或 AI 对话的上下文。
- 在正文中以引用（mention）提及其它理解，保留理解之间的溯源。
- 与能够读取本地理解和上下文的 Agent 对话。
- 使用本地全文与语义检索找回相关理解。
- 通过 JSON CLI 脚本化访问本地数据（含画布管理命令）。

核心内容保存在本机。使用远程 AI Provider 时，相应请求会发送到你配置的服务商。

## 从源码运行

### 环境要求

- macOS、Windows 或 Linux
- Node.js 22
- [Bun](https://bun.sh/)

```bash
git clone https://github.com/Floribunda1/reflecta.git
cd reflecta
bun install
bun run dev:gui
```

首次启动后，在应用设置中选择内容存储目录，并按需配置 AI Provider 和检索模型。

## 常用开发命令

```bash
# 启动桌面应用
bun run dev:gui

# 类型检查
bun run typecheck

# 单元测试
bun run test

# 代码检查
bun run lint

# Electron E2E
bun run test:e2e
```

构建当前平台的桌面安装包：

```bash
bun run package:electron
```

## CLI

`@reflecta/cli` 通过标准输出返回 JSON，适合脚本和 Agent 调用。修改数据的命令必须显式传入 `--yes`。

```bash
bun run --filter '@reflecta/cli' build
node apps/cli/dist/index.mjs list-actions
node apps/cli/dist/index.mjs search "feedback loop"
node apps/cli/dist/index.mjs canvas create "Trading Psychology" --yes
node apps/cli/dist/index.mjs canvas search "structure"
node apps/cli/dist/index.mjs understanding create --title "Inbox" --yes
```

完整用法见 [CLI 文档](apps/cli/README.md)。

## 数据与隐私

- 理解、上下文、领域、画布、会话和检索索引默认保存在本机内容目录。
- Reflecta 不要求把个人理解上传到一个由项目维护的云端知识库。
- 远程 AI Provider 会按照你的配置接收完成请求所需的内容；请同时阅读对应服务商的隐私政策。
- 在公开 issue 或 bug report 前，请检查日志、截图和复现数据中是否包含个人内容。

## 参与贡献

欢迎提交 issue 和 pull request。开始修改前，请先阅读 [AGENTS.md](AGENTS.md) 中的项目约定，并确保相关类型检查和测试通过。

## License

Reflecta 自有代码采用 [MIT License](LICENSE) 发布。第三方依赖和仓库中明确标注来源的内容遵循各自的许可证。
