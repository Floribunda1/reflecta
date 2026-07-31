# language: zh-CN
@agent @v1.1.0
功能: 用户检查 Agent 的工作过程和结果
  用户需要查看 Agent 的活动、工具结果、知识库引用和最终答案，并在重新进入后继续理解这些结果。

  @P1 @result @AG-RESULT-001
  场景: 用户在复杂回复中检查工作记录和最终结果
    假如对话中有一条复杂 Agent 回复
    而且该回复包含过程说明
    而且该回复包含知识检索活动
    而且该回复包含提案卡片
    而且该回复包含最终回复正文
    当用户打开该对话
    而且用户展开 Agent 活动
    那么 Agent 活动中应该显示过程说明和知识检索结果
    而且提案卡片应该显示待确认的候选内容
    而且页面应该显示最终回复正文

  @P1 @result @AG-RESULT-002
  场景: 用户可以区分提案的不同状态
    假如存在一个对话，里面包含 5 张提案卡片
    而且候选标题 CANDIDATE_TITLE_PENDING 的状态为待确认
    而且候选标题 CANDIDATE_TITLE_APPROVED 的状态为已确认
    而且候选标题 CANDIDATE_TITLE_REJECTED 的状态为已拒绝
    而且候选标题 CANDIDATE_TITLE_DONE 的状态为完成
    而且候选标题 CANDIDATE_TITLE_ERROR 的状态为出错
    当用户打开该对话
    那么 CANDIDATE_TITLE_PENDING 所在卡片应该显示“待确认”
    而且 CANDIDATE_TITLE_APPROVED 所在卡片应该显示“已确认”
    而且 CANDIDATE_TITLE_REJECTED 所在卡片应该显示“已拒绝”
    而且 CANDIDATE_TITLE_DONE 所在卡片应该显示“完成”
    而且 CANDIDATE_TITLE_ERROR 所在卡片应该显示“出错”并显示错误信息

  @P1 @result @AG-RESULT-003
  场景: 用户检查 Agent 活动的过程说明和检索结果
    假如对话中有一条 Agent 回复
    而且该回复包含过程说明
    而且该回复包含一条有结果的知识检索活动
    当用户打开该对话
    而且用户展开 Agent 活动
    那么页面应该显示过程说明和知识检索摘要
    当用户分别展开过程说明和知识检索摘要
    那么页面应该显示完整过程说明和命中的 Understanding 内容

  @P1 @context @AG-RESULT-004
  场景: 用户点击 Agent 回复中的知识库引用后查看详情
    假如 seed 数据中存在 Understanding「React Server Components」
    而且对话中有一条 Agent 回复引用了 Understanding「React Server Components」
    当用户打开该对话
    那么 Agent 回复中应该显示 Understanding「React Server Components」引用
    当用户点击该引用
    那么页面应该打开详情面板
    而且详情面板应该显示 Understanding「React Server Components」

  @P1 @context @AG-RESULT-006
  场景: 用户查看 Agent 最终答案中的结构化知识库引用
    假如 seed 数据中存在 Domain「三观」
    而且对话中有一条 Agent 最终答案引用了 Domain「三观」
    当用户打开该对话
    那么 Agent 最终答案中应该显示 Domain「三观」引用

  @P1 @error @AG-RESULT-007
  场景: 用户查看最终答案生成失败原因
    假如对话中有一条 Agent 回复的最终答案生成失败
    当用户打开该对话
    那么该 Agent 回复应该显示最终答案失败状态
    而且该失败状态应该说明失败原因

  @P0 @context @AG-RESULT-008
  场景: 用户修改实体标题后历史回复显示当前标题
    假如 seed 数据中存在一个已被 Agent 回复引用的 Understanding
    而且用户已经打开包含该引用的对话
    当用户修改该 Understanding 的标题
    而且用户回到原对话
    那么 Agent 回复中的引用应该显示修改后的标题

  @P1 @context @AG-RESULT-009
  场景: 用户在同一条回复中查看不同类型的知识库引用
    假如 seed 数据中存在一个 Understanding、一个 Context 和一个 Domain
    而且对话中有一条 Agent 回复引用了这三个实体
    当用户打开该对话
    那么 Agent 回复中应该分别显示这三个实体的当前标题

  @P1 @context @error @AG-RESULT-010
  场景: 用户查看包含已删除实体引用的回复
    假如对话中有一条 Agent 回复引用了一个已删除实体
    当用户打开该对话
    那么该引用应该显示为不可操作状态

  @P0 @context @AG-RESULT-011
  场景: Agent 回复中的知识库引用在重新进入后保持可读
    假如 Agent 回复中包含一条指向 seed Understanding 的知识库引用
    当用户打开该对话
    那么用户应该看到该 Understanding 的可读标题
    当用户切换对话并重启应用后返回
    那么这条回复仍应该显示同一个 Understanding 标题

  @P0 @semantic @AG-RETRIEVAL-003
  场景: 用户要求 Agent 检索知识库后看到检索结果
    假如 seed 数据中存在与查询语义相关但没有共同关键词的 Understanding
    而且语义检索模型已准备好
    当用户要求 Agent 查找相关理解
    而且用户展开 Agent 活动
    那么 Agent 活动中应该显示知识检索记录
    而且知识检索记录中应该显示相关 Understanding
    而且页面应该出现一条 Agent 回复正文

  @P0 @activity @AG-PROPOSAL-009
  场景: 用户让 Agent 执行普通 Bash 后直接看到结果
    假如用户已经要求 Agent 执行普通 Bash 命令
    当 Agent 完成该命令
    而且用户展开 Agent 活动
    那么 Agent 活动中应该显示该命令执行完成
    而且页面应该显示命令执行后的 Agent 回复正文
    而且输入框应该可操作

  @P0 @recovery @context @AG-HISTORY-006
  场景: 用户重启应用后仍可打开 Agent 回复中的知识库引用
    假如 seed 数据中存在 Understanding「React Server Components」
    而且用户已经完成一轮包含该 Understanding 引用的 Agent 对话
    当用户关闭并重新打开 Reflecta 应用
    而且用户重新进入 Agent 页面
    而且用户打开原对话
    那么 Agent 回复中应该显示 Understanding「React Server Components」引用
    而且 Agent 回复中的标题、强调和列表格式应该保持可读
    当用户点击该引用
    那么页面应该打开详情面板
    而且详情面板应该显示 Understanding「React Server Components」

  @P1 @result @AG-RESULT-012
  场景: 用户查看 Agent 回复中的 Mermaid 图表
    假如对话中有一条包含有效 Mermaid 图表的 Agent 回复
    当用户打开该对话
    那么回复中应该显示渲染后的图表
    当用户把指针移到图表区域
    那么用户应该可以复制、下载或全屏查看该图表
