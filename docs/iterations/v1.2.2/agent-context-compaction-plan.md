# v1.2.2 Agent 上下文压缩执行计划

> 日期：2026-07-21
>
> 状态：In Progress

## 1. 目标

为 Agent 对话提供自动和手动上下文压缩，使长对话能够继续运行，同时保证：

- 完整原始对话仍是可展示、可编辑、可 fork 的 canonical log；
- 压缩只改变发送给模型的活动上下文，不删除或改写原消息；
- 用户能够看到压缩正在发生，并检查模型继续对话所使用的摘要；
- 编辑旧消息和 fork 后，只使用当前活动分支上的压缩检查点；
- 每次模型调用仍在末尾投影一份当前完整 Entity Catalog；
- 不增加 Provider-specific compaction payload 或缓存标记；
- 摘要 Prompt 保持集中、可直接替换，本次先采用 Reflecta 的默认实现，不扩展版本路线。

## 2. 已有能力与实现边界

Pi 已经提供上下文用量判断、有效切分点、最近原始消息保留、overflow 后单次重试、compaction entry 持久化和分支感知的模型上下文构建。Reflecta 复用这些能力，不实现平行的 compaction engine。

Reflecta 只补三个缺口：

1. 在 `session_before_compact` seam 生成符合 Reflecta 对话语义的摘要；
2. 把 Pi compaction 生命周期翻译成 Reflecta event；
3. 提供压缩状态、可展开检查点和手动触发入口。

压缩后的模型输入保持以下顺序：

```text
System Prompt + Tool Definitions
Compaction Checkpoint
最近保留的原始消息
当前用户消息 / 当前工具结果
当前完整 Entity Catalog
```

Entity Catalog 继续由现有 `context` hook 在模型调用前投影，不写入 compaction summary，也不改成相关实体子集。

## 3. Task 1：压缩策略与摘要 Module

新增集中、可测试的 Pi compaction module：

- 根据当前模型窗口计算触发阈值和最近消息预算；
- 自动压缩默认在活动上下文达到 `min(contextWindow × 75%, 160k)` 时触发；
- 最近原始消息保留 `min(contextWindow × 20%, 24k)`；
- 摘要输出预算独立限制在最多 6k tokens，避免大窗口模型产生超大摘要；
- 使用当前会话模型生成摘要，不引入单独的弱模型配置；
- 摘要失败时不写入 compaction entry，完整历史保持不变；
- checkpoint details 记录 schema、Prompt 标识、触发原因和压缩前 token 数。

默认摘要应区分用户陈述、已确认结论、未接受建议、证据与 Citation、开放问题和继续状态。必须保留已有 `[[u:id]] / [[c:id]] / [[d:id]]`，不得生成新 Citation；工具输出和引用材料只作为待总结数据，不能升级为指令。

Prompt 文本只保留一个集中定义和一个稳定调用点，后续修改 Prompt 不需要改动 session、event 或 UI 协议。

## 4. Task 2：自动压缩与手动压缩

### 自动压缩

- 打开 Pi compaction setting；
- 使用实际模型上下文用量触发阈值检查；
- Provider 返回 context overflow 时沿用 Pi 的单次 compact-and-retry；
- 在开始、成功和失败时发出 Reflecta compaction event；
- 不把 compaction 计作用户消息或 Agent 回复。

### 手动压缩

- 新增 `context.compact` Agent command；
- 用户可在对话操作菜单主动触发；
- 使用当前选择的模型和推理配置；
- 当前有 Agent run 或 compaction 时禁止并发触发；
- 对话太短或刚完成压缩时返回可理解的提示；
- 成功后写入与自动压缩相同的 checkpoint 和持久化事件。

## 5. Task 3：Session event 与分支语义

新增两类产品事件：

- live `context.compaction.started`：驱动进行中状态，不持久化；
- durable `context.compacted`：保存摘要、触发原因、压缩前后 token 数、检查点边界和显示锚点。

压缩失败由调用错误或 live failure 状态反馈，不写入假的成功检查点。

稳定规则：

- Pi 原始 message entry 和 Reflecta event 均不删除；
- `eventsFromManager(getBranch())` 继续只读取活动分支；
- 编辑压缩点之前的消息会自然离开旧 checkpoint 所在分支；
- 压缩点之后的编辑和 fork 可以复用 checkpoint；
- 完整 Catalog 继续从活动分支上的 `entity.catalog.updated` 事件恢复。

## 6. Task 4：前端体验

- 对话操作菜单增加“压缩上下文”；
- 对话为空、正在回复或正在压缩时禁用该操作；
- 压缩期间禁用输入并显示“正在整理较早对话”；
- 成功后在消息流显示折叠的 checkpoint receipt；
- receipt 默认只显示“已整理较早对话”和 token 变化，展开后显示完整摘要；
- 原始消息继续完整展示，摘要不能作为普通消息编辑；
- 重启、切换对话、编辑和 fork 后，receipt 与当前活动分支保持一致；
- Context Meter 使用压缩后的后续用量，不把历史 receipt 计入模型上下文。

不新增通用 UI 组件；折叠内容使用原生 `details/summary` 和现有 Button、DropdownMenu、Spinner。

## 7. 测试策略

### Test case 与 E2E

新增 `context-compaction.feature`，从用户场景描述：

- 用户手动压缩长对话并看到可展开检查点；
- 自动压缩时用户看到进行中状态，完成后可继续发送；
- 用户重启应用后仍能查看检查点和完整原消息；
- 用户编辑检查点之前的消息后，废弃分支的检查点不再出现。

实现一条不依赖真实 AI 的 Playwright E2E：使用 seed fixture 验证完整消息与 checkpoint 同时可见、摘要可展开，并在重启后保持。真实模型的自动阈值和手动调用不放入常规 E2E，因为外部模型会使测试昂贵且不稳定。

### Unit / integration

- 触发阈值和最近消息预算的纯规则；
- 摘要请求不包含 runtime Catalog，保留旧 checkpoint 与 Citation 约束；
- Pi compaction event 到 Reflecta durable event 的翻译；
- 手动 command 成功、对话太短、并发拒绝和失败不写 checkpoint；
- reducer 恢复 compaction 状态与 receipt；
- 编辑旧消息后活动分支不返回废弃 checkpoint；
- MessageList 根据锚点展示 receipt 的稳定规则。

## 8. 验收标准

- 长对话达到阈值后自动产生一个 Pi compaction entry 和一条 Reflecta checkpoint event；
- 用户可以从对话菜单手动压缩可压缩的会话；
- 压缩后模型上下文由 checkpoint、最近原始消息和当前完整 Catalog 组成；
- 完整原始消息在前端、导出来源和 session 文件中保持不变；
- checkpoint 默认折叠且可查看，重启后仍存在；
- 编辑与 fork 不泄漏废弃分支 checkpoint 或 Catalog；
- compaction 失败不会丢失历史，也不会生成成功 receipt；
- 不增加依赖，不修改 Provider payload，不引入第二套 session storage；
- 定向测试、Electron typecheck、lint、format 和 E2E 通过。

## 9. 提交边界

1. `docs(agent): plan context compaction`：保存执行计划；
2. `feat(agent): compact conversation context`：压缩策略、事件、自动与手动入口；
3. `feat(agent): surface context compaction`：前端体验、test case 和 E2E；
4. `test(agent): verify context compaction`：补齐回归、更新完成记录并执行全量验证。
