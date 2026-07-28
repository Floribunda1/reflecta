# language: zh-CN
@capture @connection @v1.2.5
功能: 用户显式连接相关 Understanding
  用户需要在写作时指出两条理解之间的关系，并从当前理解回到被引用的理解和它所在的知识图谱。

  @P0 @happy_path @CP-CONNECTION-001
  场景: 用户通过 wiki-link 连接另一条 Understanding
    假如 seed 数据中存在 Understanding「React Server Components」
    而且 seed 数据中存在 Understanding「Unconnected Node」
    当用户编辑 Understanding「React Server Components」的正文
    而且用户通过 wiki-link 候选选择 Understanding「Unconnected Node」
    而且用户离开并重新打开当前 Understanding
    那么正文中应该显示可读的 Understanding「Unconnected Node」链接

  @P0 @navigation @CP-CONNECTION-002
  场景: 用户从 wiki-link 打开被引用的 Understanding
    假如 seed 数据中 Understanding「React Server Components」的正文引用了 Understanding「React Suspense」
    当用户打开 Understanding「React Server Components」
    而且用户选择正文中的 Understanding「React Suspense」链接
    那么详情页应该打开 Understanding「React Suspense」
    而且理解列表应该选中 Understanding「React Suspense」

  @P1 @graph @CP-CONNECTION-003
  场景: 用户建立 Connection 后在知识漫步中看到关系
    假如 seed 数据中存在尚未连接的 Understanding「React Server Components」和「Unconnected Node」
    当用户通过 wiki-link 将 Understanding「React Server Components」连接到「Unconnected Node」
    而且用户进入知识漫步
    那么两条 Understanding 都应该显示为图谱节点
    而且两条节点之间应该显示一条 Connection
