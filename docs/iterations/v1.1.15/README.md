# v1.1.15

Agent 工具身份协议和工具失败状态修复。

- 让 Agent 工具直接使用 Reflecta 稳定实体 id，不再使用会话级 `rf_*` 别名作为工具参数。
- 聊天正文里的 ref 只负责展示和导航，不再承担工具调用协议。
- 拆开“用户批准执行”和“工具执行成功”：`approval.resolved` 不再暗示写入成功。
- 持久化并渲染工具失败状态，生产问题排查不再依赖手动读取 Pi 原始 `toolResult` 消息。
- UI 卡片必须把“已确认”和“执行结果”分开显示：已批准但执行失败时，终态显示为“执行失败”并展示失败原因。
- v1.1.12 的 session-scoped `[[ref:Sx]]` source map 只保留为历史背景和旧会话 renderer 兼容；新的面向模型工具输出不再暴露生成型 `rf_*` source id。
- 历史坏数据走一次性迁移补齐 canonical events，不在运行时长期维护旧 `toolResult` / 旧 ref / 旧 state 的语义推断逻辑。

见 [Agent 工具身份与失败状态计划](tech/agent-tool-identity-and-failure-state-plan.md)。
