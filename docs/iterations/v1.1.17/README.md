# v1.1.17

Agent 正文内联实体引用架构重审。

本版本回答一个问题：Reflecta 的正文内联实体引用，如何做到 Codex 文件引用那种稳定可点，同时不再重踩 parser、短号、title matcher、二次 finalizer 重写全文这些坑。

## 结论

当前最终结论见 [Agent Inline References Clean Architecture](agent-inline-reference-clean-architecture.md)。

最干净的目标架构是：

```text
用户 @ refs / 工具输出
  -> AgentEntityCatalog 收集真实 entity refs
  -> 主 Agent 生成最终 AgentTextPart[]
  -> validateFinalAnswerParts(parts, entityCatalog)
  -> renderer inline 渲染 entity_ref
```

架构原则：

- 不新增 `ReferenceRegistry`。
- 不使用 `U1`、`D1`、`[1]`、`ref:nanoid` 作为 Reflecta entity 身份。
- 不做 title 自动匹配。
- 不让第二个 LLM 重写主 Agent 答案。
- 复用现有 `AgentEntityCatalog`、`AgentTextPart`、`validateFinalAnswerParts` 和 renderer。
- inline link 的真实目标只能来自 validated `entity_ref.entityId`。

## 本版本要沉淀的硬门槛

一个方案只有同时满足下面条件，才算解决根因：

1. 最终可见答案能被强制为结构化输出。
2. 普通 assistant text 不能绕过结构化通道成为最终答案。
3. `entity_ref.entityId` 必须来自本轮 entity catalog。
4. schema 错、id 错、不引用时，系统进入 retry 或失败状态，而不是静默降级展示。
5. 不依赖模型手写任何可见引用格式。
6. Pi 当前 SDK 或被调用的 provider 能真实支持这个约束。
7. 不重踩 v1.1.16 已记录的 `ref`、短号、title matcher、display token 污染工具参数等坑。

## 当前取舍

旧的 Final Answer Object Generator 文档保留为历史记录，但不再作为目标架构。

当前目标不是“把二次 finalizer 做得更强”，而是把 structured final answer 移回主 Agent 的最终出口：

```text
Pi Agent final tool
  -> AgentTextPart[]
  -> local validation
  -> inline renderer
```

## 文档

- [Agent Inline References Clean Architecture](agent-inline-reference-clean-architecture.md)
- [Agent 正文引用踩坑记录](agent-inline-reference-pitfalls.md)
- [Agent 最终答案协议资格审查](tech/final-answer-protocol-qualification.md)
- [Final Answer Object Generator 实现计划](tech/final-answer-object-generator-plan.md)（历史方案）
