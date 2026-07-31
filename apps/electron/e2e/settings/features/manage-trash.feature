# language: zh-CN
@settings @trash @v1.2.5
功能: 用户管理已删除的 Understanding 和 Context
  用户需要先从日常视图移除不再使用的内容，同时保留恢复误删内容和明确永久清理的机会。

  @P0 @recovery @TRASH-001
  场景: 用户恢复已删除的 Understanding
    假如用户已经从 Capture 删除 Understanding DELETED_UNDERSTANDING_TITLE
    当用户打开设置中的回收站
    而且用户恢复 DELETED_UNDERSTANDING_TITLE
    而且用户回到 Capture
    那么理解列表应该显示 DELETED_UNDERSTANDING_TITLE
    而且用户应该可以打开它的详情

  @P0 @recovery @TRASH-002
  场景: 用户恢复已删除的 Context
    假如用户已经从 Understanding 删除 Context DELETED_CONTEXT_TITLE
    当用户打开设置中的回收站
    而且用户恢复 DELETED_CONTEXT_TITLE
    而且用户回到原 Understanding
    那么详情页应该重新显示 Context DELETED_CONTEXT_TITLE

  @P0 @safety @TRASH-003
  场景: 用户永久删除回收站中的单项内容
    假如回收站中存在 Understanding DELETED_UNDERSTANDING_TITLE
    而且用户已经记录永久删除前的 Understanding 数量
    当用户选择永久删除 DELETED_UNDERSTANDING_TITLE
    那么页面应该要求用户确认永久删除
    当用户确认永久删除
    那么回收站中的 Understanding 数量应该比永久删除前少 1

  @P1 @safety @TRASH-004
  场景: 用户清空回收站
    假如回收站中存在多项已删除内容
    当用户选择清空回收站
    那么页面应该显示将被永久删除的项目数量
    当用户确认清空
    那么回收站应该显示为空
