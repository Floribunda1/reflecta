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
