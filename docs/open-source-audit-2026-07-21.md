# Reflecta 开源前 Git 与内部信息审计

> 日期：2026-07-21  
> 基线：`master` at `2db054d369256a0def45faa9a2af02e1cb33ef14`  
> 审计分支：`codex/open-source-audit`  
> 修复进度：审计分支当前树中的个人绝对路径已改为 project-based 示例，Retrieval 质量测试与语料已移入 ignored 私有目录；旧 commit 仍保留原值。
> 结论：**NO-GO。完成本文 P0 后才能公开现有仓库或其历史。**

## 1. 审计范围

本次审计覆盖：

- 本地可达的全部 branch、remote-tracking branch 和 tag，共 537 个 Git commit。
- 当前被 Git 追踪的文件、历史文件名、历史大对象和 commit 作者元数据。
- 凭据、私钥、环境文件、数据库、日志、个人路径、真实生产数据痕迹和第三方复制内容。
- 与公开仓库直接相关的发布配置和凭据存储实现。

本次审计不覆盖：

- 未 fetch 到本地的远端 refs、GitHub forks、Actions secrets 或其他外部系统。
- 本机 ignored 文件只经过 Gitleaks 规则扫描，没有人工读取或记录其完整内容。
- 完整依赖许可证兼容性、依赖漏洞、应用渗透测试和法律意见。

## 2. 执行方法

### 2.1 Git 凭据扫描

使用 Gitleaks `v8.30.1` 对全部本地 refs 执行：

```bash
gitleaks git --redact=100 --report-format json --log-opts="--all" .
```

Gitleaks 报告扫描 529 个 commit、约 11.57 MB diff。`git rev-list --all --count` 的 537 包含 Gitleaks 未计入扫描数量的 commit；扫描入口仍使用了 `--all` refs。

随后对包含 ignored 文件、本地依赖和构建产物的工作目录补扫：

```bash
gitleaks dir --redact=100 --report-format json .
```

工作目录扫描约 845.76 MB，发现 21 条命中。逐层核验结果为：

- `.env.test.local` 中有 1 个高熵 E2E API Key，按真实本机凭据处理；文件已被 `.gitignore` 忽略，未进入 Git 历史。
- 5 条来自当前测试源码中的 invalid/fake key。
- 15 条来自未追踪的 `app.asar` 容器。解包后复扫为 4 条测试假值，未再次检出私钥；容器级 `private-key` 命中判定为二进制误报。
- 解包结果同时证明 E2E 测试源码被打进了当前 macOS 包，虽然没有打入本机 `.env.test.local`，仍应从发布文件中排除。

另外执行了：

- 当前树和历史文件名中的 `.env`、私钥、证书、凭据、数据库、日志和备份扩展名检查。
- 当前树中的邮箱、本机绝对路径、内部/机密标记检查。
- `git log -S` 历史内容检查。
- 全历史 blob 大小排序，定位异常二进制或数据文件。

原始报告只保存在系统临时目录，未提交到仓库；本文不记录任何疑似凭据原文。

### 2.2 内部信息检查

重点检查以下信息是否会随开源暴露：

- 真实用户内容、生产会话和生产数据库派生数据。
- 姓名、邮箱、账号、个人目录和个人项目路径。
- 产品策略、未发布设计、内部故障复盘和生产标识符。
- 外部复制内容的来源与授权声明。

## 3. 总结

