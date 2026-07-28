# language: zh-CN
@agent @v1.1.0
功能: 用户带上下文发送 Agent 消息
  用户需要能选择引用、附件、模型和推理强度，并在发送后看到这些上下文被清楚呈现。

  @P0 @context @AG-CONTEXT-001
  场景: 用户选中引用后发送消息
    假如 seed 数据中存在 Understanding「React Server Components」
    而且 seed 数据中存在 Domain「React」
    当用户在输入框中选择 Understanding「React Server Components」和 Domain「React」
    而且用户发送消息
    那么用户消息中应该显示 Understanding「React Server Components」
    而且用户消息中应该显示 Domain「React」
    而且 Agent 回复完成后，当前对话应该进入可继续输入状态

  @P1 @context @AG-CONTEXT-003
  场景: 用户选择模型和推理强度后发送消息
    假如用户已经打开 Agent 页面
    而且页面允许选择模型和推理强度
    当用户打开模型菜单
    而且用户选择模型列表第一项，显示名称记为 M
    而且用户选择推理等级“高推理”
    那么输入区应该显示已选择 M
    而且输入区应该显示已选择“高推理”
    当用户发送一条消息
    那么发送过程中界面应该仍显示 M 和“高推理”
    当用户等待 Agent 回复完成
    那么 Agent 回复完成后界面应该仍显示 M 和“高推理”
    而且页面应该出现一条 Agent 回复正文

  @P1 @context @AG-CONTEXT-006
  场景: 用户打开 Agent 页面时默认使用高推理
    假如用户已经打开 Agent 页面
    那么模型菜单应该显示“高推理”

  @P1 @context @AG-CONTEXT-004
  场景: 用户通过 @ 搜索选择上下文引用
    假如 seed 数据中存在 Understanding「React Server Components」
    而且 seed 数据中存在 Domain「React」
    当用户在输入框输入 @React
    那么页面应该显示上下文候选列表
    而且候选列表应该包含 Understanding「React Server Components」
    而且候选列表应该包含 Domain「React」
    当用户选择 Understanding「React Server Components」
    那么输入框中应该显示 Understanding「React Server Components」

  @P1 @context @AG-CONTEXT-009
  场景: 用户通过 @ 搜索后按 Enter 选择上下文引用
    假如 seed 数据中存在 Understanding「React Server Components」
    当用户在输入框输入 @React
    而且用户按 Enter
    那么输入框中应该显示一个上下文引用
    而且输入框应该继续显示当前草稿并允许继续编辑

  @P1 @context @AG-CONTEXT-005
  场景: 用户点击已选择的 Understanding 引用后查看详情
    假如 seed 数据中存在 Understanding「React Server Components」
    而且用户已经在输入框中选择 Understanding「React Server Components」
    当用户点击输入框中的 Understanding「React Server Components」引用
    那么页面应该打开详情面板
    而且详情面板应该显示 Understanding「React Server Components」

  @P1 @context @attachment @AG-CONTEXT-007
  场景: 用户发送可读附件后看到 Agent 使用附件
    假如用户已经打开一个对话
    而且测试环境有可上传文件 ATTACHMENT_FILE
    当用户在输入框添加附件 ATTACHMENT_FILE
    而且用户要求 Agent 读取该附件
    而且用户发送消息
    那么用户消息中应该显示附件 ATTACHMENT_FILE
    而且页面应该显示 Agent 使用附件的工具活动
    而且页面应该出现一条 Agent 回复正文

  @P1 @context @AG-CONTEXT-008
  场景: 用户粘贴 Markdown 文本后继续编辑纯文本草稿
    假如用户已经打开 Agent 页面
    当用户把 Markdown 文本粘贴到输入框
    而且用户继续输入内容
    那么输入框应该保留 Markdown 原文
    而且继续输入的内容应该保持纯文本
