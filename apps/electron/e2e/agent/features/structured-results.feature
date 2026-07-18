# language: zh-CN
@agent @v1.1.0
功能: 用户理解 Agent 的结构化结果
  用户需要能看懂复杂回复的展示顺序，并区分提案的不同状态。

  @P1 @render @AG-RESULT-001
  场景: 用户查看复杂回复时内容按发生顺序显示
    假如对话中有一条复杂 Agent 回复
    而且该回复包含思考摘要
    而且该回复包含查找进度
    而且该回复包含提案卡片
    而且该回复包含最终回复正文
    当用户打开该对话
    那么在同一条 Agent 回复中应该先显示思考摘要
    而且思考摘要之后应该显示查找进度
    而且查找进度之后应该显示提案卡片
    而且提案卡片之后应该显示最终回复正文

  @P1 @render @AG-RESULT-002
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

  @P1 @render @AG-RESULT-003
  场景: 用户展开思考过程和工具活动查看详情
    假如对话中有一条 Agent 回复
    而且该回复包含思考过程
    而且该回复包含工具活动
    当用户打开该对话
    那么思考过程应该默认收起
    而且工具活动应该默认收起
    当用户展开思考过程
    而且用户展开工具活动
    那么页面应该显示思考过程详情
    而且页面应该显示工具活动详情

  @P1 @context @AG-RESULT-004
  场景: 用户点击 Agent 回复中的知识库引用后查看详情
    假如 seed 数据中存在 Understanding「React Server Components」
    而且对话中有一条 Agent 回复引用了 Understanding「React Server Components」
    当用户打开该对话
    那么 Agent 回复中应该显示 Understanding「React Server Components」引用
    当用户点击该引用
    那么页面应该打开详情面板
    而且详情面板应该显示 Understanding「React Server Components」

  @P1 @render @tool @AG-RESULT-005
  场景: 用户查看 Bash 长输出时可以原地展开
    假如对话中有一张已完成的 Bash 提案卡片
    而且该 Bash 提案卡片包含较长的错误输出
    当用户打开该对话
    那么 Bash 提案卡片应该显示错误输出预览
    当用户展开完整输出
    那么 Bash 提案卡片应该在原位置显示完整错误输出
    当用户收起完整输出
    那么 Bash 提案卡片应该恢复为错误输出预览

  @P1 @context @AG-RESULT-006
  场景: 用户查看 Agent 最终答案中的结构化知识库引用
    假如 seed 数据中存在 Domain「三观」
    而且对话中有一条 Agent 最终答案引用了 Domain「三观」
    当用户打开该对话
    那么 Agent 最终答案中应该显示 Domain「三观」引用
    而且页面不应该显示该 Domain 的裸 id

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
    那么该引用应该显示为不可用
    而且用户不能通过该引用打开错误的实体详情

  @P0 @context @AG-RESULT-011
  场景: 分段生成的引用在历史中保持一致
    假如 Agent 分段生成了一条包含知识库引用的回复
    当回复完成后
    那么用户应该只看到实体标题而不是引用语法
    当用户切换对话并重启应用后返回
    那么这条回复仍应该显示同一个实体标题
