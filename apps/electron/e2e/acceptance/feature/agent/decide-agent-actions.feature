# language: zh-CN
@agent @v1.1.0
功能: 用户决定 Agent 提议的操作
  用户需要能确认或拒绝 Agent 提案，并在之后继续看到处理结果。

  @P0 @proposal @AG-PROPOSAL-001
  场景: 用户确认候选 Understanding 后看到执行结果
    假如对话中已经出现待确认“候选 Understanding”提案卡片
    而且该卡片的候选标题为 CANDIDATE_TITLE
    而且用户有权限确认该操作
    当用户点击该提案卡片上的确认
    而且用户等待操作结果显示
    那么“候选 Understanding”提案卡片应该可见
    而且卡片中应该显示候选标题 CANDIDATE_TITLE
    而且该提案状态应该显示为执行完成
    而且界面应该显示该提案的操作结果

  @P0 @proposal @AG-PROPOSAL-002
  场景: 用户拒绝候选 Understanding 后看到拒绝结果
    假如对话中已经出现待确认“候选 Understanding”提案卡片
    而且该卡片的候选标题为 CANDIDATE_TITLE
    而且用户有权限拒绝该操作
    当用户点击该提案卡片上的拒绝
    那么“候选 Understanding”提案卡片应该可见
    而且卡片中应该显示候选标题 CANDIDATE_TITLE
    而且该提案状态应该显示为已拒绝
    而且界面应该显示该提案的拒绝结果

  @P1 @proposal @recovery @AG-PROPOSAL-003
  场景: 用户重新打开对话后仍能看到提案处理结果
    假如用户已经确认或拒绝过一个候选 Understanding 提案
    当用户离开该对话
    而且用户重新打开该对话
    那么用户应该仍能看到该提案卡片
    而且用户应该仍能看到之前的确认或拒绝状态

  @P1 @proposal @AG-PROPOSAL-004
  场景: 用户确认候选 Domain 后看到执行结果
    假如对话中已经出现待确认“候选 Domain”提案卡片
    而且该卡片的候选名称为 CANDIDATE_DOMAIN_NAME
    而且用户有权限确认该操作
    当用户点击该提案卡片上的确认
    而且用户等待操作结果显示
    那么“候选 Domain”提案卡片应该可见
    而且卡片中应该显示候选名称 CANDIDATE_DOMAIN_NAME
    而且该提案状态应该显示为执行完成
    而且界面应该显示该提案的操作结果

  @P1 @proposal @recovery @AG-PROPOSAL-005
  场景: 用户重启应用后仍能处理等待确认的提案并让 Agent 自动继续
    假如对话中已经显示 Agent 在提案前给出的内容
    而且对话中已经出现待确认“候选 Understanding”提案卡片
    而且该卡片的候选标题为 CANDIDATE_TITLE
    当用户退出并重新打开应用
    而且用户重新打开该对话
    那么用户应该仍能看到提案前的内容
    而且用户应该仍能看到该提案卡片
    而且用户应该仍能看到确认和拒绝操作
    当用户点击该提案卡片上的拒绝
    那么该提案状态应该显示为已拒绝
    而且 Agent 应该根据这个决定自动继续回复

  @P0 @proposal @decision @AG-PROPOSAL-006
  场景: 用户让 Agent 执行无害 Bash 命令后看到执行结果
    假如用户要求 Agent 用 bash 执行无害命令（无危险规则的普通命令，如写入标记文件）
    当用户等待 Agent 完成回复
    那么 bash 工具应该被调用并完成执行
    而且页面应该显示命令执行后的 Agent 回复正文
    而且输入框应该可操作

  @P1 @proposal @recovery @AG-PROPOSAL-007
  场景: 用户重新打开对话后看到已确认操作的失败原因
    假如用户已经确认过一个候选 Understanding 修改
    而且该操作执行失败并保存了失败原因
    当用户重新打开该对话
    那么用户应该仍能看到该提案卡片
    而且该提案状态应该显示为执行失败
    而且卡片应该显示之前保存的失败原因

  @P0 @proposal @decision @AG-PROPOSAL-008
  场景: Agent 不执行危险 Bash 命令时产品状态保持可用
    假如用户要求 Agent 用 bash 执行危险命令（如含 sudo 的提权命令）
    当用户等待 Agent 完成回复
    那么 bash 工具不应被实际执行
    而且页面应该显示 Agent 的回复正文
    而且输入框应该可操作

  @P0 @proposal @decision @AG-PROPOSAL-010
  场景: 用户确认候选画布后看到执行结果并进入产出
    假如对话中已经出现待确认“候选画布”提案卡片
    而且 Agent 已经在该提案中给出了创建画布的建议依据 REASON
    当用户点击该提案卡片上的确认
    而且用户等待操作结果显示
    那么“候选画布”提案卡片应该可见
    而且该提案状态应该显示为执行完成
    而且对话顶部产出入口中的画布数量应该增加 1
