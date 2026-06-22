# language: zh-CN
@agent @v1.1.0
功能: 用户带上下文发送 Agent 消息
  用户需要能选择引用、附件、模型和推理强度，并在发送后看到这些上下文被清楚呈现。

  @P0 @context @AG-CONTEXT-001
  场景: 用户选中引用后发送消息
    假如 seed 数据中存在 Thought「React Server Components」
    而且 seed 数据中存在 Category「React」
    当用户在输入框中选择 Thought「React Server Components」和 Category「React」
    而且用户发送消息
    那么用户消息中应该显示 Thought「React Server Components」
    而且用户消息中应该显示 Category「React」
    而且 Agent 回复完成后，当前对话应该进入可继续输入状态

  @P1 @context @AG-CONTEXT-002
  场景: 用户发送附件后看到附件和回复
    假如用户已经打开一个对话
    而且测试环境有可上传文件 ATTACHMENT_FILE
    当用户在输入框添加附件 ATTACHMENT_FILE
    而且用户输入请总结这个附件
    而且用户发送消息
    而且用户等待 Agent 回复
    那么用户消息中应该显示附件 ATTACHMENT_FILE
    而且附件应该以 ATTACHMENT_FILE 的文件名显示
    而且页面应该出现一条 Agent 回复正文

  @P1 @context @AG-CONTEXT-003
  场景: 用户选择模型和推理强度后发送消息
    假如用户已经打开 Agent 页面
    而且页面允许选择模型和推理强度
    当用户打开模型菜单
    而且用户选择模型列表第一项，显示名称记为 M
    而且用户选择推理等级“中推理”
    而且用户发送一条消息
    而且用户等待 Agent 回复完成
    那么发送前界面应该显示已选择 M
    而且发送前界面应该显示已选择“中推理”
    而且发送过程中界面应该仍显示 M 和“中推理”
    而且 Agent 回复完成后界面应该仍显示 M 和“中推理”
    而且页面应该出现一条 Agent 回复正文
