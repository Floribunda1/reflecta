# language: zh-CN
@settings @ai
功能: 选择 Reflecta 使用的 AI 模型
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
