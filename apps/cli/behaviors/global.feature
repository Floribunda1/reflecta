# language: zh-CN
功能: 全局行为

  背景:
    假设 数据库已初始化并包含基础表结构

  # 数据库生命周期

  @CLI-GLOBAL-001
  场景: 数据库文件不存在时给出清晰错误
    假设 环境变量 REFLECTA_DB_PATH 指向一个不存在的文件
    当 用户执行命令 "domain list"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 JSON 对象，字段 code 为 "DB_NOT_FOUND"，且 message 包含预期数据库路径

  @CLI-GLOBAL-002
  场景: 数据库存在但未初始化时自动迁移
    假设 REFLECTA_DB_PATH 指向一个空的 SQLite 文件
    当 用户执行命令 "understanding list"
    那么 CLI 应自动应用所有待执行的迁移
    并且 命令成功返回空结果集

  # 输出格式

  @CLI-GLOBAL-003
  场景: 默认使用 JSONL 格式输出数组
    假设 数据库中存在多条活跃 Understanding
    当 用户执行命令 "understanding list"
    那么 标准输出每行应为一条合法 JSON
    并且 每行都是一个 Understanding 摘要对象

  @CLI-GLOBAL-004
  场景: 使用 --format json 输出单个 JSON 数组
    假设 数据库中存在多条活跃 Understanding
    当 用户执行命令 "understanding list --format json"
    那么 标准输出应为单个合法 JSON 数组
    并且 数组包含全部 Understanding 摘要

  @CLI-GLOBAL-005
  场景: 单对象查询使用 --format json 输出对象而非数组
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "understanding get UNDERSTANDING_ID --format json"
    那么 标准输出应为单个 JSON 对象（不是数组）

  @CLI-GLOBAL-006
  场景: 单对象查询使用 --format jsonl 输出单行
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "understanding get UNDERSTANDING_ID --format jsonl"
    那么 标准输出应为一行 JSON 对象

  # 修改确认

  @CLI-GLOBAL-007
  场景: 修改命令未加 --yes 时拒绝执行
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "understanding delete UNDERSTANDING_ID"
    那么 命令退出码应为 3
    并且 标准错误输出应包含 JSON 对象，字段 code 为 "CONFIRMATION_REQUIRED"

  @CLI-GLOBAL-008
  场景: 修改命令加 --yes 后正常执行
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "understanding delete UNDERSTANDING_ID --yes"
    那么 Understanding 被软删除
    并且 命令退出码应为 0

  # 静默模式

  @CLI-GLOBAL-009
  场景: --quiet 抑制标准输出但不抑制错误
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "understanding get UNDERSTANDING_ID --quiet"
    那么 标准输出应为空
    并且 命令退出码应为 0

  @CLI-GLOBAL-010
  场景: --quiet 模式下错误仍然输出到标准错误
    假设 存在一个数据库中不存在的 ID MISSING_ID
    当 用户执行命令 "understanding get MISSING_ID --quiet"
    那么 标准输出应为空
    并且 标准错误输出应包含 NOT_FOUND 错误
    并且 命令退出码应为 1

  # 参数校验

  @CLI-GLOBAL-011
  场景: 整数选项传入非数字值时报错
    当 用户执行命令 "understanding list --limit not-a-number"
    那么 命令退出码应为 2
    并且 标准错误输出应包含 JSON 对象，字段 code 为 "VALIDATION_ERROR"

  @CLI-GLOBAL-012
  场景: 缺少子命令时报错
    当 用户执行命令 "understanding"
    那么 命令退出码应为 2
    并且 标准错误输出应包含校验错误提示

  # 帮助系统

  @CLI-GLOBAL-013
  场景: 顶层帮助输出命令分组
    当 用户执行命令 "reflecta --help"
    那么 标准输出应为一个 JSON 对象，列出所有顶层命令分组

  @CLI-GLOBAL-014
  场景: 嵌套帮助输出子命令列表
    当 用户执行命令 "reflecta understanding --help"
    那么 标准输出应为一个 JSON 对象，列出 understanding 下的所有子命令
