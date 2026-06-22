# language: zh-CN
@agent @v1.1.0 @pi_smoke
功能: 开发者验证 Pi Agent 真实链路
  开发者需要在迁移早期确认 Pi Agent、真实 AI 和 session 文件位置已经形成最小闭环。

  @P0 @happy_path @AG-PI-SMOKE-001
  场景: 开发 smoke 路径发送消息后收到真实 AI 回复
    假如开发环境已经配置真实 AI key
    而且 Content Storage Root 已经创建
    当开发者通过 Pi smoke 路径发送一条消息
    那么应该收到一条真实 AI 回复正文
    而且 Pi session 文件应该创建在 Content Storage Root 的 Sessions 目录下
