# v1.1.17

Agent 最终答案协议资格审查。

本版本先不急着换实现。它只回答一个问题：Reflecta 的正文内联实体引用，到底需要什么级别的输出保证，哪些方案真的满足，哪些只是继续靠 prompt 祈祷。

## 结论

当前 v1.1.16 的 `reflecta_final_answer` 方向只做到了“有一个结构化出口”，但没有做到“最终答案只能从这个出口出来”。

因此它仍然挡不住这些问题：

- Agent 直接输出普通 assistant text。
- Agent 手写 `<entity_ref />`、JSON、YAML、markdown token 等伪协议。
- Agent 不引用实体，只写标题。
- Agent 填入 shape 正确但 catalog 中不存在的 id。
- 无效 id 被 fallback 成普通文本继续展示。

v1.1.17 的判定标准：

- 不接受正文 parser 方案。
- 不接受 title 自动匹配方案。
- 不接受会话短号方案，例如 `U1`、`D1`、`[1]` 作为 Reflecta 实体身份。
- 不接受 optional final-answer tool 被包装成“硬保证”。
- 只接受能强制最终可见答案进入结构化通道的方案。

## 本版本要沉淀的硬门槛

一个方案只有同时满足下面条件，才算解决根因：

1. 最终可见答案能被强制为结构化输出。
2. 普通 assistant text 不能绕过结构化通道成为最终答案。
3. `entity_ref.entityId` 必须来自本轮 entity catalog。
4. schema 错、id 错、不引用时，系统进入 retry 或失败状态，而不是静默降级展示。
5. 不依赖模型手写任何可见引用格式。
6. Pi 当前 SDK 或被调用的 provider 能真实支持这个约束。
7. 不重踩 v1.1.16 已记录的 `ref`、短号、title matcher、display token 污染工具参数等坑。

## 流式渲染结论

最终答案不能等完整 JSON parse 完才突然出现。合格实现必须支持 finalizer 流式渲染：

- Pi Agent 过程区继续流式显示 reasoning / tool / approval 状态。
- 最终答案由 Reflecta finalizer 单独流式生成。
- finalizer 的 raw structured JSON 不进入 UI。
- UI 接收的是 Reflecta live events：已校验 `entity_ref` parts + provisional plain-text preview。
- 最终持久化的仍然只有 validated `AgentTextPart[]`。

## 文档

- [Agent 最终答案协议资格审查](tech/final-answer-protocol-qualification.md)
- [Final Answer Object Generator 实现计划](tech/final-answer-object-generator-plan.md)
