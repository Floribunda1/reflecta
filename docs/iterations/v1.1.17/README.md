# v1.1.17

Agent 正文内联引用改成 numbered citation 主路径。

当前实现只保留一条链路：

```text
assistant markdown text + per-answer citationSources
```

正文里的 `[n]` 是 display marker；真实 Reflecta entity identity 保存在同一条 assistant answer 的 `citationSources`。renderer 用 `citationSources` 把有效 marker 渲染成 entity title link。

## 文档

- [Citation Architecture](agent-inline-reference-citation-architecture.md)：当前实现和接手心智。
- [Pitfalls](agent-inline-reference-pitfalls.md)：已经踩过的错误方向。

## 已删除的旧方向

- `AgentTextPart` / `entity_ref`
- `reflecta_final_answer`
- `assistant.final.*`
- 二次 LLM finalizer
- title matcher
- `ReferenceRegistry`
- runtime session migration