| 等级 | 结论                                               | 数量/范围                                                       | 公开前动作                                             |
| ---- | -------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| P0   | 生产会话派生内容和 Session 标识仍存在于 Git 历史   | 当前追踪树已移除，旧 commit 仍包含测试代码、fixture 和说明      | 使用干净公开历史或重写历史                             |
| P0   | 个人用户名、个人博客和生产知识库绝对路径已进入历史 | 当前树已脱敏，旧 commit 中仍存在                                | 使用干净公开历史；若公开旧历史则清洗历史               |
| P0   | commit 元数据公开个人邮箱                          | 537 个 commit 均为同一非 noreply 邮箱                           | 明确接受，或使用干净公开历史/重写作者信息              |
| P0   | 缺少第三方复制内容的集中声明                       | `.agents` 116 个文件，另有历史 vendored 文档                    | 增加第三方 NOTICE，确认历史文档是否有权公开            |
| P0   | AI Provider API Key 明文写入应用配置               | 当前实现                                                        | 改为系统安全存储，或至少建立明确威胁模型后再发布二进制 |
| P1   | 大量内部产品与技术迭代文档会公开                   | `docs/iterations` 68 个文件                                     | 明确选择公开、精简或迁移到私有仓库                     |
| P1   | 当前 macOS 构建包包含 E2E 测试源码                 | `app.asar` 解包后可见 `e2e/`                                    | 在 Electron builder 的 `files` 中排除测试目录          |
| P1   | 发布元数据仍含模板/占位配置                        | Electron homepage、update URL、Linux maintainer、macOS 签名配置 | 在发布公开二进制前修正                                 |
| 通过 | 未发现真实凭据、私钥、数据库或日志被 Git 追踪      | Gitleaks 5 条均为测试假值                                       | 清理后复扫，并将扫描加入 CI                            |

## 4. 详细发现

### 4.1 Gitleaks 的 5 条命中均为测试假值

5 条命中全部来自 `generic-api-key` 规则：

| 文件                                                     | 历史命中 | 核验结论               |
| -------------------------------------------------------- | -------: | ---------------------- |
| `apps/electron/e2e/agent/message-changes.spec.ts`        |        1 | 明确的 invalid E2E key |
| `apps/electron/e2e/agent/pi-session.spec.ts`             |        1 | 明确的 invalid E2E key |
| `apps/electron/e2e/agent/start-conversation.spec.ts`     |        1 | 明确的 invalid E2E key |
| `apps/electron/e2e/test-env.ts`                          |        1 | 包含测试标记的假值     |
| `apps/electron/src/main/services/agent/pi-smoke.test.ts` |        1 | 包含测试标记的假值     |

核验时只比较了值的测试标记、前缀和长度，没有把原文写入本文。未发现可识别为真实 provider key 的值。

结论：不需要轮换上述值，但建议在 Gitleaks 配置中按 fingerprint 或精确测试值做最小 allowlist，使公开 CI 能保持零未解释告警。

### 4.2 P0：Git 历史包含生产会话派生的个人内容

`packages/server/src/domains/retrieval/session-quality-fixtures.ts` 包含：

- 从生产知识库提炼的 Understanding、Context 和 query。
- 涉及个人心理、自我评价、工作冲突、个人博客、交易和世界观的内容。
- 看起来像真实人物的标识。
- 原始 Session 文件名、UUID 和行号。

`docs/iterations/v1.1.20/README.md` 明确说明这些质量用例来自生产 `Sessions`，并记录了生产调用统计和提炼过程。因此不能把它们当作普通的匿名示例。

风险：

- 内容本身可能让熟悉背景的人重新识别当事人。
- Session 文件名和行号为私有数据建立了稳定关联标识。
- 只修改当前文件无法从旧 commit 和 tag 中移除内容。

当前追踪树已经完成以下隔离：

1. `packages/retrieval-eval` 作为正常 workspace 提交，依赖进入 `bun.lock`。
2. benchmark、指标测试和合并后的固定语料集中在该 package 的 ignored `private/` 目录。
3. `packages/server` 不再包含或运行 Retrieval 质量测试。
4. 公共默认 `test` 和 `typecheck` 不依赖 ignored 文件。

这只解决当前树，不能清除旧 commit 和 tag。公开前仍必须选择“干净公开历史”或对所有公开 refs 做历史清洗。不要把私有 retrieval 语料移到 `apps/electron/e2e/`：当前 Electron builder 会把 `e2e/` 打进 `app.asar`。

### 4.3 P0：基线曾包含本机和个人项目路径

审计基线的 8 个文件包含 `/Users/<个人用户名>/...` 路径：

- `apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts`
- `docs/iterations/v1.0.0/design/domain-workspace-detail-ux-path.md`
- `docs/iterations/v1.1.2/tech/runtime-environment-isolation-plan.md`
- `docs/iterations/v1.1.12/tech/session-canonical-log-plan.md`
- `docs/iterations/v1.1.15/tech/agent-tool-identity-and-failure-state-plan.md`
- `docs/iterations/v1.1.16/tech/agent-entity-annotation-identity-boundary-plan.md`
- `docs/iterations/v1.1.17/agent-inline-reference-citation-architecture.md`
- `docs/iterations/v1.1.20/README.md`

