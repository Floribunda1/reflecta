# language: zh-CN
@settings @ai
功能: 用户配置 Reflecta 使用的 AI
  用户希望从 Provider 提供的模型中选择少量常用模型，使 Chat 和标题生成只展示自己启用的模型。

  @P1 @happy_path @AI-SETTINGS-001
  场景: 用户为 Provider 选择用于 Chat 的模型
    假如用户打开 AI 设置
    而且 OpenAI Provider 尚未配置
    当用户填写 OpenAI Credential
    而且用户选择 GPT-4o 和 o3
    而且用户保存 AI 设置
    那么 Chat 模型菜单应该只显示 GPT-4o 和 o3
    当用户在 Chat 中选择 GPT-4o
    那么模型菜单应该只提供模型选择
    当用户在 Chat 中选择 o3
    那么模型菜单应该显示 o3 支持的推理等级选项

  @P1 @recovery @AI-SETTINGS-002
  场景: 用户停用当前模型后自动使用仍然启用的模型
    假如 OpenAI Provider 已启用 GPT-4o 和 o3
    而且当前 Chat 模型和标题生成模型都是 o3
    当用户在 AI 设置中停用 o3
    而且用户保存 AI 设置
    那么标题生成模型应该变为 GPT-4o
    而且 Chat 模型菜单应该只显示 GPT-4o
    而且当前 Chat 模型应该是 GPT-4o

  @P0 @happy_path @AI-SETTINGS-003
  场景: 用户连接和断开 Codex
    假如用户打开 AI 设置
    而且 Codex 尚未连接
    当用户连接 Codex 并完成授权
    那么 AI 设置应该显示 Codex 已连接
    而且用户应该可以启用 Codex 提供的模型
    当用户断开 Codex
    那么 AI 设置应该显示 Codex 未连接
    而且 Codex 模型应该不再可用

  @P1 @happy_path @AI-SETTINGS-004
  场景: 用户选择标题生成模型
    假如用户已经启用两个可用模型
    当用户选择其中一个模型用于标题生成
    而且用户保存 AI 设置
    那么重新打开 AI 设置后仍应该显示这个标题生成模型

  @P1 @error @AI-SETTINGS-005
  场景: Codex 连接失败后用户可以重试
    假如用户打开 AI 设置
    而且下一次 Codex 连接会失败
    当用户连接 Codex
    那么页面应该说明连接 Codex 失败
    而且 Codex 应该保持未连接
    而且用户应该仍能再次发起连接
