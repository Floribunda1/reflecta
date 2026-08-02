# language: zh-CN
@capture @understanding @v1.2.5
功能: 用户找到要回看的 Understanding
  用户需要按 Domain、关键词和时间范围缩小 Understanding 列表，并在列表与详情之间调整合适的阅读空间。

  @P0 @filter @CP-LIST-002
  场景: 用户选择 Domain 后只看到当前领域中的 Understanding
    假如 seed 数据中存在 Domain「Programming」和「Design」
    而且两个 Domain 下分别存在不同的 Understanding
    当用户选择 Domain「Programming」
    那么理解列表应该显示属于「Programming」的 Understanding
    而且列表数量应该反映当前 Domain 的结果

  @P0 @filter @CP-LIST-003
  场景: 用户决定是否包含子 Domain 的 Understanding
    假如 seed 数据中存在 Domain「Programming」及其子 Domain「Frontend」
    而且两个 Domain 下分别存在不同的 Understanding
    当用户选择 Domain「Programming」
    而且用户关闭“包含子领域”
    那么理解列表应该只显示直接属于「Programming」的 Understanding
    当用户重新开启“包含子领域”
    那么理解列表应该同时显示子 Domain「Frontend」中的 Understanding

  @P0 @search @CP-LIST-004
  场景: 用户在当前 Domain 中搜索并清空关键词
    假如用户正在浏览包含 Understanding「React Server Components」的列表
    当用户搜索关键词“Server Components”
    那么理解列表应该显示 Understanding「React Server Components」
    而且列表数量应该显示搜索结果数和当前范围总数
    当用户清空并关闭搜索
    那么理解列表应该恢复当前 Domain 的全部结果

  @P1 @sorting @CP-LIST-005
  场景: 用户切换 Understanding 的排序方式
    假如当前列表中存在创建时间和更新时间不同的多条 Understanding
    那么列表应该默认按更新时间从新到旧显示
    当用户选择“按创建时间”
    那么列表应该按创建时间从新到旧显示

  @P1 @layout @CP-LIST-001
  场景: 用户调整 Understanding 列表宽度
    假如用户已经进入 Capture 页面
    当用户向右拖动 Understanding 列表与详情区之间的分隔条
    那么 Understanding 列表应该变宽
    而且详情区应该继续显示

  @P1 @layout @CP-LIST-006
  场景: 用户专注阅读当前 Understanding
    假如用户已经打开一条 Understanding
    当用户进入专注模式
    那么 Domain 侧栏和 Understanding 列表应该收起
    而且详情区应该占满可用空间
    而且详情区应该只显示 Understanding 的笔记内容
    而且顶部操作应该避开窗口控制区
    当用户按下 Esc
    那么 Domain 侧栏和 Understanding 列表应该恢复
