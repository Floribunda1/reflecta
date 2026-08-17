# language: zh-CN
@capture @understanding @v1.2.5
功能: 用户找到要回看的 Understanding
  用户需要按 Domain 和关键词缩小 Dashboard 卡片网格，并在网格与详情抽屉之间阅读自己的理解。

  @P0 @filter @CP-LIST-002
  场景: 用户选择 Domain 后只看到当前领域中的 Understanding
    假如 seed 数据中存在 Domain「Programming」和「Design」
    而且两个 Domain 下分别存在不同的 Understanding
    当用户在 Dashboard 顶部选择领域「Programming」
    那么卡片网格应该显示属于「Programming」的 Understanding
    而且卡片数量应该少于全部领域下的数量

  @P0 @search @CP-LIST-004
  场景: 用户搜索关键词并清空恢复
    假如用户正在浏览包含 Understanding「React Server Components」的卡片网格
    当用户在搜索框中输入关键词“Server Components”
    那么卡片网格应该显示 Understanding「React Server Components」
    当用户清空搜索框
    那么卡片网格应该恢复当前范围的全部结果

  @P1 @sorting @CP-LIST-005
  场景: 用户打开 Dashboard 看到最近更新的 Understanding 在前
    假如当前范围内存在创建时间和更新时间不同的多条 Understanding
    那么卡片网格应该默认按更新时间从新到旧显示