这些路径暴露：

- 本机账号名。
- 个人博客目录。
- 生产/测试知识库的目录结构和文件名。

历史检查还发现路径曾存在于当前已删除的 `drafts/`、`docs/2-design/`、`docs/drafts/`、`docs/iterations/v0/`、`docs/superpowers/` 和旧 demo 文件中。

审计分支已经把这些位置改为 `<projectRoot>/.local/...`、`./.local/...` 或其他 project-based 示例，当前树不再包含该个人用户名。若保留现有 Git 历史，仍必须处理历史版本。

### 4.4 P0：commit 作者邮箱会随历史公开

`git shortlog -sne --all` 显示 537 个 commit 均属于同一作者，并使用一个个人 QQ 邮箱（本文记为 `1094…@qq.com`）。远端地址还会公开 GitHub 账号 `Floribunda1`。

这不是凭据，但属于明确的个人身份信息。需要在公开前做一次有意识的选择：

- 接受该邮箱与全部历史永久公开；或
- 对公开历史改成 GitHub noreply/公开工作邮箱；或
- 从清理后的当前树创建新的公开仓库和初始 commit。

### 4.5 P0：第三方复制内容需要来源和许可证声明

仓库追踪了 116 个 `.agents` 文件：

- `skills-lock.json` 显示大部分来自 `mattpocock/skills`。
- `vercel-react-best-practices` 声明来源为 Vercel、许可证为 MIT。
- 当前仓库没有根 `LICENSE` 或 `THIRD_PARTY_NOTICES`。

历史大对象中还存在已经删除的 `docs/3-frontend/primevue-llms-full.txt`，大小约 1.82 MB，疑似完整 vendored 第三方文档。

公开前应：

1. 确认每组复制内容的上游许可证与 attribution 要求。
2. 增加 `THIRD_PARTY_NOTICES.md`，记录来源、版本/commit 和许可证。
3. 对历史 PrimeVue 文档确认再分发权；不能确认时不要公开包含该 blob 的历史。

### 4.6 P1：内部产品和技术文档需要所有者决策

`docs/iterations` 当前有 68 个文件，包含：

- PMF/MVP scope、value proposition 和 feature set。
- UX gap、产品 taste、技术选型和未发布设计。
- 生产故障定位、迁移步骤、实验结果和已废弃方案。

未发现 `confidential`、`仅限内部` 等显式标记，但“没有内部标记”不代表默认可以公开。

建议按目录做一次二元决策：

- **公开**：能解释产品演进、帮助贡献者理解设计约束的内容。
- **私有**：含真实生产标识、个人素材、未决定商业策略或不希望长期承诺的路线。

如果希望保留透明的 build-in-public 文化，可以公开大部分架构决策；但应先完成本文的个人信息清理。

### 4.7 通过项：环境文件和数据文件未被 Git 追踪

当前本机存在以下 ignored 文件：

- `.env.development.local`
- `.env.production.local`
- `.env.test.local`

`.gitignore` 正确覆盖它们。当前树和历史文件名检查均未发现被追踪的：

- `.env*`
- `.db` / `.sqlite*`
- `.jsonl` Session 日志
- `.pem` / `.key` / `.p12` / `.pfx`
- 常见 credential、backup 或 dump 文件

工作目录补扫确认 `.env.test.local` 内存在一个按真实凭据处理的 E2E API Key。它没有进入 Git 历史，也没有出现在解包后的 macOS 应用中。公开前仍应再次执行 `git status --ignored` 和 Gitleaks；不要使用 `git add -f` 添加本地环境文件。

### 4.8 通过项：`app.asar` 的私钥命中是容器误报

直接扫描未追踪的 `apps/electron/dist/.../app.asar` 时，Gitleaks 报告 15 条 generic key 和 1 条 private key。使用 `asar extract` 解包到临时目录后复扫：

- 只剩 4 条 E2E 测试假 key。
- 没有 private-key 命中。
- 没有 `.env.test.local` 或其中的本机 Key。

