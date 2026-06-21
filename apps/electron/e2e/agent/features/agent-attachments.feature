功能: V2 Agent 附件与本地输入

  背景:
    假设 用户已打开 Agent 页面
    并且 Reflecta 已配置 OpenAI Provider 和 OpenAI Compatible Provider

  @P0
  场景: 用户上传文本附件并发送
    当 用户在 Composer 中添加文件 "notes.txt"
    并且 用户发送 "读一下这个附件，帮我总结重点"
    那么 用户消息保存附件 metadata
    并且 聊天流显示附件文件名
    并且 Assistant 可以基于附件内容回复

  @P0
  场景: OpenAI Provider 保留原生 file part
    假设 当前 AI Provider 支持原生 file message part
    当 用户上传图片附件并发送消息
    那么 发送给模型的消息保留 file part
    并且 附件 metadata 仍可用于聊天记录恢复

  @P0
  场景: Text-only Provider 通过 attachment_read 读取附件
    假设 当前 AI Provider 不支持原生 file message part
    当 用户上传文本附件并发送消息
    那么 发送给模型的消息只包含 attachmentId、文件名和 mediaType
    并且 不直接把附件全文塞进 prompt
    并且 Agent 需要内容时调用 tool "attachment_read"
    并且 ToolActivity 显示 "读取附件"

  @P0
  场景: Agent 读取 PDF 附件内容
    当 用户上传 PDF 附件并要求总结
    那么 Agent 可以调用 tool "attachment_read"
    并且 tool 返回提取后的 PDF 文本
    并且 Assistant 回复基于 PDF 文本内容

  @P0
  场景: 二进制附件不会泄露 base64
    当 用户上传无法解析为文本的二进制附件
    并且 Agent 调用 tool "attachment_read"
    那么 tool 返回不可读的错误说明
    并且 聊天流不显示附件 base64 内容
    并且 Assistant 不假装已经读取二进制内容

  @P1
  场景: 附件不存在时给出可恢复错误
    假设 用户消息中的 attachmentId 已失效
    当 Agent 调用 tool "attachment_read"
    那么 ToolActivity 显示读取失败
    并且 Assistant 说明找不到该附件
    并且 用户可以重新上传附件继续对话

  @P1
  场景: Agent 读取用户提供的本地文件路径
    当 用户发送 "帮我看一下 /tmp/reflecta-note.txt"
    那么 Agent 可以调用 tool "file_read"
    并且 ToolActivity 显示读取本地文件
    并且 Assistant 回复基于文件内容

  @P1
  场景: Bash 工具必须等待用户确认
    当 Agent 判断需要执行 tool "bash"
    那么 聊天流显示 Bash approval card
    并且 用户确认前不会执行命令
    并且 用户拒绝后不会产生命令输出
