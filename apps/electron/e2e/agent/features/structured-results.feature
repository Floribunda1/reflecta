# language: zh-CN
@agent @v1.1.0
功能: 用户理解 Agent 的结构化结果
  用户需要能看懂复杂回复的展示顺序，并区分提案的不同状态。

  @P1 @happy_path @AG-RESULT-001
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

  @P1 @happy_path @AG-RESULT-002
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

  @P1 @happy_path @AG-RESULT-003
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
    假如 seed 数据中存在 Thought「React Server Components」
    而且对话中有一条 Agent 回复引用了 Thought「React Server Components」
    当用户打开该对话
    那么 Agent 回复中应该显示 Thought「React Server Components」引用
    当用户点击该引用
    那么页面应该打开详情面板
    而且详情面板应该显示 Thought「React Server Components」
