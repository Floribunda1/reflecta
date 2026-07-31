# language: zh-CN
@capture @understanding @v1.2.5
功能: 用户管理自己的 Understanding
  用户需要在一个 Domain 中写下刚形成的理解，并在离开或继续编辑后看到自己的内容被可靠保存。

  @P0 @happy_path @CP-UNDERSTANDING-001
  场景: 用户在当前 Domain 下新建 Understanding
    假如用户已经选择 Domain「Programming」
    当用户新建一条 Understanding
    而且用户填写标题 NEW_UNDERSTANDING_TITLE 和正文 NEW_UNDERSTANDING_BODY
    而且用户切换到另一条 Understanding
    而且用户重新打开 NEW_UNDERSTANDING_TITLE
    那么详情页应该显示标题 NEW_UNDERSTANDING_TITLE
    而且详情页应该显示正文 NEW_UNDERSTANDING_BODY
    而且这条 Understanding 应该属于 Domain「Programming」

  @P0 @editing @CP-UNDERSTANDING-002
  场景: 用户修改已有 Understanding 后重新打开仍看到修改
    假如 seed 数据中存在 Understanding「React Server Components」
    当用户打开这条 Understanding
    而且用户把标题改为 UPDATED_UNDERSTANDING_TITLE
    而且用户把正文改为 UPDATED_UNDERSTANDING_BODY
    而且用户打开另一条 Understanding
    而且用户重新打开 UPDATED_UNDERSTANDING_TITLE
    那么详情页应该显示标题 UPDATED_UNDERSTANDING_TITLE
    而且详情页应该显示正文 UPDATED_UNDERSTANDING_BODY

  @P0 @organization @CP-UNDERSTANDING-003
  场景: 用户调整 Understanding 所属的 Domain
    假如 seed 数据中存在 Understanding「React Server Components」
    而且 seed 数据中存在 Domain「Programming」和「Design」
    当用户打开 Understanding「React Server Components」
    而且用户把它归入 Domain「Design」
    那么详情页应该显示 Domain「Design」
    当用户选择 Domain「Design」
    那么理解列表应该显示 Understanding「React Server Components」

  @P0 @deletion @CP-UNDERSTANDING-004
  场景: 用户删除不再需要的 Understanding
    假如 seed 数据中存在 Understanding「React Server Components」和「Vue Reactivity」
    当用户删除 Understanding「React Server Components」并确认
    那么理解列表应该继续显示 Understanding「Vue Reactivity」
    而且详情区应该回到未选择 Understanding 的状态

  @P1 @content @CP-UNDERSTANDING-005
  场景: 用户查看 Understanding 中的 Mermaid 图表
    假如一条 Understanding 的正文包含有效的 Mermaid 图表
    当用户打开这条 Understanding
    那么正文中应该显示渲染后的图表
    当用户离开后重新打开这条 Understanding
    那么正文中仍应该显示渲染后的图表

  @P1 @error @CP-UNDERSTANDING-006
  场景: Mermaid 图表无效时用户仍能继续修改正文
    假如用户已经打开一条 Understanding
    当用户在正文中写入一个无效的 Mermaid 图表
    那么正文应该说明 Mermaid 图表渲染失败
    而且用户应该仍能编辑原来的图表源码和其他正文
