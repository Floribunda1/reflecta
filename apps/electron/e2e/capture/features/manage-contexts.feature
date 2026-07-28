# language: zh-CN
@capture @context @v1.2.5
功能: 用户为 Understanding 保留具体上下文
  用户需要记录一条理解从哪些材料、实践或对话中长出来，并能在之后查看、修正或移除这些上下文。

  @P0 @happy_path @CP-CONTEXT-001
  场景: 用户为 Understanding 添加 Context
    假如 seed 数据中存在 Understanding「React Server Components」
    当用户打开这条 Understanding
    而且用户添加一个“个人经历”Context
    而且用户填写标题「新增上下文」和内容「这是新增的上下文内容」
    而且用户保存 Context
    那么详情页应该显示 Context「新增上下文」
    而且 Context 应该显示媒介“个人经历”
    而且 Context 预览应该包含「这是新增的上下文内容」

  @P0 @editing @CP-CONTEXT-002
  场景: 用户查看并修改已有 Context
    假如 seed 数据中存在带有 Context 的 Understanding
    当用户打开该 Context 的预览
    那么用户应该看到完整的 Context 标题、媒介和内容
    当用户编辑该 Context
    而且用户把标题改为「修改后的上下文」
    而且用户把内容改为「这是修改后的上下文内容」
    而且用户保存 Context
    那么详情页应该显示 Context「修改后的上下文」
    而且重新打开预览后应该显示「这是修改后的上下文内容」

  @P0 @deletion @CP-CONTEXT-003
  场景: 用户删除不再需要的 Context
    假如 seed 数据中存在带有 Context 的 Understanding
    当用户从 Context 菜单选择删除并确认
    那么 Understanding 详情中的 Context 数量应该减少
    而且剩余 Context 应该继续显示
