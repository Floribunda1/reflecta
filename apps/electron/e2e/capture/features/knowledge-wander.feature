# language: zh-CN
@capture @knowledge_wander @v1.2.0
功能: 用户在 Capture 中漫步既有知识
  用户需要按领域连续阅读自己已经表达清楚的理解，并在内容视图和关系视图之间切换，而不进入另一套回顾流程。

  @P0 @happy_path @KW-WANDER-001
  场景: 用户连续阅读完整理解并打开详情
    假如 seed 数据中存在 Understanding「React Server Components」及其完整正文
    当用户在 Capture 中进入「知识漫步」
    那么默认应该以瀑布流展示「全部领域」中的理解数量
    而且 Understanding「React Server Components」卡片应该展示完整正文
    而且瀑布流应该以最多双列占满可用阅读面
    而且卡片应该沿用 Capture 原有的安静背景、边框和选择状态
    而且两列都应该连续向下铺排而不提前留下大片空白
    而且卡片中的 Markdown 结构应该以适合连续阅读的样式呈现
    而且正文中的双链应该与普通文本清晰区分
    而且卡片应该展示它的上下文数量和关联数量
    当用户打开这张卡片
    那么右侧应该打开同一条 Understanding 的可编辑详情
    而且用户关闭详情后仍然停留在原来的瀑布流位置

  @P0 @happy_path @KW-WANDER-002
  场景: 用户切换图谱观察真实关系
    假如 seed 数据中 Domain「Programming」的子领域包含 Understanding「React Server Components」
    当用户选择 Domain「Programming」并进入「知识漫步」
    而且切换到「图谱」
    那么应该看到全部 Understanding 以圆点组成类似 Obsidian Graph View 的力导向图
    而且有 Connection 的 Understanding 之间应该以细线连接
    而且缩放时标题应该按可读尺度出现或隐藏
    而且聚焦节点时应该突出它和一跳关系并淡化无关节点
    当用户在图谱中打开 Understanding「React Server Components」
    那么右侧应该打开同一条 Understanding 的可编辑详情
    当用户切回「瀑布流」
    那么之前的瀑布流位置应该保持不变

  @P0 @navigation @KW-WANDER-003
  场景: 用户从旧入口回到 Capture
    假如用户保存过旧 Contemplate 地址
    当用户打开这个旧地址
    那么应该进入 Capture 页面
    而且模块切换菜单应该只提供 Capture 和 Agent
