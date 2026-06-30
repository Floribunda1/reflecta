# v1.1.16

Agent citation 与工具身份边界改造。

- 工具参数只接受 Reflecta 稳定实体 id，不再出现 `ref` 参数或 `ref` 字段暗示。
- Agent 正文引用改用会话级 citation handle，例如 `[U1]`、`[C1]`、`[D1]`。
- Renderer 通过 session entity catalog 把 citation 渲染成带 title 的实体 chip，不再相信模型手写 title 或 id 组合。
- 只读工具输出暴露 `id`、`type`、`title/name`、`citation`，不再暴露 `ref`。
- 写工具执行前校验 ID 字段，明确拒绝 citation、wiki link、旧 `rf_*` source id。
- Agent 候选写入落库前把 markdown citation 归一化为 Reflecta 现有 canonical wiki link 或普通标题，避免把 chat citation 写进用户内容。
- 一次性迁移历史 session catalog 事件，运行时不保留旧 `[[ref:*]]` / `ref` 字段兼容逻辑。

见 [Agent citation 与工具身份边界改造计划](tech/agent-citation-identity-boundary-plan.md)。
