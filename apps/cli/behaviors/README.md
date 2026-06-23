# Reflecta CLI — BDD 行为规范

本目录使用 [Cucumber/Gherkin](https://cucumber.io/docs/gherkin/) 语言描述 `@reflecta/cli` 的全部行为。

## 约定

- `UNDERSTANDING_ID`、`CONTEXT_ID`、`DOMAIN_ID` 指数据库中已存在的活跃记录。
- `DELETED_UNDERSTANDING_ID` 指已软删除的 Understanding。
- `MISSING_ID` 指数据库中不存在的 nanoid。
- 所有会修改数据的命令都需要 `--yes` 确认，除非另有说明。
- 默认输出格式为 JSONL；`--format json` 切换为单个 JSON 对象。

## 文件一览

| 文件                                           | 领域                                         |
| ---------------------------------------------- | -------------------------------------------- |
| [global.feature](global.feature)               | 全局选项、数据库生命周期、输出格式、帮助系统 |
| [understanding.feature](understanding.feature) | Understanding 的列表、查看、创建、更新、删除 |
| [context.feature](context.feature)             | Context 的列表、查看、创建、更新、删除       |
| [domain.feature](domain.feature)               | Domain 的列表、检查、创建、更新、删除        |
| [search.feature](search.feature)               | 全文检索（Understanding / Context）          |
| [graph.feature](graph.feature)                 | Understanding 关联图                         |
