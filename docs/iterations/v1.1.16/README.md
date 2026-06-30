# v1.1.16

Agent entity annotation 与工具身份边界改造。

- 工具参数只接受 Reflecta 稳定实体 id，不再出现 `ref` 参数或 `ref` 字段暗示。
- Agent 正文不再要求模型手写任何会话级短号，例如 `S1`、`U1`、`D1`。
- Renderer 通过结构化 entity catalog / annotation 渲染实体 chip，不再相信模型手写 title/id/ref 组合。
- 只读工具输出暴露 `id`、`type`、`title/name`，不再暴露 `ref` 或 `citation`。
- 写工具执行前校验 ID 字段，明确拒绝短号、wiki link、旧 `rf_*` source id。
- Agent 候选写入落库前拒绝 Agent-only display token，避免把 chat 协议写进用户内容。
- 一次性迁移历史 session catalog 事件，运行时不保留旧 `[[ref:*]]` / `ref` 字段兼容逻辑。

见 [Agent entity annotation 与工具身份边界改造计划](tech/agent-entity-annotation-identity-boundary-plan.md)。
