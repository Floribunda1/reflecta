# language: zh-CN
@capture @domain @v1.1.10
功能: 用户管理 Domain Tree
  用户在整理长期领域时，需要能调整同级 Domain 的展示顺序，并让这个顺序在后续使用中保持一致。

  @P0 @happy_path @CP-DOMAIN-001
  场景: 用户拖动根级 Domain 调整顺序
    假如 seed 数据中存在根级 Domain「Programming」和「Design」
    当用户在 Capture 页面把 Domain「Design」拖到 Domain「Programming」前面
    那么 Domain Tree 中「Design」应该显示在「Programming」前面
    而且用户离开并回到 Capture 页面后，Domain Tree 仍然保持「Design」在「Programming」前面

  @P0 @happy_path @CP-DOMAIN-002
  场景: 用户拖动根级 Domain 穿过展开子节点调整顺序
    假如 seed 数据中存在根级 Domain「Programming」「Design」「Reading」
    而且 Domain「Programming」下存在子 Domain「DevOps」
    当用户展开 Domain「Programming」
    并且把 Domain「Reading」拖到 Domain「Programming」的子节点区域
    那么 Domain Tree 中「Reading」应该显示在「Programming」后面
    而且 Domain Tree 中「Reading」应该显示在「Design」前面

  @P1 @navigation @CP-DOMAIN-005
  场景: 用户收起后从理解列表重新展开 Domain Tree
    假如用户已经进入 Capture 页面
    当用户收起 Domain Tree
    那么 Domain Tree 应该完全隐藏
    而且理解列表标题左侧应该显示展开 Domain Tree 的操作
    当用户从理解列表标题左侧展开 Domain Tree
    那么 Domain Tree 应该恢复显示
    而且收起 Domain Tree 的操作应该显示在 Domain Tree 右上角
