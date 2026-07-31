# language: zh-CN
@agent @v1.1.0
功能: 用户管理 Agent 对话
  用户需要创建、切换、组织、导出和分支对话，并在离开或重启后继续看到已保存内容。

  @P0 @happy_path @AG-START-001
  场景: 用户进入 Agent 页面后可以开始对话
    假如用户已经打开 Reflecta 应用
    当用户进入 Agent 页面
    那么用户应该看到 Agent 对话区域
    而且用户应该看到可输入的消息输入框
    而且用户应该看到可以发送消息的操作入口

  @P1 @context @AG-START-004
  场景: 新对话标题使用第一条用户消息的可读内容
    假如 seed 数据中存在 Domain「React」
    而且用户已经打开一个新对话
    当用户在第一条消息中选择 Domain「React」
    而且用户输入请解释这个领域
    而且用户发送消息并等待回复完成
    那么对话列表中应该显示标题“React 请解释这个领域”
    而且标题应该只包含用户可读的上下文名称和消息正文

  @P1 @draft @AG-START-005
  场景: 对话列表只收录已经发送消息的对话
    假如用户已经进入 Agent 页面
    当用户创建新对话
    而且用户不发送任何消息
    那么对话列表应该保持创建新对话前的历史内容
    而且用户仍然应该看到可输入的消息输入框

  @P0 @isolation @AG-CONV-001
  场景: 对话 A 正在回复时切换到对话 B 仍保持 B 的状态
    假如存在对话 A 和对话 B
    而且对话 A 正在生成回复
    而且对话 B 已有用户消息 B_USER_MESSAGE 和一条已完成 Agent 回复
    当用户从对话 A 切换到对话 B
    那么对话 B 应该显示用户消息 B_USER_MESSAGE
    而且对话 B 应该显示一条已完成 Agent 回复
    而且对话 B 的输入框应该可输入

  @P0 @isolation @AG-CONV-002
  场景: 对话 A 回复完成后切回 A 可以看到 A 的内容
    假如存在对话 A 和对话 B
    而且 Agent 当前可以完成回复
    当用户打开对话 A
    而且用户发送 start A
    而且用户在 A 正在回复时切换到对话 B
    而且用户等待对话 A 的回复完成
    而且用户切回对话 A
    那么对话 A 应该显示用户消息 start A
    而且对话 A 应该显示一条已完成 Agent 回复
    而且消息顺序应该保持用户消息在前、Agent 回复在后

  @P1 @isolation @AG-CONV-003
  场景: 用户删除一个对话后仍可查看剩余对话
    假如存在对话 A 和对话 B
    而且对话 A 有用户消息 A_USER_MESSAGE 和一条 Agent 回复
    而且对话 B 有用户消息 B_USER_MESSAGE 和一条 Agent 回复
    当用户打开对话 A
    而且用户从顶部对话操作里删除对话 A
    而且用户查看对话列表
    而且用户打开对话 B
    那么对话列表应该显示对话 B
    而且对话 B 应该显示用户消息 B_USER_MESSAGE
    而且对话 B 应该显示一条已完成 Agent 回复

  @P1 @isolation @AG-CONV-004
  场景: 用户按时间分组查看对话列表
    假如存在今天更新的对话 TODAY_LATE 和 TODAY_EARLY
    而且存在昨天更新的对话 YESTERDAY_THREAD
    当用户进入 Agent 页面
    那么对话列表应该显示“今天”和“昨天”分组
    而且 TODAY_LATE 应该显示在 TODAY_EARLY 前面
    而且今天的对话应该显示在昨天的对话前面

  @P1 @branch @AG-CONV-005
  场景: 用户在 Agent 回复下方 Fork 对话分支后继续查看分支点内容
    假如存在对话 FORK_SOURCE
    而且对话 FORK_SOURCE 有用户消息 FORK_USER_MESSAGE 和对应 Agent 回复
    而且对话 FORK_SOURCE 在这条 Agent 回复后还有后续消息
    当用户在这条 Agent 回复下方执行 Fork
    那么对话列表应该显示 Fork 后的新分支对话
    而且新分支对话应该排在对话列表最顶部
    而且新分支对话应该显示用户消息 FORK_USER_MESSAGE
    而且新分支对话应该显示这条 Agent 回复
    而且新分支对话的消息列表应该到这条 Agent 回复结束
    而且原对话 FORK_SOURCE 应该仍保留在对话列表中

  @P1 @export @AG-CONV-007
  场景: 用户导出当前对话为 Markdown
    假如存在对话 EXPORT_SOURCE
    而且对话 EXPORT_SOURCE 有用户消息 EXPORT_USER_MESSAGE 和一条 Agent 回复
    而且这条 Agent 回复引用了名为 EXPORT_DOMAIN 的 Domain
    当用户打开对话 EXPORT_SOURCE
    而且用户执行导出 Markdown
    那么用户应该得到名为 EXPORT_SOURCE.md 的 Markdown 文件
    而且 Markdown 文件应该包含用户消息 EXPORT_USER_MESSAGE
    而且 Markdown 文件应该包含这条 Agent 回复
    而且 Markdown 文件应该把这条引用显示为 EXPORT_DOMAIN
    而且 Markdown 文件应该只包含用户提问和 Agent 回复内容

  @P1 @management @AG-CONV-008
  场景: 用户从对话列表删除指定对话
    假如存在对话 A 和对话 B
    而且对话 A 和对话 B 都有用户消息和一条 Agent 回复
    当用户打开对话 A 的操作菜单
    当用户从该菜单删除对话 A 并确认
    那么对话列表应该只显示剩余的对话 B

  @P1 @management @AG-CONV-009
  场景: 用户重命名对话
    假如用户已经打开一条有内容的对话
    当用户把当前对话重命名为 RENAMED_THREAD
    那么对话标题和对话列表都应该显示 RENAMED_THREAD
    当用户重新打开 Reflecta
    那么对话列表仍应该显示 RENAMED_THREAD

  @P1 @management @AG-CONV-010
  场景: 用户为对话生成标题
    假如用户已经打开一条有内容的对话
    而且标题生成模型可以正常回复
    当用户选择生成标题
    那么当前对话应该显示模型生成的新标题
    而且对话列表应该显示同一个新标题

  @P1 @management @AG-CONV-011
  场景: 用户归档不再活跃的对话
    假如对话列表中存在对话 A 和对话 B
    当用户归档对话 A
    那么当前对话列表应该只显示仍活跃的对话 B

  @P1 @management @AG-CONV-012
  场景: 用户复制对话 ID
    假如用户已经打开一条已保存的对话
    当用户复制当前对话 ID
    那么系统剪贴板应该包含这条对话的 ID

  @P1 @error @AG-CONV-013
  场景: 生成对话标题失败时保留原标题
    假如用户已经打开标题为 ORIGINAL_THREAD_TITLE 的对话
    而且下一次标题生成会失败
    当用户选择生成标题
    那么页面应该说明标题生成失败
    而且对话仍应该显示 ORIGINAL_THREAD_TITLE

  @P0 @recovery @AG-HISTORY-001
  场景: 用户重启应用后仍能看到已完成对话
    假如用户已经完成一轮 Agent 对话
    当用户关闭并重新打开 Reflecta 应用
    而且用户重新进入 Agent 页面
    而且用户打开原对话
    那么原对话应该仍显示用户消息
    而且原对话应该仍显示一条 Agent 回复正文
    而且输入框应该可操作

  @P1 @recovery @AG-HISTORY-002
  场景: 用户重启应用后对话列表和消息顺序保持一致
    假如用户已经完成一轮 Agent 对话
    而且对话列表预览包含该对话的用户消息
    当用户重启 Reflecta 应用
    而且用户重新进入 Agent 页面
    那么对话列表预览应该仍显示该用户消息
    而且打开原对话后消息顺序应该保持用户消息在前、Agent 回复在后

  @P1 @navigation @AG-START-008
  场景: 用户收起后从对话标题重新展开对话列表
    假如用户已经进入 Agent 页面
    当用户收起对话列表
    那么对话列表应该完全隐藏
    而且当前对话标题左侧应该显示展开对话列表的操作
    当用户从当前对话标题左侧展开对话列表
    那么对话列表应该恢复显示
    而且收起对话列表的操作应该显示在对话列表右上角

  @P1 @layout @AG-START-009
  场景: 用户调整对话列表宽度
    假如用户已经进入 Agent 页面
    当用户向右拖动对话列表与当前对话之间的分隔条
    那么对话列表应该变宽
    而且当前对话应该继续显示
