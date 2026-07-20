# v1.2.2 Agent Citation Catalog 投影执行计划

> 日期：2026-07-20
>
> 状态：In Progress
>
> 架构依据：[Agent Citation 与 Entity Catalog 架构](../../references/technical/biz/agent/citation.md)

## 1. 目标

将 Entity Catalog 从“随每轮用户 Prompt 持久化的完整快照”改为“每次 LLM 调用前生成的一份非持久化模型输入投影”，同时：

- 保留当前 `[[u:id]] / [[c:id]] / [[d:id]]` Citation 协议和完整 Catalog 覆盖范围；
- 保证 Catalog 只来自当前活动分支；
- 保证用户首轮、后续轮次和工具循环中的每次模型调用都只看到一份最新 Catalog；
- 把 provider 缓存边界放在动态 Catalog 之前，不以重复历史换缓存命中；
- 兼容已经把旧 Catalog 写入 Pi 历史的会话，不重写旧 session 文件。

本轮不做对话 Compaction、相关实体 top-k、Catalog 紧凑序列化、自建 KV cache 或前端 Citation 语义变化。

## 2. Task 1：Catalog 只从活动分支重建

修改 `AgentSessionLog.eventsFromManager`，从 `SessionManager.getBranch()` 而不是全部 `getEntries()` 读取 Reflecta 事件。

稳定规则：

- 编辑旧消息后，新分支保留编辑点之前的 Catalog 事件；
- 被放弃分支在编辑点之后发现的实体不进入新分支；
- 普通未分支会话的事件读取结果不变；
- 查找编辑点和创建 fork 时仍可使用全部 entries，因为它们需要定位树中的目标节点。

验证：在 `pi-session-log.test.ts` 构造包含 `entity.catalog.updated` 的旧分支，切换 leaf 后断言 `readEvents` 只返回活动分支事件。

## 3. Task 2：建立模型输入投影 Module

新增一个位于 Pi `context` seam 的深 Module。调用方只提供当前 messages 和 Catalog snapshot；Module 内部负责旧 block 识别、清理、序列化、末尾放置和 Pi extension 注册。

### 3.1 Runtime Catalog 标记

- 新生成的 `<reflecta_entities>` 带 runtime source 和版本属性；
- JSON 行内容和 Citation direct-ID 协议保持不变；
- 旧无属性 block 只有在每一行都严格满足已知 schema，且 `type / id / citation` 能互相推导时才视为 runtime block；
- 用户自己写的同名 malformed 或未知 block 原样保留。

### 3.2 投影规则

- 非破坏性复制模型 messages；
- 从所有历史 user / tool-result 文本中移除已验证的 runtime Catalog；
- Catalog 非空时，将完整最新快照作为最后一个模型可见消息的最后一个独立 text block；
- Catalog 为空时只执行旧 block 清理，不生成空标签；
- 重复执行投影仍只产生一份 Catalog；
- `buildPiPromptText` 只保留用户正文、显式选择和附件元数据，不再接收或持久化全量 Catalog。

### 3.3 工具循环统一

- 只读和写工具仍负责把新实体写入同一个 `AgentEntityCatalog`；
- 移除只读工具结果后追加增量 Citation block 的特殊路径；
- Pi `context` hook 在下一次 LLM 调用前统一投影完整最新 snapshot；
- `entity.catalog.updated` 事件的持久化顺序保持不变。

验证：

- Unit Test 覆盖唯一末尾 Catalog、幂等、旧 block 清理、用户同名文本保留、空 Catalog；
- Host Test 证明发送给 `session.prompt` 的新用户文本不含全量 Catalog；
- Resource Loader Test 证明 projection extension 与 Bash permission gate 同时加载；
- Tool Test 证明工具结果不再拼接 Citation block，但 collector 仍收到完整输出。

## 4. Task 3：设置 Catalog-aware Prompt Cache 边界

缓存逻辑放在同一个 Pi extension 的 `before_provider_request` seam，不进入 System Prompt、Catalog serializer 或业务事件。

### Anthropic-compatible payload

- 找到包含 runtime Catalog 的 provider content block；
- 移除 Pi 默认放在该动态 block 上的 `cache_control`；
- 将同一份 `cache_control` 移到 Catalog 之前最近的 provider-level cacheable block；
- 找不到已有 cache control 或安全候选时保持请求不变，不影响 Citation 正确性。

### OpenAI payload

- 保留 Pi 已有的 `prompt_cache_key` 和短期 cache retention；
- 仅对明确支持显式 breakpoint 的 direct OpenAI GPT-5.6 family，在 Catalog 前一个普通 content block 上添加 `prompt_cache_breakpoint`；
- 旧模型、OpenAI-compatible provider 和 Codex subscription payload 不添加未知字段。

验证：用纯 payload 输入输出测试证明 boundary 位于 Catalog 之前、Catalog 内容不变、unsupported provider 为 no-op。

## 5. Task 4：回归与验收

### 自动化验证

- Agent Citation、Catalog、Prompt、Session Log、Read-only Tools 和 Host 定向测试全部通过；
- Electron main TypeScript typecheck 通过；
- lint 与 Prettier 检查通过；
- `git diff --check` 通过。

### 架构验收

- 新 Pi 用户消息不持久化 `<reflecta_entities>`；
- 每次模型调用的投影视图最多一份 Catalog，且非空时位于绝对末尾；
- 工具新增实体在下一次模型调用前出现；
- 旧会话无需迁移文件即可去除历史 Catalog 重复；
- 编辑旧消息后不暴露废弃分支实体；
- Provider 不支持显式缓存时功能完全一致；
- 不增加依赖、不增加自建缓存层、不改变 Citation renderer。

## 6. 提交边界

1. `docs(agent): plan citation catalog projection`：保存本执行计划；
2. `fix(agent): scope catalog state to active branch`：活动分支事实边界；
3. `feat(agent): project entity catalog into model context`：投影、工具循环与缓存边界；
4. 完成后把本文状态改为 `Implemented`，补充验证记录并提交。
