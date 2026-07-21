# v1.2.3 — 开源发布准备

本次 patch 版本完成 Reflecta 源码公开前的仓库整理与隐私隔离。

- 增加 MIT License，并重写面向公开读者的 README、源码运行说明和产品截图。
- 将生产派生的 Retrieval 质量评估逻辑与数据集中到本地 ignored 私有目录，公共测试不再依赖这些资产。
- 移除不再使用的 Skills package，并将测试和文档中的真实本机目录改为 project-based 示例。
- 清洗 Git 历史中的私有评估资产、个人绝对路径和无法确认授权的历史文档。
