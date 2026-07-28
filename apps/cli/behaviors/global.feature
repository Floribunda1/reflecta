# language: zh-CN
功能: 用户可靠地调用 Reflecta CLI
  用户需要明确选择知识库存储位置和输出格式，在修改数据前获得保护，并能从帮助和错误信息中继续操作。

  背景:
    假设 测试知识库已经可以由 CLI 访问

  # 数据库生命周期

  @CLI-GLOBAL-001
  场景: 数据库文件不存在时给出清晰错误
    假设 用户通过 --db 指向一个不存在的 SQLite 文件
    当 用户执行命令 "--db MISSING_DB_PATH domain list"
    那么 命令退出码应为 1
    并且 标准错误输出应包含 JSON 对象，字段 code 为 "DB_NOT_FOUND"，且 message 包含预期数据库路径

  @CLI-GLOBAL-002
  场景: 用户首次使用新的知识库存储位置
    假设 CLI 指向一个尚未初始化的 Content Storage Root
    当 用户执行命令 "understanding list"
    那么 命令应该成功
    并且 标准输出应该为空

  # 输出格式

  @CLI-GLOBAL-003
  场景: 默认使用 JSONL 格式输出数组
    假设 测试知识库中存在多条活跃 Understanding
    当 用户执行命令 "understanding list"
    那么 标准输出每行应为一条合法 JSON
    并且 每行都是一个 Understanding 摘要对象

  @CLI-GLOBAL-004
  场景: 使用 --format json 输出单个 JSON 数组
    假设 测试知识库中存在多条活跃 Understanding
    当 用户执行命令 "understanding list --format json"
    那么 标准输出应为单个合法 JSON 数组
    并且 数组包含全部 Understanding 摘要

  @CLI-GLOBAL-005
  场景: 单对象查询使用 --format json 输出对象而非数组
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "understanding get UNDERSTANDING_ID --format json"
    那么 标准输出应为一个包含该 Understanding 详情的 JSON 对象

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
    那么 命令退出码应为 0
    并且 再次查看 UNDERSTANDING_ID 时应该返回 NOT_FOUND

  # 静默模式

  @CLI-GLOBAL-009
  场景: --quiet 成功命令保持静默
    假设 存在一条活跃 Understanding，其 ID 为 UNDERSTANDING_ID
    当 用户执行命令 "understanding get UNDERSTANDING_ID --quiet"
    那么 标准输出应为空
    并且 命令退出码应为 0

  @CLI-GLOBAL-010
  场景: --quiet 模式下错误仍然输出到标准错误
    假设 测试知识库中不存在 ID MISSING_ID
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
    那么 标准输出应该显示用法、资源分组、命令和全局选项

  @CLI-GLOBAL-014
  场景: 嵌套帮助输出子命令列表
    当 用户执行命令 "reflecta understanding --help"
    那么 标准输出应该显示 understanding 的用法和可执行操作

  @CLI-GLOBAL-015
  场景: 用户查看可供 Agent 调用的操作清单
    当 用户执行命令 "reflecta list-actions"
    那么 标准输出应该按资源显示可调用操作
    并且 每个操作应该显示用途和是否会修改知识库

  @CLI-GLOBAL-016
  场景: 用户查看统一搜索入口的帮助
    当 用户执行命令 "reflecta search --help"
    那么 标准输出应该显示搜索词、分页选项和返回结果说明

  @CLI-GLOBAL-017
  场景: 用户查看关联图入口的帮助
    当 用户执行命令 "reflecta graph --help"
    那么 标准输出应该显示起点 Understanding、图谱深度和 Context 选项
