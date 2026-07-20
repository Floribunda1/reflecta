# language: zh-CN
@capture @understanding @v1.1.10
功能: 用户浏览 Understanding 列表
  用户在浏览理解与详情时，需要按当前内容调整列表和详情区的可用空间。

  @P1 @layout @CP-LIST-001
  场景: 用户调整 Understanding 列表宽度
    假如用户已经进入 Capture 页面
    当用户向右拖动 Understanding 列表与详情区之间的分隔条
    那么 Understanding 列表应该变宽
    而且详情区应该继续显示
