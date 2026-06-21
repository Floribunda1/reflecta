功能: V2 Agent Thread 与 Run 生命周期

  背景:
    假设 Reflecta 已配置可用的 AI Provider
    并且 数据库中存在 Thought、Context、Category 和 Connection

  @P0
  场景: 创建新 Thread 并完成一轮 Agent Run
    当 用户打开 Agent 页面
    并且 用户输入 "帮我解释一下我最近关于复盘的理解"
    并且 用户发送消息
    那么 系统创建一个新的 Agent Thread
    并且 用户消息被持久化
    并且 Assistant 首个流式片段不会丢失
    并且 Assistant 回复持续增量展示
    并且 回复完成后 Assistant 消息被持久化

  @P0
  场景: 重新打开后恢复最近活跃 Thread
    假设 已存在一个包含多轮消息的 Agent Thread
    当 用户重新打开 Agent 页面
    那么 系统恢复最近活跃的 Thread
    并且 消息按发送顺序显示
    并且 Thread 当前 run 状态被正确恢复

  @P0
  场景: 切换 Thread 后恢复对应消息和输入目标
    假设 已存在 Thread A 和 Thread B
    并且 两个 Thread 各自包含不同消息
    当 用户在 Thread list 中选择 Thread B
    那么 Chat stream 显示 Thread B 的消息
    并且 Composer 发送的新消息归属到 Thread B

  @P0
  场景: 流式运行期间切换 Thread 不会中断原 run
    假设 Thread A 的 Assistant 正在流式回复
    当 用户切换到 Thread B
    并且 用户再切回 Thread A
    那么 Thread A 的 run 仍然继续接收流式片段
    并且 Thread A 完成后的 Assistant 消息被持久化
    并且 Thread B 不会混入 Thread A 的流式内容

  @P0
  场景: 重命名 Thread
    假设 已存在一个 Agent Thread
    当 用户将 Thread 标题改为 "交易心理讨论"
    那么 Thread list 显示新标题
    并且 重启应用后标题仍然保留

  @P1
  场景: 归档 Thread
    假设 Thread list 中存在一个已完成讨论的 Thread
    当 用户归档该 Thread
    那么 默认 Thread list 不再显示该 Thread
    并且 归档 Thread 的消息和 Candidate 状态不会被删除

  @P1
  场景: 删除 Thread
    假设 Thread list 中存在一个测试 Thread
    当 用户删除该 Thread
    那么 Thread list 不再显示该 Thread
    并且 删除前需要用户确认

  @P0
  场景: 停止生成
    当 Assistant 正在流式回复
    并且 用户点击停止
    那么 当前模型请求被取消
    并且 已生成的文本保留在聊天流中
    并且 当前 run 标记为 canceled
    并且 用户可以继续发送下一条消息

  @P0
  场景: 应用重启后标记未完成 run
    假设 当前 Thread 存在一个 streaming run
    当 应用在 run 完成前重启
    并且 用户重新打开同一个 Thread
    那么 上一次 run 标记为 failed
    并且 聊天流显示可理解的中断状态
    并且 用户可以重新发送或继续对话

  @P0
  场景: 模型配置错误时给出可恢复错误
    假设 AI Provider Base URL 或 Model 配置错误
    当 用户发送消息
    那么 聊天流显示模型调用失败状态
    并且 错误说明区分为模型配置或 API 调用错误
    并且 用户消息不丢失
    并且 用户修正设置后可以重试当前消息

  @P1
  场景: 编辑上一条用户消息后重新生成
    假设 当前 Thread 最后一轮 Assistant 回复已完成
    当 用户编辑上一条用户消息
    并且 用户选择重新发送
    那么 系统以编辑后的消息重新生成 Assistant 回复
    并且 原有历史不会被静默覆盖
