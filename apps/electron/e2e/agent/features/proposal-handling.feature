# language: zh-CN
@agent @v1.1.0
功能: 用户处理 Agent 提案
  用户需要能确认或拒绝 Agent 提案，并在之后继续看到处理结果。

  @P0 @proposal @AG-PROPOSAL-001
  场景: 用户确认候选 Thought 后看到执行结果
    假如对话中已经出现待确认“候选 Thought”提案卡片
    而且该卡片的候选标题为 CANDIDATE_TITLE
    而且用户有权限确认该操作
    当用户点击该提案卡片上的确认
    而且用户等待操作结果显示
    那么“候选 Thought”提案卡片应该可见
    而且卡片中应该显示候选标题 CANDIDATE_TITLE
    而且该提案状态应该显示为已确认
    而且界面应该显示该提案的操作结果

  @P0 @proposal @AG-PROPOSAL-002
  场景: 用户拒绝候选 Thought 后看到拒绝结果
    假如对话中已经出现待确认“候选 Thought”提案卡片
    而且该卡片的候选标题为 CANDIDATE_TITLE
    而且用户有权限拒绝该操作
    当用户点击该提案卡片上的拒绝
    那么“候选 Thought”提案卡片应该可见
    而且卡片中应该显示候选标题 CANDIDATE_TITLE
    而且该提案状态应该显示为已拒绝
    而且界面应该显示该提案的拒绝结果

  @P1 @proposal @recovery @AG-PROPOSAL-003
  场景: 用户重新打开对话后仍能看到提案处理结果
    假如用户已经确认或拒绝过一个候选 Thought 提案
    当用户离开该对话
    而且用户重新打开该对话
    那么用户应该仍能看到该提案卡片
    而且用户应该仍能看到之前的确认或拒绝状态
