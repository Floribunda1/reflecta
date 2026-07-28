# Reflecta CLI — BDD 行为规范

本目录使用 [Cucumber/Gherkin](https://cucumber.io/docs/gherkin/) 语言描述用户通过 `@reflecta/cli` 操作 Reflecta 知识库的场景。

## 约定

- 所有 feature 文件使用中文 Gherkin，并在文件第一行声明 `# language: zh-CN`。
- 每个场景前必须有稳定 ID tag。当前前缀为 `@CLI-GLOBAL-*`、`@CLI-UNDERSTANDING-*`、`@CLI-CONTEXT-*`、`@CLI-DOMAIN-*`、`@CLI-SEARCH-*`、`@CLI-GRAPH-*`。
- `UNDERSTANDING_ID`、`CONTEXT_ID`、`DOMAIN_ID` 指测试知识库中已存在的可用对象。
- `DELETED_UNDERSTANDING_ID` 指测试知识库中已删除的 Understanding。
- `MISSING_ID` 指测试知识库中不存在的 ID。
- 具体数据必须来自测试 seed；不重要的具体值使用大写占位符，在执行前绑定到 seed 或 fixture。
- 所有会修改数据的命令都需要 `--yes` 确认，除非另有说明。
- 默认输出格式为 JSONL；`--format json` 切换为单个 JSON 对象。
- Feature 只描述用户执行的命令和可观察结果，不断言数据库表、字段或外键实现。
- 自动化测试通过 CLI 的公开输入与输出证明场景，不直接查询内部数据库状态。

## 文件一览

| 文件                                           | 领域                                  |
| ---------------------------------------------- | ------------------------------------- |
| [global.feature](global.feature)               | 用户可靠调用 CLI、获得帮助并控制输出  |
| [understanding.feature](understanding.feature) | 用户沉淀和维护 Understanding          |
| [context.feature](context.feature)             | 用户管理 Understanding 的具体 Context |
| [domain.feature](domain.feature)               | 用户组织和检查 Domain                 |
| [search.feature](search.feature)               | 用户找回 Understanding 与 Context     |
| [graph.feature](graph.feature)                 | 用户查看 Understanding 周围的显式连接 |
