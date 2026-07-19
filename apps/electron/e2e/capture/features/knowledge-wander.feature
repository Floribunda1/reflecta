# language: zh-CN
@capture @knowledge_wander @v1.2.0
功能: 用户按领域连续翻阅自己的理解
  用户需要在一个稳定的领域范围内反复阅读具体 Understanding，并在值得停留的地方进入原始详情，而不是完成复习任务或浏览抽象图谱。

  @P0 @happy_path @KW-WANDER-001
  场景: 用户连续阅读领域中的完整理解
    假如 seed 数据中存在 Understanding「React Server Components」及其完整正文
    当用户在 Capture 中进入「知识漫步」
    那么阅读页应该显示「全部领域」及其 Understanding 数量
    而且 Understanding「React Server Components」应该作为连续正文段落出现
    而且这条 Understanding 应该显示完整正文、更新时间、Context 数量和 Connection 数量
    而且 Markdown 正文应该使用与 Understanding 详情一致的阅读样式

  @P0 @context @KW-WANDER-002
  场景: 用户从阅读页进入一条理解并回到原位置
    假如用户已在知识漫步中滚动到 Understanding「React Server Components」
    当用户打开这条 Understanding
    那么右侧应该显示同一条 Understanding 的可编辑详情和 Context
    当用户关闭详情
    那么用户应该回到打开前的连续阅读位置

  @P0 @navigation @KW-WANDER-003
  场景: 用户在知识漫步中切换领域
    假如 seed 数据中存在 Domain「Programming」及其子领域
    当用户进入知识漫步并选择 Domain「Programming」
    那么阅读页应该显示「Programming」及其范围内的 Understanding 数量
    而且阅读位置应该回到这个领域的开头

  @P0 @navigation @KW-WANDER-004
  场景: 用户从旧入口回到 Capture
    假如用户保存过旧 Contemplate 地址
    当用户打开这个旧地址
    那么应该进入 Capture 页面
    而且模块切换菜单应该只提供 Capture 和 Agent
