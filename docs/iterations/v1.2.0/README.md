# v1.2.0 — 知识漫步

本版本将低频且能力分散的 Contemplate 页面收回 Capture，把产品顶层信息架构简化为 Capture + Agent。

知识漫步的当前产品方向是：让用户打开一个领域，通过一张 Obsidian 式图谱重新遇见自己已经形成的 Understanding，并随时进入原文与 Context，逐渐看清自己在这个领域已经知道什么。

连续阅读页的实现验证表明，顺序阅读虽然便于查看正文，却无法提供足够的领域整体感和主动探索欲。改版将完整删除连续阅读实现，再从干净的 Capture 基线重建领域图谱：每条 Understanding 都是可进入的节点，真实 Connection 是边，孤立 Understanding 同样被正常呈现；点击节点在右侧打开现有详情。页面不依赖随机逻辑、AI 阅读路径、复习任务或量化激励。

文档索引：

- [知识漫步价值主张](knowledge-wander-value-proposition.md)：当前产品方向与不可走偏的边界。
- [知识漫步计划与完成记录](knowledge-wander-plan.md)：删除连续阅读实现、从干净 Capture 基础重建图谱的实施计划与验证结果。
- [知识漫步 UI Spec](design/knowledge-wander-ui-spec.md)：Obsidian 式领域图谱的当前设计决策。
