# language: zh-CN
@app @navigation @canvas @v2.0.0
功能: 用户带参进入指定画布
  画布模块统一解析 `?canvas=<id>`（计划 T2）：列表进入与外部跳转（M6-6 / M3-E / U4 接收端）
  共用 `navigateToCanvas` 单一入口；带参挂载即自动打开指定画布。

  @P0 @happy_path @CV-NAV-001
  场景: 用户从画布列表进入画布
    假如用户已经进入画布模块
    当用户新建一张画布并返回列表
    当用户点击这张画布
    那么用户应该进入这张画布并看到其标题

  @P0 @happy_path @CV-NAV-002
  场景: 外部带参跳转直接打开指定画布
    假如用户已经进入画布模块
    当用户新建一张画布并返回列表
    当用户以带画布参数的入口再次进入画布模块
    那么用户应该直接打开这张画布（无需经过列表）

  @P1 @recovery @CV-NAV-003
  场景: 无参重新进入画布模块恢复上次选择的画布
    假如用户已经打开画布 REMEMBERED_CANVAS_TITLE
    当用户离开画布模块
    当用户再次进入画布模块（不带画布参数）
    那么应该自动打开 REMEMBERED_CANVAS_TITLE

  @P2 @recovery @CV-NAV-004
  场景: 上次选择的画布已删除时回到空态
    假如用户打开过画布 DELETED_CANVAS_TITLE 并让它成为上次选择
    当用户删除 DELETED_CANVAS_TITLE
    当用户离开画布模块再进入
    那么应该显示选择画布空态而不是已删除的画布