因此不能证明发布包包含真实私钥或本机 API Key；容器级 private-key 命中按误报关闭。但发布包确实包含 `e2e/` 测试源码，应作为构建配置问题修正。

## 5. 相邻的公开发布风险

以下不是 Git 历史泄漏，但会在源码公开后成为明显的安全或可信度问题。

### 5.1 API Key 以明文配置保存

`apps/electron/src/main/config.ts` 的 `serializeConfig()` 直接序列化完整配置，`writeConfig()` 将其中的 provider API Key 写入 JSON 文件，未使用系统钥匙串或 Electron `safeStorage`。

建议在发布二进制前迁移到系统安全存储，并对旧明文配置执行一次迁移和删除。至少应把文件权限、威胁模型、日志脱敏和导出行为写清楚。

### 5.2 发布配置仍有模板值

- `apps/electron/package.json` 的 homepage 指向 Electron Vite 模板项目。
- `apps/electron/electron-builder.yml` 的更新地址仍是 `example.com`。
- Linux maintainer 仍是 `electronjs.org`。
- macOS `hardenedRuntime`、签名和 notarization 均未启用。
- 当前 `files` 规则没有排除 `e2e/`，测试源码被打入 `app.asar`。

这些不阻止“只公开源码”，但阻止可信地发布面向普通用户的安装包。

## 6. 推荐公开策略

### 推荐：建立干净的公开历史

鉴于生产派生个人内容、个人路径和个人邮箱已经进入多个 commit 与 tag，风险最低且操作最简单的方式是：

1. 在私有仓库完成当前树清理。
2. 从清理后的树创建一个新的公开仓库和初始 commit。
3. 保留当前私有仓库作为完整历史档案。
4. 从公开仓库启用 Gitleaks CI，后续只接受清洁提交。

代价是公开仓库不保留早期 commit 和 tag 的逐步历史；收益是不用对 537 个 commit 和全部 tag 做易错的历史重写。

### 备选：保留并重写现有历史

只有在早期历史的公共价值确实高于清理成本时，才使用 `git filter-repo` 清理所有 refs，并重写作者邮箱。执行后需要：

- 重新检查所有 branch 和 tag。
- 重新创建/签名 release tag。
- 强制推送并通知所有已有 clone 使用者重新克隆。
- 对清理前已经公开过的任何真实凭据执行轮换；本次未发现此类凭据。

## 7. 公开前验收门槛

满足以下全部条件后，本审计才可从 NO-GO 改为 GO：

- [ ] 生产派生检索 fixture 已替换为完全合成数据。
- [ ] 当前树不再包含个人用户名、个人博客路径、生产知识库路径、真实人物标识或 Session 标识。
- [ ] 已决定使用干净公开历史或完成全 refs 历史重写。
- [ ] 公开历史中的作者邮箱策略已经确认。
- [ ] 第三方复制内容已经核对许可证并加入 NOTICE；无法确认的历史 blob 不进入公开历史。
- [ ] `docs/iterations` 已逐目录确认公开范围。
- [ ] Gitleaks 对最终公开历史复扫；所有命中为零或有逐条、最小化的测试 allowlist。
- [ ] 最终公开树不存在 tracked `.env`、数据库、Session 日志、私钥或本地日志。
- [ ] 最终安装包解包复扫不包含本机凭据，并且不再包含 E2E 测试源码。
- [ ] 根许可证、贡献指南和安全披露渠道已补齐。
- [ ] 如果同时发布二进制，API Key 安全存储和发行签名问题已解决。

## 8. 复扫命令

清理完成后至少运行：

```bash
git status --short --branch
git rev-list --all --count
gitleaks git --redact=100 --log-opts="--all" .
git log --all --name-only --pretty=format: \
  | sort -u \
  | rg -i '(^|/)(\.env($|\.)|.*(secret|credential|private[-_]?key).*(\.|$)|.*\.(pem|key|p12|pfx|db|sqlite|jsonl|dump|bak)$)'
rg -n '/Users/|/home/|reflecta-prod|reflecta-test|sessionFile:' \
  apps packages docs
```

最终还应在一个全新 clone 中复跑扫描，避免本地 ignored 文件和旧构建产物干扰判断。
