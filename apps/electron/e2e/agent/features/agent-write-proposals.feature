功能: V2 Agent 写入提案与确认

  背景:
    假设 用户正在一个 Agent Thread 中与 Assistant 对话
    并且 当前 Thread 引用了至少一条 Thought

  @P0
  场景: 生成候选 Thought 但不直接写入
    当 用户发送 "把刚刚聊出来的东西整理成一条候选 Thought"
    那么 Agent 生成 CandidateThoughtCard
    并且 卡片包含标题、正文、source refs 和 suggested category
    并且 数据库中尚未新增 Thought
    并且 用户可以编辑或拒绝该候选

  @P0
  场景: 确认候选 Thought 后写入知识库
    假设 聊天流中存在 pending CandidateThoughtCard
    当 用户点击保存
    那么 系统通过 Reflecta domain service 创建 Thought
    并且 Candidate 状态变为 approved
    并且 卡片显示新 Thought 的真实对象链接

  @P0
  场景: 拒绝候选 Thought 不产生写入
    假设 聊天流中存在 pending CandidateThoughtCard
    当 用户点击拒绝
    那么 Candidate 状态变为 rejected
    并且 数据库中不新增 Thought
    并且 Agent 后续回复能感知用户拒绝了该提案

  @P0
  场景: 修改已有 Thought 必须展示 Diff
    当 用户发送 "把 @反馈延迟 这条改得更精确一点"
    那么 Agent 生成 UpdateThoughtDiffCard
    并且 卡片展示原内容、修改后内容和修改原因
    并且 用户确认前原 Thought 不被修改

  @P0
  场景: 生成候选 Connection
    当 用户发送 "我觉得 @逃避复盘 和 @不愿止损 真的有关，帮我连一下"
    那么 Agent 生成 CandidateConnectionCard
    并且 卡片展示 From Thought、To Thought 和关系说明
    并且 文案使用 "候选关联" 而不是 "已发现关联"
    并且 用户确认前不创建 Connection

  @P0
  场景: 生成候选 Context
    当 用户发送 "把我们刚刚这段讨论作为 @反馈延迟 的 Context 保存一下"
    那么 Agent 生成 CandidateContextCard
    并且 卡片展示目标 Thought、Context 摘要和对话来源片段
    并且 用户确认前不创建 Context

  @P0
  场景: 工具读取后继续运行，写入提案后暂停等待用户
    当 Agent 先调用只读 tool
    并且 Agent 随后生成一个 pending CandidateThoughtCard
    那么 只读 tool 完成后 Assistant run 继续
    并且 pending CandidateThoughtCard 出现后 run 暂停等待用户处理
    并且 Candidate 未确认前不会写入数据库

  @P0
  场景: 确认提案后 Agent 可以继续后续回复
    假设 聊天流中存在 pending CandidateThoughtCard
    当 用户点击保存
    那么 Candidate 状态变为 approved
    并且 Agent 可以继续生成保存后的说明或下一步建议

  @P0
  场景: 多个提案不会被自动跳过
    假设 Agent 需要连续提出两个写入候选
    当 第一个 CandidateCard 出现
    那么 Agent 不会自动提交第二个写入
    并且 用户处理第一个 CandidateCard 后才会看到下一步提案

  @P0
  场景: Pending Candidate 跨刷新恢复
    假设 聊天流中存在 pending CandidateConnectionCard
    当 用户刷新或重启应用
    并且 用户重新打开同一个 Thread
    那么 CandidateConnectionCard 仍然显示为 pending
    并且 用户仍可以确认或拒绝

  @P0
  场景: Pending Candidate 在后续回复中仍被称为候选内容
    假设 聊天流中存在 pending CandidateThoughtCard
    当 Agent 后续回复引用该内容
    那么 Agent 应把它称为候选内容
    并且 不应把它表述为已保存的 Thought

  @P1
  场景: Candidate 写入失败后可重试
    假设 聊天流中存在 pending CandidateThoughtCard
    并且 数据库写入时发生错误
    当 用户点击保存
    那么 Candidate 状态变为 failed
    并且 卡片显示失败原因
    并且 用户可以修改后再次保存

  @P1
  场景: 已确认 Candidate 不允许重复提交
    假设 CandidateThoughtCard 已经 approved
    当 用户再次点击保存入口
    那么 系统不应重复创建 Thought
    并且 卡片保持 approved 状态
