# v1.1.16

Agent structured message parts 与正文引用改造。

本版本结论：Assistant 正文里必须显示可点击引用，但 Agent 不再手写任何聊天引用 token。Pi Agent 复用现有 `assistant.turn.blocks`，把 text block 扩展为 structured parts；renderer 只渲染 `entity_ref` part，不做 title 自动匹配；工具只吃稳定 id。

- 工具参数只接受 Reflecta 稳定实体 id，不再出现 `ref` 参数或 `ref` 字段暗示。
- Assistant text block 支持 `text` / `entity_ref` parts；`text` 字段保留为搜索、导出和旧数据 fallback。
- Renderer 通过结构化 entity catalog / `entity_ref` part 渲染正文内联引用，不扫描标题，也不相信模型手写 title/id/ref 组合。
- 只读工具输出暴露 `id`、`type`、`title/name`，不再暴露 `ref` 或 `citation`。
- 写工具执行前校验 ID 字段，明确拒绝短号、wiki link、旧 `rf_*` source id。
- Agent 候选写入落库前拒绝 Agent-only display token，避免把 chat 协议写进用户内容。
- 一次性迁移历史 session events，并审计/迁移知识库内容里的 Agent-only token；运行时不保留旧 `[[ref:*]]` / `ref` 字段兼容逻辑。

见 [Agent structured message parts 与正文引用改造计划](tech/agent-entity-annotation-identity-boundary-plan.md)。
