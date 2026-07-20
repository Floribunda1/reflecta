# v1.2.1 — 导航与侧栏体验

本次 patch 版本统一了 Capture 与 Agent 的页面导航和侧栏交互。

- 将页面切换入口收敛到侧栏底部：Capture 页面直接进入“和 AI 对话”，Agent 页面直接进入“查看笔记”。
- 统一页面切换、设置、领域新增和对话新增按钮与领域树条目的悬停颜色。
- Capture 与 Agent 侧栏支持带动画的展开和收起，并使用不同图标表达当前状态。
- 收起侧栏后，展开按钮进入内容标题栏并避开 macOS 红绿灯区域。
- Understanding List 与 Chat Thread List 支持拖拽调整宽度，分隔线保持连续视觉。
- 修复 Agent Bash 输出中 Unicode 文件名被错误转义的问题。
