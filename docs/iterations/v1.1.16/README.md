# v1.1.16

Agent 正文内联引用与工具身份边界改造。

本版本结论：Assistant 正文里必须显示可点击引用，但 Agent 不再手写任何聊天引用 token。正文写自然语言和实体标题，runtime 生成结构化 text-span annotation，renderer 把正文中的对应标题渲染成内联引用；工具只吃稳定 id。

- 工具参数只接受 Reflecta 稳定实体 id，不再出现 `ref` 参数或 `ref` 字段暗示。
- Agent 正文要写实体标题，但不写任何会话级短号，例如 `S1`、`U1`、`D1`。
- Renderer 通过结构化 entity catalog / text-span annotation 渲染正文内联引用，不再相信模型手写 title/id/ref 组合。
- 只读工具输出暴露 `id`、`type`、`title/name`，不再暴露 `ref` 或 `citation`。
- 写工具执行前校验 ID 字段，明确拒绝短号、wiki link、旧 `rf_*` source id。
- Agent 候选写入落库前拒绝 Agent-only display token，避免把 chat 协议写进用户内容。
- 一次性迁移历史 session catalog 事件，运行时不保留旧 `[[ref:*]]` / `ref` 字段兼容逻辑。

见 [Agent 正文内联引用与工具身份边界改造计划](tech/agent-entity-annotation-identity-boundary-plan.md)。
